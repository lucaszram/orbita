import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useFocusEffect } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { createOwnerGates, runExclusive } from "@/domain/exclusive";
import { useEntitlement } from "@/hooks/useLiveApp";
import {
  applyStoreAnswer,
  defaultNativePlan,
  emptyPurchaseSession,
  nativePrimaryAction,
  ownedValue,
  publishOwnedValue,
  purchaseSessionForOwner,
  readOwnedValue,
  storeAnswerClearsPurchaseGuard,
  type NativePrimaryAction,
  type NativePurchaseSession,
  type NativeStoreAnswer,
  type NativeStorePlan,
  type NativeStoreTrial,
  type OwnedValue
} from "@/domain/nativeCommerce";
import { purchaseGuardBlocks } from "@/domain/purchaseGuard";
import { appApi } from "@/services/appRefs";
import { clearPurchaseGuard, readPurchaseGuard, storePurchaseGuard } from "@/services/purchaseGuard";
import { useRevenueCat } from "@/services/revenuecat/RevenueCatProvider";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Screen } from "../components/Screen";
import { Body, Caption, Eyebrow } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

const PRIVACY_URL = "https://orbitaastrologia.xyz/privacy";
const TERMS_URL = "https://orbitaastrologia.xyz/terminos";

type ActionPhase = "idle" | "purchasing" | "restoring";

/**
 * 11 — Paywall del onboarding, con el COMERCIO REAL.
 *
 * Conserva el contenido aprobado (hero "Tu cielo, todos los días.", qué
 * incluye, cómo te acompaña, disclosure de renovación) SIN la tríada, y usa el
 * mismo circuito comercial que `PlusPaywallScreen`: la oferta y sus importes
 * llegan de la tienda (RevenueCat), el marcador anti doble cobro se escribe en
 * disco y en memoria ANTES de tocar la tienda, y una cancelación demostrada no
 * es un error — la persona permanece acá, sin cargo y sin culpa.
 *
 * Salidas: compra confirmada por la tienda, restauración con compra activa y
 * "Seguir gratis" entran DIRECTO a Carta (`onEnterCarta`). Ningún camino pasa
 * por `/recepcion` ni por la ruta `/paywall` de la app.
 */
type Props = {
  /** Salida única del onboarding: la Carta de la última pestaña. */
  onEnterCarta: () => void;
  onBack: () => void;
  /**
   * La salida a Carta falló en ESTE teléfono (perfil local). Los datos y la
   * compra están a salvo; el reintento vuelve a ENTRAR, no a cobrar.
   */
  entryFailed: boolean;
  /** Inspección visual (`debugStep`/preview): sin impresión y sin acciones. */
  inspect?: boolean;
};

