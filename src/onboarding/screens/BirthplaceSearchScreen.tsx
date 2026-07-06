import { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Label, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

// Interim local list — real geocoding autocomplete llega por contrato de backend.
const CITIES = [
  "Buenos Aires, Argentina",
  "Córdoba, Argentina",
  "Rosario, Argentina",
  "Mendoza, Argentina",
  "La Plata, Argentina",
  "Mar del Plata, Argentina",
  "Tucumán, Argentina",
  "Salta, Argentina",
  "Santa Fe, Argentina",
  "Neuquén, Argentina",
  "Bariloche, Argentina",
  "Corrientes, Argentina",
  "Posadas, Argentina",
  "Bahía Blanca, Argentina",
  "San Juan, Argentina",
  "Montevideo, Uruguay",
  "Punta del Este, Uruguay",
  "Santiago, Chile",
  "Valparaíso, Chile",
  "Asunción, Paraguay",
  "La Paz, Bolivia",
  "Santa Cruz, Bolivia",
  "Lima, Perú",
  "Cusco, Perú",
  "Bogotá, Colombia",
  "Medellín, Colombia",
  "Cali, Colombia",
  "Quito, Ecuador",
  "Guayaquil, Ecuador",
  "Caracas, Venezuela",
  "Ciudad de México, México",
  "Guadalajara, México",
  "Monterrey, México",
  "San José, Costa Rica",
  "Ciudad de Panamá, Panamá",
  "La Habana, Cuba",
  "Santo Domingo, República Dominicana",
  "San Juan, Puerto Rico",
  "São Paulo, Brasil",
  "Río de Janeiro, Brasil",
  "Porto Alegre, Brasil",
  "Florianópolis, Brasil",
  "Madrid, España",
  "Barcelona, España",
  "Valencia, España",
  "Sevilla, España",
  "Miami, Estados Unidos",
  "Nueva York, Estados Unidos",
  "Los Ángeles, Estados Unidos",
  "Houston, Estados Unidos",
];

type Props = {
  step: number;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (place: string) => void;
  onBack: () => void;
};

/** 07 — Birthplace search (real input + suggestions; empty / results / no-results states). */
export function BirthplaceSearchScreen({ step, query, onQuery, onSelect, onBack }: Props) {
  const results = useMemo(() => {
    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
    const q = norm(query.trim());
    if (!q) return [];
    return CITIES.filter((c) => norm(c).includes(q)).slice(0, 5);
  }, [query]);

  const showEmpty = query.trim().length === 0;
  const showNoResults = !showEmpty && results.length === 0;

  return (
    <Screen bg={A.dailyTexture} wash={0.52}>
      <Header step={step} total={15} onBack={onBack} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <View style={styles.body}>
          <View style={styles.globe} pointerEvents="none">
            <Emblem source={A.globe} size={150} opacity={0.55} glow={false} />
          </View>

          <Title>¿Dónde naciste?</Title>
          <Body style={styles.sub}>La ciudad ajusta el horizonte de tu carta.</Body>

          <Label style={styles.fieldLabel}>Ciudad</Label>
          <TextInput
            value={query}
            onChangeText={onQuery}
            placeholder="Escribí tu ciudad"
            placeholderTextColor={orbita.faint}
            autoCorrect={false}
            style={styles.input}
          />
          <View style={styles.inputLine} />

          {showEmpty ? (
            <Caption style={styles.hint}>Empezá a escribir para ver ciudades.</Caption>
          ) : showNoResults ? (
            <Caption style={styles.hint}>Sin resultados. Probá con otra ciudad.</Caption>
          ) : (
            results.map((city) => (
              <Pressable key={city} onPress={() => onSelect(city)} style={styles.result}>
                <Text style={styles.resultTxt}>{city}</Text>
                <View style={styles.resultLine} />
              </Pressable>
            ))
          )}

          <View style={styles.spacer} />
          <Caption style={styles.privacy}>
            La usamos para precisar tu carta. Nunca vendemos ni compartimos tus datos.
          </Caption>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  fieldLabel: { marginTop: 40 },
  fill: { flex: 1 },
  globe: { position: "absolute", right: -50, top: 40 },
  hint: { marginTop: 22 },
  input: {
    color: orbita.bone,
    fontFamily: font.serifReg,
    fontSize: 22,
    marginTop: 8,
    paddingVertical: 6,
  },
  inputLine: { backgroundColor: orbita.lineStrong, height: 1, marginTop: 4 },
  privacy: { marginBottom: 20, textAlign: "center" },
  result: { paddingTop: 18 },
  resultLine: { backgroundColor: orbita.line, height: 1, marginTop: 14 },
  resultTxt: { color: orbita.bone, fontFamily: font.sans, fontSize: 16 },
  spacer: { flex: 1, minHeight: 12 },
  sub: { marginTop: 10 },
});
