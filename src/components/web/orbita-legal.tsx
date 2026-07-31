// Páginas legales/soporte públicas (Support URL + Privacy Policy URL + Términos).
// Contenido en español (voseo), sobrio, alineado a los guardrails de Órbita:
// entretenimiento + autoconocimiento, sin claims de destino/salud/dinero/legal.
// NOTA: la política de privacidad nombra a los proveedores reales que hoy tocan
// datos (Clerk + Google para autenticación, Convex para backend, Stripe para el
// pago web, Apple para la distribución de la app). Revisar con criterio legal
// antes del release público y actualizar si se agregan analytics/crash reporting.
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { Link } from "expo-router";
import type { StyleProp, TextStyle } from "react-native";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WebLayoutProvider } from "@/components/web/web-layout-provider";
import { WebNav } from "@/components/web/web-nav";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/domain/support";

const LEGAL_NAME = "Lucas Ramos";
const UPDATED = "31 de julio de 2026";

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
  // Mismo motivo que `/iniciar-sesion` y `/editar-datos`: Soporte, Privacidad y
  // Términos montan `WebNav` fuera de `WebAppShell`, así que sin este provider
  // `useIsDesktop()` es siempre `false` y la barra de escritorio nunca aparece.
  return (
    <WebLayoutProvider>
      <View style={styles.page}>
        <WebNav active="inicio" />
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
    </WebLayoutProvider>
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
        <Text style={styles.footerDot}>·</Text>
        <Link href="/terminos" asChild>
          <Pressable>
            <Text style={styles.footerLink}>Términos</Text>
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
    <Text style={styles.mail} onPress={() => Linking.openURL(SUPPORT_MAILTO)}>
      {SUPPORT_EMAIL}
    </Text>
  );
}

/** Referencia en línea a los Términos, dentro del mismo sistema legal. */
function TermsLink() {
  return (
    <Link href="/terminos" asChild>
      <Text style={styles.mail}>los Términos y condiciones</Text>
    </Link>
  );
}

// ─── Soporte ──────────────────────────────────────────────────────────────────