export function OnboardingPaywallScreen({ onEnterCarta, onBack, entryFailed, inspect = false }: Props) {
  const { remote: entitlement, resolved: entitlementResuelto } = useEntitlement();
  const revenueCat = useRevenueCat();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [actionSlot, setActionSlot] = useState<OwnedValue<ActionPhase>>(() => ownedValue(null, "idle"));
  const [noticeSlot, setNoticeSlot] = useState<OwnedValue<string | null>>(() => ownedValue(null, null));
  const [session, setSession] = useState<NativePurchaseSession>(() => emptyPurchaseSession(null));
  const reconcile = useMutation(appApi.subscriptions.requestStoreReconcile);
  const gates = useRef(createOwnerGates()).current;

  const selected = useMemo(
    () => revenueCat.plans.find((plan) => plan.id === selectedPlan) ?? null,
    [revenueCat.plans, selectedPlan]
  );

  useEffect(() => {
    if (selectedPlan && revenueCat.plans.some((plan) => plan.id === selectedPlan)) return;
    setSelectedPlan(defaultNativePlan(revenueCat.plans));
  }, [revenueCat.plans, selectedPlan]);

  const identifiedUserId = revenueCat.identifiedUserId;
  const owned = purchaseSessionForOwner(session, identifiedUserId);
  const action = readOwnedValue(actionSlot, identifiedUserId, "idle");
  const notice = readOwnedValue(noticeSlot, identifiedUserId, null);
  const ownerRef = useRef<string | null>(identifiedUserId);
  ownerRef.current = identifiedUserId;
  const gate = gates.for(identifiedUserId);

  const setNotice = useCallback(
    (owner: string | null, text: string | null) =>
      setNoticeSlot((previous) => publishOwnedValue(previous, owner, ownerRef.current, text)),
    []
  );
  const setAction = useCallback(
    (owner: string | null, phase: ActionPhase) =>
      setActionSlot((previous) => publishOwnedValue(previous, owner, ownerRef.current, phase)),
    []
  );

  // El marcador persistido se lee ANTES de habilitar nada, por cuenta.
  useEffect(() => {
    let alive = true;
    setSession(emptyPurchaseSession(identifiedUserId));
    if (!identifiedUserId) {
      setSession({ ...emptyPurchaseSession(null), guard: "clear" });
      return;
    }
    void readPurchaseGuard(identifiedUserId).then((read) => {
      if (!alive) return;
      setSession((previous) => {
        if (previous.userId !== identifiedUserId) return previous;
        const blocks = purchaseGuardBlocks(read);
        return {
          ...previous,
          guard: blocks ? "blocked" : "clear",
          lastOutcome: blocks ? "ambiguous" : previous.lastOutcome
        };
      });
    });
    return () => {
      alive = false;
    };
  }, [identifiedUserId]);

  // Primero el disco, después la sesión: si el borrado del marcador falla, el
  // bloqueo se conserva (misma regla que el paywall in-app).
  const answerStore = useCallback(
    async (userId: string | null, answer: NativeStoreAnswer): Promise<boolean> => {
      const debeLimpiar = storeAnswerClearsPurchaseGuard(answer);
      if (debeLimpiar && userId) {
        try {
          await clearPurchaseGuard(userId);
        } catch {
          setSession((previous) => applyStoreAnswer(previous, userId, "purchase_ambiguous"));
          return false;
        }
      }
      setSession((previous) => applyStoreAnswer(previous, userId, answer));
      return true;
    },
    []
  );

  const askBackendToReconcile = useCallback(async () => {
    try {
      return await reconcile({});
    } catch {
      return null;
    }
  }, [reconcile]);

  const stillOwner = (userId: string | null) => userId !== null && userId === ownerRef.current;

  const armStoreGuard = useCallback(
    async (userId: string | null): Promise<boolean> => {
      if (userId) {
        try {
          await storePurchaseGuard(userId, Date.now());
        } catch {
          return false;
        }
      }
      await answerStore(userId, "purchase_started");
      return true;
    },
    [answerStore]
  );

  const backendIsPro = entitlement?.isPro;
  const storeConfirmed = owned.purchaseReceived || revenueCat.storeIsPro;
  const busy = action !== "idle";
  const restoreReady = revenueCat.identifiedUserId !== null && entitlementResuelto;

  /**
   * Impresión: UNA por vista enfocada, dueño y oferta — y NUNCA en inspección.
   */
  const impresionRef = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        impresionRef.current = null;
      };
    }, [])
  );
  const paywallOfferingId = revenueCat.offeringId;
  const offeringVisible =
    !inspect &&
    focused &&
    entitlementResuelto &&
    backendIsPro !== true &&
    !storeConfirmed &&
    revenueCat.phase === "ready";
  const trackImpression = revenueCat.trackPaywallImpression;
  useEffect(() => {
    if (!offeringVisible || !identifiedUserId || !paywallOfferingId) return;
    const clave = `${identifiedUserId}:${paywallOfferingId}`;
    if (impresionRef.current === clave) return;
    let alive = true;
    void trackImpression().then((emitida) => {
      if (alive && emitida) impresionRef.current = clave;
    });
    return () => {
      alive = false;
    };
  }, [offeringVisible, identifiedUserId, paywallOfferingId, trackImpression]);

  const purchase = async () => {
    if (inspect || !selected) return;
    const userId = identifiedUserId;
    await runExclusive(gate, async () => {
      setNotice(userId, null);
      setAction(userId, "purchasing");
      try {
        if (!(await armStoreGuard(userId))) {
          setNotice(userId, "No pudimos preparar la compra en este teléfono. Probá de nuevo.");
          return;
        }
        const result = await revenueCat.purchase(selected.id);
        if (result === "cancelled") {
          // Cancelación demostrada por la tienda: no hubo cargo y NO es un
          // error. La persona permanece en el paywall.
          const limpio = await answerStore(userId, "purchase_cancelled");
          setNotice(
            userId,
            limpio
              ? "La compra se canceló. No se hizo ningún cargo."
              : "La compra se canceló, pero no pudimos limpiar el estado local. Probá Restaurar."
          );
          return;
        }
        if (result === "inactive") {
          await answerStore(userId, "purchase_ambiguous");
          setNotice(userId, "La tienda no confirmó acceso a Órbita Plus. No vuelvas a comprar; probá Restaurar.");
          if (stillOwner(userId)) void askBackendToReconcile();
          return;
        }
        // La tienda cobró: se registra, se pide la lectura autoritativa y la
        // salida es la Carta. La activación sigue en segundo plano.
        await answerStore(userId, "store_confirmed");
        if (stillOwner(userId)) {
          void askBackendToReconcile();
          onEnterCarta();
        }
      } catch {
        await answerStore(userId, "purchase_ambiguous");
        setNotice(userId, "No pudimos confirmar el resultado. No vuelvas a comprar; probá Restaurar.");
        if (stillOwner(userId)) void askBackendToReconcile();
      } finally {
        setAction(userId, "idle");
      }
    });
  };

  const restore = async () => {
    if (inspect || !restoreReady) return;
    const userId = identifiedUserId;
    await runExclusive(gate, async () => {
      setNotice(userId, null);
      setAction(userId, "restoring");
      try {
        if (!(await armStoreGuard(userId))) {
          setNotice(userId, "No pudimos preparar la restauración en este teléfono. Probá de nuevo.");
          return;
        }
        const result = await revenueCat.restore();
        if (result === "inactive") {
          const limpio = await answerStore(userId, "restore_empty");
          setNotice(
            userId,
            limpio
              ? "No encontramos una compra activa para esta cuenta de la tienda."
              : "No encontramos una compra activa, pero no pudimos limpiar el estado local."
          );
          if (stillOwner(userId)) void askBackendToReconcile();
          return;
        }
        // Restauramos tu Plus: la salida es la Carta.
        await answerStore(userId, "store_confirmed");
        if (stillOwner(userId)) {
          void askBackendToReconcile();
          onEnterCarta();
        }
      } catch {
        await answerStore(userId, "purchase_ambiguous");
        setNotice(userId, "No pudimos restaurar tus compras. Revisá la conexión y probá de nuevo.");
        if (stillOwner(userId)) void askBackendToReconcile();
      } finally {
        setAction(userId, "idle");
      }
    });
  };

  // Con el acceso ya resuelto (Plus activo) o la compra confirmada, el primario
  // es entrar a la Carta. `nativePrimaryAction` decide el resto con las mismas
  // reglas del paywall in-app (guard cargado, resultado ambiguo → Restaurar).
  const primary: NativePrimaryAction =
    backendIsPro === true || storeConfirmed
      ? "leave"
      : nativePrimaryAction({
          offeringReady: revenueCat.phase === "ready" && Boolean(selected),
          backendIsPro,
          storeConfirmed,
          busy,
          lastOutcome: owned.lastOutcome,
          guardLoaded: owned.guard !== "loading"
        });

  return (
    <Screen bg={A.paymentBg} bgOpacity={0.9} wash={0.64}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.nav}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Volver">
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => void restore()}
            disabled={busy || !restoreReady}
            hitSlop={12}
            style={styles.restoreButton}
            accessibilityRole="button"
            accessibilityLabel="Restaurar compras"
            accessibilityState={{ disabled: busy || !restoreReady }}
          >
            <Text style={[styles.restore, (busy || !restoreReady) && styles.dimmed]}>
              {restoreReady ? "Restaurar" : "Preparando…"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.brandRow}>
          <Text style={styles.brand}>Órbita</Text>
          <View style={styles.plusBadge}>
            <Text style={styles.plusText}>PLUS</Text>
          </View>
        </View>

        <Eyebrow style={styles.eyebrow}>TU CARTA, TODOS LOS DÍAS</Eyebrow>
        <Text style={styles.hero}>Tu cielo,{"\n"}todos los días.</Text>
        <Body style={styles.sub}>Tu carta completa, tus tránsitos y tu guía diaria.</Body>

        {backendIsPro === true || storeConfirmed ? (
          <View style={styles.statusCard} accessibilityLiveRegion="polite">
            <Text style={styles.statusTitle}>
              {backendIsPro === true ? "Órbita Plus ya está activo en tu cuenta." : "Tu compra está confirmada."}
            </Text>
            <Body style={styles.statusBody}>Entrá a tu carta: el acceso se termina de activar solo.</Body>
          </View>
        ) : !entitlementResuelto ? (
          <View style={styles.statusCard} accessibilityLiveRegion="polite">
            <Text style={styles.statusTitle}>Estamos comprobando tu plan…</Text>
          </View>
        ) : (
          <OfferingSection
            phase={revenueCat.phase}
            plans={revenueCat.plans}
            selectedPlan={selectedPlan}
            onSelect={setSelectedPlan}
            onRetry={() => void revenueCat.retry().catch(() => undefined)}
          />
        )}

        <View style={styles.benefitsCard}>
          <Text style={styles.sectionTitle}>Qué incluye</Text>
          <Benefit text="Tu carta natal completa." />
          <Benefit text="Los tránsitos leídos en tu carta." />
          <Benefit text="Tu día con contexto, todos los días." />
          <Benefit text="Preguntas más profundas en El Umbral." />
          <Benefit text="Vínculos, calendario y fase lunar." />
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.sectionTitle}>Cómo te acompaña</Text>
          <Paso n="01" title="Tu carta completa" body="Tu carta natal con Sol, Luna, ascendente y casas." />
          <Paso n="02" title="Tu día con contexto" body="Una lectura diaria pensada desde tu carta." />
          <Paso n="03" title="Preguntas más profundas" body="Explorá amor, trabajo y vínculos con más detalle." />
        </View>

        {entryFailed ? (
          <Caption accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            Tus datos quedaron guardados en tu cuenta, pero no pudimos abrir Órbita en este teléfono.
            Probá de nuevo desde «Seguir gratis».
          </Caption>
        ) : null}
        {notice ? (
          <Caption accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Caption>
        ) : null}

        <View style={styles.legal}>
          <Caption>
            {selected?.trial
              ? `La prueba de ${selected.trial.label.replace(" gratis", "")} no tiene costo y, si no la cancelás antes de que termine, sigue como suscripción mensual con renovación automática. Podés cancelarla desde la gestión de tu cuenta; el precio y las condiciones finales son los que muestra la tienda antes de confirmar. Entretenimiento y autoconocimiento.`
              : "Suscripción mensual con renovación automática. Podés cancelarla desde la gestión de tu cuenta; el precio y las condiciones finales son los que muestra la tienda antes de confirmar. Entretenimiento y autoconocimiento."}
          </Caption>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.legalLink}>Términos</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.legalLink}>Privacidad</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CTA
          label={primaryLabel({ action, primary, entitlementResolved: entitlementResuelto, trial: selected?.trial ?? null, phase: revenueCat.phase })}
          onPress={
            primary === "leave"
              ? onEnterCarta
              : primary === "restore"
                ? () => void restore()
                : primary === "purchase"
                  ? () => void purchase()
                  : undefined
          }
          disabled={primary === "wait" || (primary === "restore" && !restoreReady)}
        />
        {/* "Seguir gratis": la salida sin compra, directo a la Carta. */}
        <Pressable
          onPress={busy ? undefined : onEnterCarta}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          style={styles.freeButton}
        >
          <Text style={[styles.freeText, busy && styles.dimmed]}>Seguir gratis</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function OfferingSection({
  phase,
  plans,
  selectedPlan,
  onSelect,
  onRetry
}: {
  phase: ReturnType<typeof useRevenueCat>["phase"];
  plans: readonly NativeStorePlan[];
  selectedPlan: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  if (phase === "ready") {
    return (
      <View style={styles.planCard} accessibilityRole="radiogroup" accessibilityLabel="Elegí un plan de Órbita Plus">
        {plans.map((plan, index) => (
          <View key={plan.id}>
            {index > 0 ? <View style={styles.planDivider} /> : null}
            <PlanRow plan={plan} selected={plan.id === selectedPlan} onPress={() => onSelect(plan.id)} />
          </View>
        ))}
      </View>
    );
  }
  const loading = phase === "waiting_for_session" || phase === "configuring" || phase === "loading_offering";
  return (
    <View style={styles.statusCard} accessibilityLiveRegion="polite">
      <Text style={styles.statusTitle}>
        {loading
          ? "Cargando los planes de la tienda…"
          : phase === "unavailable"
            ? "Las compras no están disponibles en este build."
            : phase === "no_offering"
              ? "No hay un plan disponible en la tienda ahora."
              : "No pudimos cargar los planes de la tienda."}
      </Text>
      {!loading && phase !== "unavailable" ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.inlineAction}>
          <Text style={styles.inlineActionText}>REINTENTAR</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PlanRow({ plan, selected, onPress }: { plan: NativeStorePlan; selected: boolean; onPress: () => void }) {
  const trialSuffix = plan.trial ? `, ${plan.trial.label} y después` : ",";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${plan.label}${trialSuffix} ${plan.price} ${plan.cadence}`}
      style={styles.planRow}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.planCopy}>
        <Text style={styles.planLabel}>{plan.label}</Text>
        {plan.trial ? (
          <View style={styles.trialBadge}>
            <Text style={styles.trialText}>{plan.trial.label.toUpperCase()}</Text>
          </View>
        ) : null}
        {plan.comparison ? <Caption>{plan.comparison}</Caption> : null}
      </View>
      <View style={styles.priceCopy}>
        <Text style={styles.price}>{plan.price}</Text>
        <Caption>{plan.cadence}</Caption>
      </View>
    </Pressable>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <Text style={styles.tick}>✓</Text>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function Paso({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View style={styles.pasoRow}>
      <Text style={styles.pasoN}>{n}</Text>
      <View style={styles.pasoCopy}>
        <Text style={styles.pasoTitle}>{title}</Text>
        <Caption>{body}</Caption>
      </View>
    </View>
  );
}

function primaryLabel({
  action,
  primary,
  entitlementResolved,
  trial,
  phase
}: {
  action: ActionPhase;
  primary: NativePrimaryAction;
  entitlementResolved: boolean;
  trial: NativeStoreTrial | null;
  phase: ReturnType<typeof useRevenueCat>["phase"];
}): string {
  if (action === "purchasing") return "Confirmando tu compra…";
  if (action === "restoring") return "Restaurando…";
  if (primary === "leave") return "Entrar a mi carta";
  if (primary === "restore") return "Restaurar mi compra";
  if (primary === "purchase") {
    return trial ? `Empezar ${trial.label}` : "Desbloquear Órbita Plus";
  }
  if (!entitlementResolved) return "Cargando tu plan…";
  if (phase === "unavailable") return "Compras no disponibles";
  if (phase === "no_offering") return "Sin oferta disponible";
  if (phase === "error") return "No pudimos cargar la oferta";
  return "Preparando la oferta…";
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 190, paddingHorizontal: GUTTER },
  nav: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 52 },
  navButton: { alignItems: "flex-start", justifyContent: "center", minHeight: 44, minWidth: 44 },
  restoreButton: { alignItems: "flex-end", justifyContent: "center", minHeight: 44, minWidth: 88 },
  chevron: { color: orbita.bone, fontFamily: font.sans, fontSize: 34, lineHeight: 38 },
  restore: { color: orbita.boneSoft, fontFamily: font.sansMed, fontSize: 14, textDecorationLine: "underline" },
  dimmed: { opacity: 0.45 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 8 },
  brand: { color: orbita.bone, fontFamily: font.serif, fontSize: 26 },
  plusBadge: { backgroundColor: orbita.copper, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  plusText: { color: orbita.ink, fontFamily: font.sansBold, fontSize: 10, letterSpacing: 1 },
  eyebrow: { marginTop: 30 },
  hero: { color: orbita.bone, fontFamily: font.serif, fontSize: 39, lineHeight: 43, marginTop: 12 },
  sub: { marginTop: 12 },
  planCard: {
    backgroundColor: "rgba(18,20,26,0.9)",
    borderColor: orbita.lineStrong,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 26,
    overflow: "hidden"
  },
  planRow: { alignItems: "center", flexDirection: "row", minHeight: 78, paddingHorizontal: 16, paddingVertical: 14 },
  planDivider: { backgroundColor: orbita.line, height: 1, marginHorizontal: 16 },
  radio: { alignItems: "center", borderColor: orbita.lineStrong, borderRadius: 10, borderWidth: 1, height: 20, justifyContent: "center", width: 20 },
  radioSelected: { borderColor: orbita.copperSoft },
  radioDot: { backgroundColor: orbita.copperSoft, borderRadius: 5, height: 10, width: 10 },
  planCopy: { flex: 1, marginLeft: 12 },
  trialBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(196,106,58,0.18)",
    borderColor: orbita.copper,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  trialText: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 10, letterSpacing: 0.7 },
  planLabel: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15 },
  priceCopy: { alignItems: "flex-end", marginLeft: 12 },
  price: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 17 },
  statusCard: { backgroundColor: "rgba(18,20,26,0.9)", borderColor: orbita.lineStrong, borderRadius: 18, borderWidth: 1, marginTop: 26, padding: 18 },
  statusTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15, lineHeight: 21 },
  statusBody: { marginTop: 8 },
  inlineAction: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44, paddingTop: 10 },
  inlineActionText: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 12, letterSpacing: 0.8, textDecorationLine: "underline" },
  benefitsCard: { backgroundColor: "rgba(18,20,26,0.78)", borderColor: orbita.line, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 18 },
  stepsCard: { backgroundColor: "rgba(18,20,26,0.6)", borderColor: orbita.line, borderRadius: 18, borderWidth: 1, marginTop: 14, padding: 18 },
  sectionTitle: { color: orbita.bone, fontFamily: font.serif, fontSize: 22, marginBottom: 8 },
  benefitRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, marginTop: 11 },
  tick: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 14 },
  benefitText: { color: orbita.boneSoft, flex: 1, fontFamily: font.sans, fontSize: 14, lineHeight: 20 },
  pasoRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  pasoN: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 12, lineHeight: 20 },
  pasoCopy: { flex: 1, gap: 2 },
  pasoTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 14, lineHeight: 20 },
  notice: { color: orbita.boneSoft, marginTop: 16 },
  legal: { marginTop: 24 },
  legalLinks: { alignItems: "center", flexDirection: "row", gap: 9, marginTop: 10 },
  legalLink: { color: orbita.copperSoft, fontFamily: font.sansMed, fontSize: 12, textDecorationLine: "underline" },
  legalDot: { color: orbita.faint, fontFamily: font.sans, fontSize: 12 },
  footer: { backgroundColor: "rgba(10,11,14,0.96)", borderTopColor: orbita.line, borderTopWidth: 1, bottom: 0, left: 0, paddingBottom: 12, paddingHorizontal: GUTTER, paddingTop: 14, position: "absolute", right: 0 },
  freeButton: { alignItems: "center", justifyContent: "center", marginTop: 6, minHeight: 44 },
  freeText: { color: orbita.boneSoft, fontFamily: font.sansBold, fontSize: 13, letterSpacing: 0.4, textDecorationLine: "underline" }
});
