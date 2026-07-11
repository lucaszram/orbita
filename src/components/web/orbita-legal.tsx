// Páginas legales/soporte para App Store (Support URL + Privacy Policy URL).
// Contenido en español (voseo), sobrio, alineado a los guardrails de Órbita:
// entretenimiento + autoconocimiento, sin claims de destino/salud/dinero/legal.
// NOTA: la política de privacidad es una base honesta sobre lo que hace la app hoy
// (Clerk auth, Convex backend, datos de nacimiento, push, ping de instalación).
// Revisar con criterio legal antes del release público y actualizar si se agregan
// analytics/crash reporting o se activa el paywall (suscripciones).
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { Link } from "expo-router";
import type { StyleProp, TextStyle } from "react-native";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WebNav } from "@/components/web/web-nav";

const SUPPORT_EMAIL = "lucaszramos11@gmail.com";
const LEGAL_NAME = "Lucas Ramos";
const UPDATED = "10 de julio de 2026";

const colors = {
  black: "#07080A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.22)"
};

const FONTS = { Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium };

/** Shell común: nav + columna de lectura + footer con links legales. */
function LegalShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  const [fontsLoaded] = useFonts(FONTS);
  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.copperSoft} />
      </View>
    );
  }
  return (
    <View style={styles.page}>
      <WebNav active="hoy" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.updated}>Última actualización: {UPDATED}</Text>
          <View style={styles.content}>{children}</View>
          <LegalFooter />
        </View>
      </ScrollView>
    </View>
  );
}

function LegalFooter() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerBrand}>Órbita — {LEGAL_NAME}</Text>
      <View style={styles.footerLinks}>
        <Link href="/support" asChild>
          <Pressable>
            <Text style={styles.footerLink}>Soporte</Text>
          </Pressable>
        </Link>
        <Text style={styles.footerDot}>·</Text>
        <Link href="/privacy" asChild>
          <Pressable>
            <Text style={styles.footerLink}>Privacidad</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>
      {children}
    </View>
  );
}

function P({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.paragraph, style]}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>·</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function MailLink() {
  return (
    <Text style={styles.mail} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
      {SUPPORT_EMAIL}
    </Text>
  );
}

// ─── Soporte ──────────────────────────────────────────────────────────────────

export function OrbitaSupport() {
  return (
    <LegalShell eyebrow="Órbita" title="Soporte">
      <Section heading="Contacto">
        <P>
          ¿Necesitás ayuda con Órbita? Escribinos a <MailLink /> y te respondemos lo antes posible,
          normalmente dentro de las 48 horas hábiles.
        </P>
        <P>Responsable: {LEGAL_NAME}.</P>
      </Section>

      <Section heading="Preguntas frecuentes">
        <P style={styles.q}>¿Cómo cambio mis datos de nacimiento?</P>
        <P>
          Podés revisarlos y ajustarlos desde tu perfil dentro de la app. Tu carta natal se recalcula
          con los datos corregidos.
        </P>
        <P style={styles.q}>¿Cómo borro mi cuenta y mis datos?</P>
        <P>
          Escribinos a <MailLink /> desde el email de tu cuenta pidiendo la baja. Eliminamos tu cuenta y
          los datos asociados. También podés cerrar sesión desde la app cuando quieras.
        </P>
        <P style={styles.q}>¿Órbita predice el futuro?</P>
        <P>
          No. Órbita usa la astrología como entretenimiento, autoconocimiento y contexto diario. No damos
          consejo médico, psicológico, legal ni financiero, ni predicciones garantizadas.
        </P>
        <P style={styles.q}>¿Necesito crear una cuenta para usar la app?</P>
        <P>
          No es obligatorio. Podés explorar el contenido sin registrarte; crear una cuenta sirve para
          guardar tu carta y tus lecturas entre dispositivos.
        </P>
      </Section>
    </LegalShell>
  );
}

// ─── Privacidad ───────────────────────────────────────────────────────────────