export function OrbitaSupport() {
  return (
    <LegalShell eyebrow="Órbita" title="Soporte">
      <Section heading="Contacto">
        <P>
          ¿Necesitás ayuda con Órbita? Escribinos a <MailLink /> y te respondemos lo antes posible,
          normalmente dentro de las 48 horas hábiles. Ese correo es una vía de ayuda: las acciones sobre
          tu cuenta —incluida la eliminación— las hacés vos desde tu perfil.
        </P>
        <P>Responsable: {LEGAL_NAME}.</P>
      </Section>

      <Section heading="Preguntas frecuentes">
        <P style={styles.q}>¿Necesito una cuenta para usar Órbita?</P>
        <P>
          Sí. Órbita se arma con tu fecha, hora y lugar de nacimiento, así que hace falta una cuenta para
          calcular y guardar tu carta y tus lecturas. Podés crearla antes de terminar el recorrido de alta.
        </P>
        <P style={styles.q}>¿Cómo cambio mis datos de nacimiento?</P>
        <P>
          Podés revisarlos y ajustarlos desde tu perfil. Tu carta natal se recalcula con los datos
          corregidos.
        </P>
        <P style={styles.q}>¿Cómo elimino mi cuenta y mis datos?</P>
        <P>
          Desde tu perfil, con la opción “Eliminar mi cuenta”. Se borran tu cuenta y los datos asociados
          —carta, lecturas e historial— sin que tengas que pedírnoslo por mail. Si algo falla o no podés
          entrar a tu cuenta, escribinos a <MailLink /> desde el email de tu cuenta y te ayudamos.
        </P>
        <P style={styles.q}>¿Cómo cancelo mi suscripción?</P>
        <P>
          También desde tu perfil. La suscripción se renueva sola hasta que la cancelés, y al cancelar
          conservás el acceso hasta el final del período que ya pagaste. Ver{" "}
          <TermsLink />.
        </P>
        <P style={styles.q}>¿Órbita predice el futuro?</P>
        <P>
          No. Órbita usa la astrología como entretenimiento, autoconocimiento y contexto diario. No damos
          consejo médico, psicológico, legal ni financiero, ni predicciones garantizadas.
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
          Compartimos datos únicamente con los proveedores que nos ayudan a operar Órbita, y solo lo
          necesario para ese fin:
        </P>
        <Bullet>
          <Text style={styles.provider}>Clerk</Text> — autenticación y gestión de tu cuenta (email y
          datos de sesión).
        </Bullet>
        <Bullet>
          <Text style={styles.provider}>Google</Text> — solo si elegís entrar con tu cuenta de Google:
          recibimos de Google tu email y el identificador de esa cuenta para crear o vincular la tuya.
        </Bullet>
        <Bullet>
          <Text style={styles.provider}>Convex</Text> — backend y base de datos: ahí se guardan y
          procesan tus datos de nacimiento, tu carta y tus lecturas.
        </Bullet>
        <Bullet>
          <Text style={styles.provider}>Stripe</Text> — pagos en la web, si contratás una suscripción.
          Los datos de tu tarjeta los procesa Stripe; Órbita no los ve ni los guarda.
        </Bullet>
        <Bullet>
          <Text style={styles.provider}>Apple</Text> — distribución de la app y, si corresponde, las
          compras hechas dentro de la app.
        </Bullet>
        <P>
          Cada uno trata los datos según sus propias políticas y puede procesarlos fuera de tu país.
        </P>
      </Section>

      <Section heading="Conservación">
        <P>
          Conservamos tus datos mientras tengas una cuenta activa o mientras sean necesarios para prestar
          el servicio. Si pedís la baja, los eliminamos salvo obligación legal de conservarlos.
        </P>
      </Section>

      <Section heading="Tus derechos">
        <P>
          Podés eliminar tu cuenta y los datos asociados vos mismo, desde tu perfil, con la opción
          “Eliminar mi cuenta”. También podés corregir tus datos de nacimiento desde ahí.
        </P>
        <P>
          Para cualquier otro pedido —acceso, portabilidad o retirar tu consentimiento— escribinos a{" "}
          <MailLink /> desde el email de tu cuenta.
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

// ─── Términos y condiciones ───────────────────────────────────────────────────

export function OrbitaTerms() {
  return (
    <LegalShell eyebrow="Órbita" title="Términos y condiciones">
      <Section heading="Qué es Órbita">
        <P>
          Órbita es una app de astrología pensada como entretenimiento, autoconocimiento y contexto
          diario. Calculamos tu carta natal y tus tránsitos a partir de tu fecha, hora y lugar de
          nacimiento, y los usamos para darte una lectura escrita.
        </P>
        <P>
          Usar Órbita implica aceptar estos términos. El responsable del servicio es {LEGAL_NAME}.
        </P>
      </Section>

      <Section heading="Tu cuenta">
        <P>
          Para usar Órbita necesitás una cuenta: sin tus datos de nacimiento no hay carta que leer.
          Sos responsable de la veracidad de esos datos y del cuidado de tus credenciales. Podés
          eliminar tu cuenta cuando quieras desde tu perfil.
        </P>
      </Section>

      <Section heading="Suscripción a Órbita Plus">
        <P>
          Órbita tiene una parte gratuita y una suscripción paga, Órbita Plus. Los precios, la moneda y
          la duración de cada plan se muestran antes de confirmar la compra, y son los que rigen.
        </P>
        <Bullet>
          Las suscripciones se <Text style={styles.provider}>renuevan automáticamente</Text> al final de
          cada período —semana o año, según el plan— hasta que las canceles.
        </Bullet>
        <Bullet>
          El plan anual incluye <Text style={styles.provider}>tres días de prueba</Text> gratis. Si no
          cancelás antes de que termine la prueba, se cobra el primer año.
        </Bullet>
        <Bullet>
          El plan semanal <Text style={styles.provider}>no tiene período de prueba</Text>: se cobra al
          contratarlo.
        </Bullet>
        <P>
          En la web el pago lo procesa Stripe. Si contratás desde la app, el cobro y la renovación los
          gestiona la tienda correspondiente según sus propias reglas.
        </P>
      </Section>

      <Section heading="Cancelación">
        <P>
          Podés cancelar cuando quieras <Text style={styles.provider}>desde tu perfil</Text>, en
          “Gestionar suscripción”. No hace falta escribirnos ni dar explicaciones.
        </P>
        <P>
          Al cancelar, la renovación se detiene y{" "}
          <Text style={styles.provider}>conservás el acceso a Órbita Plus hasta el final del período
          que ya pagaste</Text>. Después de esa fecha tu cuenta sigue existiendo con las funciones
          gratuitas.
        </P>
      </Section>

      <Section heading="Reembolsos">
        <P>
          Los reembolsos se rigen por la normativa aplicable, incluidos los derechos que te da la ley de
          defensa del consumidor de tu jurisdicción. Si creés que corresponde uno, escribinos a{" "}
          <MailLink /> desde el email de tu cuenta y lo revisamos. Las compras hechas dentro de la app se
          reembolsan según las políticas de la tienda que las procesó.
        </P>
      </Section>

      <Section heading="Naturaleza del servicio">
        <P>
          Órbita es entretenimiento, autoconocimiento y contexto diario.{" "}
          <Text style={styles.provider}>No es asesoramiento médico, psicológico, legal ni financiero, ni
          una predicción garantizada</Text>. No tomes decisiones de salud, dinero o vida legal basándote
          en lo que leas acá: para eso consultá a un profesional.
        </P>
        <P>
          El contenido se genera de forma automática a partir de tu carta y puede contener errores.
          Ofrecemos el servicio tal como está y hacemos lo posible por mantenerlo disponible, sin
          garantizar que esté libre de interrupciones.
        </P>
      </Section>

      <Section heading="Uso del servicio">
        <P>
          Órbita es para tu uso personal. No se puede revender, redistribuir masivamente ni usar de forma
          automatizada su contenido, ni intentar vulnerar la seguridad del servicio o las cuentas de
          otras personas.
        </P>
      </Section>

      <Section heading="Cambios en estos términos">
        <P>
          Podemos actualizar estos términos. Cuando el cambio sea relevante actualizamos la fecha de
          arriba y, si corresponde, te avisamos dentro de la app. Los cambios de precio no afectan un
          período ya pagado.
        </P>
      </Section>

      <Section heading="Contacto">
        <P>
          Escribinos a <MailLink /> por cualquier consulta sobre estos términos, tu suscripción o tu
          cuenta.
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
  // Énfasis dentro de un párrafo legal: hereda color/tamaño del bloque y sólo
  // sube el peso. Un color distinto acá leería como link y no lo es.
  provider: { color: colors.bone, fontFamily: "Inter_500Medium" },
  footer: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 56, paddingTop: 24 },
  footerBrand: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 14 },
  footerLinks: { alignItems: "center", flexDirection: "row", gap: 12, marginTop: 10 },
  footerLink: { color: colors.copperSoft, fontFamily: "Inter_500Medium", fontSize: 14 },
  footerDot: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 14 }
});
