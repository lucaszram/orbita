import { useEffect, useRef, useState } from "react";
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

export type PlaceOption = {
  label: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

// Fallback offline (si el geocoding no responde).
const FALLBACK_CITIES = [
  "Buenos Aires, Argentina",
  "Córdoba, Argentina",
  "Rosario, Argentina",
  "Mendoza, Argentina",
  "Montevideo, Uruguay",
  "Santiago, Chile",
  "Lima, Perú",
  "Bogotá, Colombia",
  "Ciudad de México, México",
  "Madrid, España",
  "Barcelona, España",
  "Miami, Estados Unidos",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function fallbackResults(query: string): PlaceOption[] {
  const q = norm(query.trim());
  if (!q) return [];
  return FALLBACK_CITIES.filter((c) => norm(c).includes(q))
    .slice(0, 5)
    .map((label) => ({ label }));
}

/** Geocoding real: Open-Meteo (gratis, sin key). Devuelve ciudad + país + coords + timezone. */
async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceOption[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=es&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ name: string; country?: string; admin1?: string; latitude: number; longitude: number; timezone?: string }>;
  };
  return (data.results ?? []).map((r) => {
    const parts = [r.name];
    if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
    if (r.country) parts.push(r.country);
    return {
      label: parts.join(", "),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
    };
  });
}

type Props = {
  step: number;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (place: PlaceOption) => void;
  onBack: () => void;
};

/** 07 — Birthplace search: autocomplete real con estados empty/buscando/resultados/sin-resultados. */
export function BirthplaceSearchScreen({ step, query, onQuery, onSelect, onBack }: Props) {
  const [results, setResults] = useState<PlaceOption[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    const controller = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const places = await searchPlaces(q, controller.signal);
        if (requestId.current === id) setResults(places);
      } catch {
        if (requestId.current === id) setResults(fallbackResults(q));
      } finally {
        if (requestId.current === id) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const showEmpty = query.trim().length < 2;
  const showNoResults = !showEmpty && !searching && results.length === 0;

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
          ) : searching && results.length === 0 ? (
            <Caption style={styles.hint}>Buscando…</Caption>
          ) : showNoResults ? (
            <Caption style={styles.hint}>Sin resultados. Probá agregando el país o con otra ciudad.</Caption>
          ) : (
            results.map((place) => (
              <Pressable key={place.label} onPress={() => onSelect(place)} style={styles.result}>
                <Text style={styles.resultTxt}>{place.label}</Text>
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
