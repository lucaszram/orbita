/**
 * Diálogo modal del backoffice.
 *
 * Las dos acciones que escriben entitlements (dar y sacar Pro) pasan por acá, y
 * un modal mal hecho es exactamente donde se pierde el teclado: por eso monta
 * `Modal` (que en web atrapa el foco y dispara `onRequestClose` con Escape),
 * se anuncia como `dialog` con su título como nombre accesible, y el fondo
 * también cierra.
 *
 * `animationType` respeta "menos movimiento": con la preferencia activa el
 * diálogo aparece, no se desliza.
 */
import { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";

import { AdminButton, backofficeColors as c } from "./kit";

export function AdminDialog({
  visible,
  title,
  description,
  onClose,
  children,
  footer
}: {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Cerrar el diálogo"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel={title}
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          style={styles.dialog}
        >
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <AdminButton label="Cerrar" onPress={onClose} variant="ghost" />
          </View>
          {description ? (
            <Text selectable style={styles.description}>
              {description}
            </Text>
          ) : null}
          <ScrollView contentContainerStyle={styles.bodyContent} style={styles.body}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(6, 6, 6, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  dialog: {
    backgroundColor: c.panel,
    borderColor: c.faint,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
    maxHeight: "90%",
    maxWidth: 560,
    padding: 20,
    width: "100%"
  },
  head: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  title: {
    color: c.ink,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "800"
  },
  description: {
    color: c.muted,
    fontSize: 13,
    lineHeight: 19
  },
  body: {
    flexGrow: 0
  },
  bodyContent: {
    gap: 12
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "flex-end"
  }
});
