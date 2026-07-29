import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { orbita } from "@/theme/orbita";

/**
 * Confirmación destructiva, en las dos plataformas.
 *
 * `Alert.alert` de react-native-web es literalmente `static alert() {}`: no
 * hace nada. Como el Perfil canónico se sirve también en la web, "Eliminar mi
 * cuenta" abría una promesa que NUNCA resolvía y dejaba tomado el lock de
 * reentrada: el botón quedaba muerto hasta recargar.
 *
 * En nativo se sigue usando el `Alert` del sistema, que es lo que la gente
 * espera. En web se muestra un modal propio de Órbita — no `window.confirm`,
 * que bloquea el hilo y rompe el estilo.
 */

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
};

type ConfirmFn = (req: ConfirmRequest) => Promise<boolean>;
type NotifyFn = (title: string, message?: string) => void;

const ConfirmContext = createContext<{ confirm: ConfirmFn; notify: NotifyFn } | null>(null);

const IS_WEB = Platform.OS === "web";

/** Alert nativo como promesa; cerrar sin elegir cuenta como cancelar. */
function nativeConfirm(req: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert(
      req.title,
      req.message,
      [
        { text: "Cancelar", style: "cancel", onPress: () => settle(false) },
        {
          text: req.confirmLabel,
          style: req.destructive ? "destructive" : "default",
          onPress: () => settle(true)
        }
      ],
      { cancelable: true, onDismiss: () => settle(false) }
    );
  });
}

export function ConfirmHost({ children }: { children: ReactNode }) {
  // `notice` es una confirmación de un solo botón: el mismo problema del Alert
  // no-op afectaba al aviso "Guardado" de la Home.
  const [pending, setPending] = useState<(ConfirmRequest & { notice?: boolean }) | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setPending(null);
    resolve?.(value);
  }, []);

  const confirm = useCallback<ConfirmFn>(
    (req) => {
      if (!IS_WEB) return nativeConfirm(req);
      // Una confirmación ya abierta se cancela antes de abrir otra: nunca se
      // deja una promesa colgada sin resolver.
      resolver.current?.(false);
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setPending(req);
      });
    },
    []
  );

  const notify = useCallback<NotifyFn>(
    (title, message = "") => {
      if (!IS_WEB) {
        Alert.alert(title, message);
        return;
      }
      resolver.current?.(false);
      resolver.current = null;
      setPending({ title, message, confirmLabel: "Entendido", notice: true });
    },
    []
  );

  const value = useMemo(() => ({ confirm, notify }), [confirm, notify]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {IS_WEB && pending ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => settle(false)}>
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <Text style={styles.title}>{pending.title}</Text>
              <Text style={styles.message}>{pending.message}</Text>
              <View style={styles.actions}>
                {pending.notice ? null : (
                  <Pressable onPress={() => settle(false)} accessibilityRole="button" style={styles.cancel}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => settle(true)}
                  accessibilityRole="button"
                  style={[styles.confirm, pending.destructive && styles.confirmDanger]}
                >
                  <Text style={[styles.confirmText, pending.destructive && styles.confirmTextDanger]}>
                    {pending.confirmLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
}

/**
 * Devuelve siempre una función usable. Sin host montado (tests, nativo puro)
 * cae al Alert del sistema en vez de romper.
 */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)?.confirm ?? nativeConfirm;
}

/** Aviso de un solo botón. En nativo es el `Alert` de siempre. */
export function useNotify(): NotifyFn {
  return (
    useContext(ConfirmContext)?.notify ??
    ((title: string, message = "") => Alert.alert(title, message))
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(4,5,7,0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  card: {
    backgroundColor: "#0D0F13",
    borderColor: "rgba(214,154,106,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    maxWidth: 420,
    padding: 24,
    width: "100%"
  },
  title: { color: orbita.colors.bone, fontSize: 19, fontWeight: "700" },
  message: { color: "rgba(244,238,228,0.74)", fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 6 },
  cancel: { borderRadius: 8, minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  cancelText: { color: "rgba(244,238,228,0.74)", fontSize: 14, fontWeight: "500" },
  confirm: {
    backgroundColor: orbita.colors.bone,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18
  },
  confirmDanger: { backgroundColor: orbita.colors.danger },
  confirmText: { color: "#07080A", fontSize: 14, fontWeight: "700" },
  confirmTextDanger: { color: orbita.colors.bone }
});
