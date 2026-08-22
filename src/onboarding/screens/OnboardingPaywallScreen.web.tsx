import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useEntitlement } from "@/hooks/useLiveApp";
import {
  checkoutStartErrorKind,
  formatPlanPrice,
  monthlyPlan,
  offerPhase,
  planIntervalLabel,
  planTrialLabel,
  type WebOffer
} from "@/domain/paywall";
import { proposedApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Screen } from "../components/Screen";
import { Body, Caption, Eyebrow } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

/**
 * 11 — Paywall del onboarding, variante WEB: el comercio real acá es STRIPE.
 *
 * Mismo contenido aprobado que la variante nativa (hero "Tu cielo, todos los
 * días.", qué incluye, cómo te acompaña, disclosure) y el circuito web
 * existente: la oferta y sus importes salen de `payments.getWebOffer` (Stripe;
 * el cliente no escribe un solo precio) y el CTA crea UNA sesión de Checkout
 * (`createCheckoutSession`) y redirige al pago seguro. Con el comercio web
 * apagado o sin plan, la compra no se ofrece — pero el camino aprobado de
 * "Seguir gratis" se conserva SIEMPRE: la paywall nunca se reemplaza por una
 * pantalla de carga.
 *
 * "Seguir gratis" (y "Entrar a mi carta" con Plus ya activo) mantienen esta
 * pantalla visible hasta `router.replace(CARTA_TAB_ROUTE)` en el flujo. Ningún
 * camino navega a la ruta `/paywall` ni a `/recepcion`.
 */
type Props = {
  /** Salida única del onboarding: la Carta de la última pestaña. */
  onEnterCarta: () => void;
  onBack: () => void;
  /** La salida a Carta falló en este navegador; los datos están a salvo. */
  entryFailed: boolean;
  /** Inspección visual (`debugStep`/preview): sin oferta remota ni checkout. */
  inspect?: boolean;
};

const HAS_BACKEND = backendConfig.hasConvex && backendConfig.hasClerk;

export function OnboardingPaywallScreen(props: Props) {
  // Sin backend configurado no hay hooks de Convex que montar: el contenido
  // aprobado se muestra igual, con "Seguir gratis" como única salida.
  if (!HAS_BACKEND || props.inspect) return <PaywallContent {...props} commerce={null} />;
  return <PaywallWithStripe {...props} />;
}

type StripeCommerce = {
  phase: "cargando" | "error" | "proximamente" | "disponible" | "abriendo";
  priceLabel: string | null;
  trialLabel: string | null;
  isPro: boolean;
  entitlementResolved: boolean;
  notice: string | null;
  onBuy: () => void;
  onRetryOffer: () => void;
};

