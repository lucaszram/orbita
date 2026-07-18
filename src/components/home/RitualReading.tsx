import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DailyRitual } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/** La lectura de la carta, después de "Te salió {carta}." y el tag de orientación.
 *  Orden canónico del Figma (sección 14, `727:127`), SIN ocultar secciones vacías:
 *
 *    esencia → SIGNIFICADO GENERAL (3 facetas) → EN TU DÍA → EL CONSEJO → cierre + Umbral
 *
 *  Compartida por la Home (`CartaDelDia`) y el archivo del Diario. El caller garantiza
 *  un ritual completo (`isRitualComplete`) antes de renderizar. */
export function RitualReading({ ritual }: { ritual: DailyRitual }) {
  return (
    <View>
      <Text style={styles.esencia}>{ritual.esencia}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>SIGNIFICADO GENERAL</Text>
        {ritual.significadoGeneral.map((f) => (
          <Text key={f.titulo} style={styles.facet}>
            <Text style={styles.facetTitulo}>{f.titulo}</Text>
            {" — "}
            {f.texto}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>EN TU DÍA</Text>
        <Text style={styles.body}>{ritual.enTuDia}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>EL CONSEJO</Text>
        <Text style={styles.body}>{ritual.consejo}</Text>
      </View>

      <View style={styles.close}>
        <Text style={styles.pregunta}>{ritual.cierre.pregunta}</Text>
        <Pressable
          onPress={() => router.push("/vacio")}
          accessibilityRole="button"
          accessibilityLabel="Preguntarle al Umbral"
          hitSlop={8}
        >
          <Text style={styles.umbral}>PREGUNTARLE AL UMBRAL ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  esencia: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: orbita.spacing.md
  },
  section: { marginTop: orbita.spacing.lg },
  label: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: orbita.spacing.sm
  },
  facet: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: orbita.spacing.sm
  },
  facetTitulo: { color: orbita.colors.bone },
  body: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 22 },
  close: {
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    marginTop: orbita.spacing.xl,
    paddingTop: orbita.spacing.lg
  },
  pregunta: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 18, lineHeight: 25 },
  umbral: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: orbita.spacing.md
  }
});