export function OrbitaPrivacy() {
  return (
    <LegalShell eyebrow="Órbita" title="Política de privacidad">
      <Section heading="Responsable">
        <P>
          El responsable del tratamiento de tus datos en Órbita es {LEGAL_NAME}. Para cualquier consulta
          sobre privacidad, escribinos a <MailLink />.
        </P>
      </Section>

      <Section heading="Qué datos recolectamos">
        <Bullet>Email y datos de cuenta, cuando creás una cuenta (autenticación).</Bullet>
        <Bullet>Fecha, hora y lugar de nacimiento, para calcular tu carta natal y tus tránsitos.</Bullet>
        <Bullet>Datos derivados de esos datos, como tu carta natal y lecturas asociadas.</Bullet>
        <Bullet>Identificadores técnicos de la app o del dispositivo, para sesión y funcionamiento.</Bullet>
        <Bullet>
          Token de notificaciones push, solo si activás las notificaciones, para poder enviártelas.
        </Bullet>
        <Bullet>
          Información de compra o suscripción, si en el futuro activás una suscripción dentro de la app.
        </Bullet>
      </Section>

      <Section heading="Para qué los usamos">
        <Bullet>Hacer funcionar la app y calcular tu carta natal, tránsitos y guía diaria.</Bullet>
        <Bullet>Personalizar tu contenido a partir de tus datos de nacimiento.</Bullet>
        <Bullet>Guardar tu historial y lecturas si tenés cuenta.</Bullet>
        <Bullet>Enviarte notificaciones, solo si las activás.</Bullet>
        <P>No vendemos tus datos ni los usamos para publicidad de terceros.</P>
      </Section>

      <Section heading="Con quién los compartimos">
        <P>
          Compartimos datos únicamente con proveedores que nos ayudan a operar la app, y solo lo necesario
          para ese fin:
        </P>
        <Bullet>Un proveedor de autenticación, para gestionar tu cuenta e inicio de sesión.</Bullet>
        <Bullet>Un proveedor de backend, para guardar y procesar tus datos de forma segura.</Bullet>
        <Bullet>Apple, para la distribución de la app y, si corresponde, las compras.</Bullet>
      </Section>

      <Section heading="Conservación">
        <P>
          Conservamos tus datos mientras tengas una cuenta activa o mientras sean necesarios para prestar
          el servicio. Si pedís la baja, los eliminamos salvo obligación legal de conservarlos.
        </P>
      </Section>

      <Section heading="Tus derechos">
        <P>
          Podés pedir acceso, corrección o eliminación de tus datos, o retirar tu consentimiento, en
          cualquier momento. Para ejercerlos, escribinos a <MailLink /> desde el email de tu cuenta.
        </P>
      </Section>

      <Section heading="Menores">
        <P>
          Órbita no está dirigida a menores de 13 años y no recolectamos de forma consciente datos de
          menores de esa edad.
        </P>
      </Section>

      <Section heading="Cambios a esta política">
        <P>
          Podemos actualizar esta política. Cuando haya cambios relevantes, actualizamos la fecha de arriba
          y, si corresponde, te avisamos dentro de la app.
        </P>
      </Section>

      <Section heading="Naturaleza del servicio">
        <P>
          Órbita usa la astrología como entretenimiento, autoconocimiento y contexto diario. No reemplaza
          asesoramiento profesional médico, psicológico, legal ni financiero.
        </P>
      </Section>
    </LegalShell>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.black, flex: 1 },
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center" },
  scroll: { alignItems: "center", paddingBottom: 96, paddingHorizontal: 24, paddingTop: 8 },
  column: { maxWidth: 680, width: "100%" },
  eyebrow: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1.2,
    marginTop: 40,
    textTransform: "uppercase"
  },
  title: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 40, lineHeight: 46, marginTop: 12 },
  updated: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 12 },
  content: { marginTop: 12 },
  section: { marginTop: 32 },
  heading: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 10 },
  paragraph: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 25, marginTop: 8 },
  q: { color: colors.bone, fontFamily: "Inter_500Medium", marginTop: 18 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  bulletDot: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 16, lineHeight: 25 },
  bulletText: { color: colors.boneMuted, flex: 1, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 25 },
  mail: { color: colors.copperSoft, fontFamily: "Inter_500Medium" },
  footer: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 56, paddingTop: 24 },
  footerBrand: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 14 },
  footerLinks: { alignItems: "center", flexDirection: "row", gap: 12, marginTop: 10 },
  footerLink: { color: colors.copperSoft, fontFamily: "Inter_500Medium", fontSize: 14 },
  footerDot: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 14 }
});