function PaywallWithStripe(props: Props) {
  const { remote: entitlement, resolved: entitlementResolved } = useEntitlement();
  const getWebOffer = useAction(proposedApi.getWebOffer);
  const createCheckout = useAction(proposedApi.createCheckoutSession);
  const [offer, setOffer] = useState<WebOffer | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [offerTick, setOfferTick] = useState(0);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Cada toque crea una sesión de pago REAL: el guard es sincrónico, como en
  // el lanzador `/paywall` (un estado de React llega tarde para el doble tap).
  const checkoutLock = useRef(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setOffer(undefined);
    getWebOffer({})
      .then((value) => {
        if (alive) setOffer(value as WebOffer);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [getWebOffer, offerTick]);

  const phase = offerPhase({ offer, failed });
  const plan = offer ? monthlyPlan(offer.plans) : null;

  const onBuy = () => {
    if (checkoutLock.current || phase !== "disponible") return;
    checkoutLock.current = true;
    setOpening(true);
    setNotice(null);
    createCheckout({ plan: "monthly" })
      .then(({ url }: { url: string }) => {
        // Se abre EXCLUSIVAMENTE la URL que devolvió el backend. `replace`:
        // Atrás desde Stripe no debe volver a crear otra sesión.
        if (typeof window !== "undefined") window.location.replace(url);
      })
      .catch((err: unknown) => {
        checkoutLock.current = false;
        setOpening(false);
        setNotice(
          checkoutStartErrorKind(err) === "ya_plus"
            ? "Ya tenés Órbita Plus: entrá a tu carta."
            : "No pudimos abrir el pago. No se generó ningún cobro; probá de nuevo."
        );
      });
  };

  return (
    <PaywallContent
      {...props}
      commerce={{
        phase: opening ? "abriendo" : phase,
        priceLabel: plan ? `${formatPlanPrice(plan)} ${planIntervalLabel(plan)}` : null,
        trialLabel: plan ? planTrialLabel(plan) : null,
        isPro: entitlement?.isPro === true,
        entitlementResolved,
        notice,
        onBuy,
        onRetryOffer: () => setOfferTick((t) => t + 1)
      }}
    />
  );
}

function PaywallContent({
  onEnterCarta,
  onBack,
  entryFailed,
  commerce
}: Props & { commerce: StripeCommerce | null }) {
  const router = useRouter();
  const isPro = commerce?.isPro === true;
  const phase = commerce?.phase ?? "proximamente";

  const primaryLabel = isPro
    ? "Entrar a mi carta"
    : phase === "abriendo"
      ? "Abriendo el pago seguro…"
      : phase === "disponible"
        ? (commerce?.trialLabel ? `Empezar ${commerce.trialLabel}` : "Desbloquear Órbita Plus")
        : phase === "cargando"
          ? "Cargando tu oferta…"
          : phase === "error"
            ? "No pudimos cargar la oferta"
            : "Compras disponibles pronto";
  const primaryEnabled = isPro || phase === "disponible";

  return (
    <Screen bg={A.paymentBg} bgOpacity={0.9} wash={0.64}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.nav}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Volver">
            <Text style={styles.chevron}>‹</Text>
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

        {isPro ? (
          <View style={styles.statusCard} accessibilityLiveRegion="polite">
            <Text style={styles.statusTitle}>Órbita Plus ya está activo en tu cuenta.</Text>
            <Body style={styles.statusBody}>Entrá a tu carta: no hay nada que comprar.</Body>
          </View>
        ) : phase === "disponible" && commerce?.priceLabel ? (
          <View style={styles.planCard} accessible accessibilityLabel={`Órbita Plus mensual, ${commerce.priceLabel}`}>
            <View style={styles.planCopy}>
              <Text style={styles.planLabel}>Órbita Plus · Mensual</Text>
              {commerce.trialLabel ? (
                <View style={styles.trialBadge}>
                  <Text style={styles.trialText}>{commerce.trialLabel.toUpperCase()}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.price}>{commerce.priceLabel}</Text>
          </View>
        ) : (
          <View style={styles.statusCard} accessibilityLiveRegion="polite">
            <Text style={styles.statusTitle}>
              {phase === "cargando" || phase === "abriendo"
                ? "Cargando los planes…"
                : phase === "error"
                  ? "No pudimos cargar los planes."
                  : "Las compras web están disponibles pronto."}
            </Text>
            {phase === "error" && commerce ? (
              <Pressable onPress={commerce.onRetryOffer} accessibilityRole="button" style={styles.inlineAction}>
                <Text style={styles.inlineActionText}>REINTENTAR</Text>
              </Pressable>
            ) : null}
          </View>
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
            Tus datos quedaron guardados en tu cuenta, pero no pudimos abrir Órbita en este navegador.
            Probá de nuevo desde «Seguir gratis».
          </Caption>
        ) : null}
        {commerce?.notice ? (
          <Caption accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
            {commerce.notice}
          </Caption>
        ) : null}

        <View style={styles.legal}>
          <Caption>
            Suscripción mensual con renovación automática. El precio, la moneda y las condiciones
            finales son los que muestra el pago seguro antes de confirmar. Entretenimiento y
            autoconocimiento.
          </Caption>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => router.push("/terminos")} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.legalLink}>Términos</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => router.push("/privacy")} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.legalLink}>Privacidad</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CTA
          label={primaryLabel}
          onPress={isPro ? onEnterCarta : phase === "disponible" ? commerce?.onBuy : undefined}
          disabled={!primaryEnabled}
        />
        {/* "Seguir gratis": la salida aprobada sin compra, SIEMPRE presente. */}
        <Pressable onPress={onEnterCarta} accessibilityRole="button" style={styles.freeButton}>
          <Text style={styles.freeText}>Seguir gratis</Text>
        </Pressable>
      </View>
    </Screen>
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

const styles = StyleSheet.create({
  scroll: { paddingBottom: 190, paddingHorizontal: GUTTER },
  nav: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 52 },
  navButton: { alignItems: "flex-start", justifyContent: "center", minHeight: 44, minWidth: 44 },
  chevron: { color: orbita.bone, fontFamily: font.sans, fontSize: 34, lineHeight: 38 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 8 },
  brand: { color: orbita.bone, fontFamily: font.serif, fontSize: 26 },
  plusBadge: { backgroundColor: orbita.copper, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  plusText: { color: orbita.ink, fontFamily: font.sansBold, fontSize: 10, letterSpacing: 1 },
  eyebrow: { marginTop: 30 },
  hero: { color: orbita.bone, fontFamily: font.serif, fontSize: 39, lineHeight: 43, marginTop: 12 },
  sub: { marginTop: 12 },
  planCard: {
    alignItems: "center",
    backgroundColor: "rgba(18,20,26,0.9)",
    borderColor: orbita.lineStrong,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 26,
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  planCopy: { flex: 1 },
  planLabel: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 15 },
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
  price: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 17, marginLeft: 12 },
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
