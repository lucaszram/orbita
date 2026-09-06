import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from "react-native";

import { Text } from "@/components/ui/text";
import { isFutureDateParts, isRealDateParts } from "@/domain/birthInput";
import { type PlaceHit, searchPlaces } from "@/services/geocoding";

import { A } from "../assets";
import { BirthDatePicker, BirthTimePicker } from "../components/BirthPicker";
import { CTA } from "../components/CTA";
import { Emblem } from "../components/Emblem";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Label, Title } from "../components/Type";
import { ONBOARDING_TOTAL } from "../steps";
import { font, GUTTER, orbita } from "../theme";
import type { BirthDateParts } from "./BirthdateScreen";
import type { PlaceOption } from "./BirthplaceSearchScreen";
import type { BirthTime } from "./BirthTimeScreen";

/**
 * 08 — "Estos son tus datos": el ÚNICO resumen de los datos natales.
 *
 * Reemplaza a las confirmaciones sueltas de fecha, lugar y hora: cada fila abre
 * su selector como una hoja SOBRE esta misma pantalla, y al guardar o cancelar
 * se vuelve al resumen (con el foco devuelto a la fila que lo abrió). El Sol se
 * deriva de la fecha y se muestra acá — no ocupa una pantalla propia.
 *
 * El CTA exacto es "Preparar mi carta": persiste los datos natales antes de
 * iniciar la generación completa. Un fallo de guardado se dice acá mismo, con
 * reintento, sin perder nada de lo cargado.
 */

type SheetKind = "fecha" | "lugar" | "hora" | null;

type Props = {
  step: number;
  dateValue: BirthDateParts;
  onDate: (v: BirthDateParts) => void;
  timeValue: BirthTime;
  timeUnknown: boolean;
  onTime: (v: BirthTime, unknown: boolean) => void;
  place: PlaceOption | undefined;
  onPlace: (p: PlaceOption) => void;
  /** Signo solar derivado de la fecha (fila "SOL · Derivado"). */
  sunSign: string;
  dateLabel: string;
  timeLabel: string;
  placeLabel: string;
  saving: boolean;
  saveError: string | null;
  onPrepare: () => void;
  onBack: () => void;
};

export function BirthSummaryScreen({
  step,
  dateValue,
  onDate,
  timeValue,
  timeUnknown,
  onTime,
  place,
  onPlace,
  sunSign,
  dateLabel,
  timeLabel,
  placeLabel,
  saving,
  saveError,
  onPrepare,
  onBack
}: Props) {
  const [sheet, setSheet] = useState<SheetKind>(null);
  // Retorno de foco: la fila que abrió la hoja lo recupera al cerrarla.
  const rowRefs = {
    fecha: useRef<View>(null),
    lugar: useRef<View>(null),
    hora: useRef<View>(null)
  };

  const cerrar = (kind: Exclude<SheetKind, null>) => {
    setSheet(null);
    const node = rowRefs[kind].current;
    if (!node) return;
    if (Platform.OS === "web") {
      (node as unknown as { focus?: () => void }).focus?.();
      return;
    }
    const handle = findNodeHandle(node);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  };

  return (
    <Screen bg={A.transitsBg} bgOpacity={0.85} wash={0.6}>
      <Header step={step} total={ONBOARDING_TOTAL} onBack={onBack} />
      <View style={styles.body}>
        <Title>Estos son tus datos.</Title>
        <Body style={styles.sub}>Revisá y editá antes de calcular.</Body>

        <View style={styles.emblemZone} pointerEvents="none">
          <Emblem source={A.chartDiagram} size={200} opacity={0.6} />
        </View>

        <View style={styles.rows}>
          <SummaryRow
            refBox={rowRefs.fecha}
            label="Fecha"
            value={dateLabel}
            action="Editar"
            accessibilityLabel={`Fecha de nacimiento: ${dateLabel}`}
            accessibilityHint="Abre el selector de fecha sobre esta pantalla"
            onPress={() => setSheet("fecha")}
          />
          <SummaryRow
            refBox={rowRefs.lugar}
            label="Lugar"
            value={placeLabel}
            action="Editar"
            accessibilityLabel={`Lugar de nacimiento: ${placeLabel}`}
            accessibilityHint="Abre el buscador de ciudad sobre esta pantalla"
            onPress={() => setSheet("lugar")}
          />
          <SummaryRow
            refBox={rowRefs.hora}
            label="Hora"
            value={timeLabel}
            action="Editar"
            accessibilityLabel={`Hora de nacimiento: ${timeLabel}`}
            accessibilityHint="Abre el selector de hora sobre esta pantalla"
            onPress={() => setSheet("hora")}
          />
          {/* El Sol es un DERIVADO de la fecha: se muestra, no se edita. */}
          <SummaryRow label="Sol" value={sunSign} action="Derivado" />
        </View>

        {saveError ? (
          <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {saveError}
          </Body>
        ) : null}

        <View style={styles.spacer} />
        <Caption style={styles.note}>Podés editar cualquier dato antes de calcular.</Caption>
        <View style={styles.footer}>
          <CTA
            label={saving ? "Guardando tus datos…" : "Preparar mi carta"}
            onPress={saving ? undefined : onPrepare}
            disabled={saving}
          />
        </View>
      </View>

      {sheet === "fecha" ? (
        <DateSheet value={dateValue} onSave={onDate} onClose={() => cerrar("fecha")} />
      ) : null}
      {sheet === "lugar" ? (
        <PlaceSheet current={place} onSave={onPlace} onClose={() => cerrar("lugar")} />
      ) : null}
      {sheet === "hora" ? (
        <TimeSheet
          value={timeValue}
          unknown={timeUnknown}
          onSave={onTime}
          onClose={() => cerrar("hora")}
        />
      ) : null}
    </Screen>
  );
}

function SummaryRow({
  refBox,
  label,
  value,
  action,
  onPress,
  accessibilityLabel,
  accessibilityHint
}: {
  refBox?: React.RefObject<View | null>;
  label: string;
  value: string;
  action: "Editar" | "Derivado";
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const editable = Boolean(onPress);
  const content = (
    <>
      <Label style={styles.rowLabel}>{label}</Label>
      <Text style={styles.rowValue}>{value}</Text>
      <Text style={[styles.rowAction, !editable && styles.rowActionMuted]}>{action}</Text>
    </>
  );
  if (!editable) {
    return (
      <View accessible accessibilityLabel={`${label}: ${value}. Derivado de tu fecha.`} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      ref={refBox}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={styles.row}
    >
      {content}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Hojas de edición: viven SOBRE el resumen; guardar o cancelar vuelve a él.
// ---------------------------------------------------------------------------

function Sheet({
  title,
  children,
  onSave,
  onClose,
  saveDisabled
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  onClose: () => void;
  saveDisabled?: boolean;
}) {
  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cerrar sin guardar"
        style={styles.scrim}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {title}
        </Text>
        {children}
        <View style={styles.sheetFooter}>
          <CTA label="Guardar" onPress={saveDisabled ? undefined : onSave} disabled={saveDisabled} />
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancelRow}>
            <Text style={styles.cancelTxt}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function DateSheet({
  value,
  onSave,
  onClose
}: {
  value: BirthDateParts;
  onSave: (v: BirthDateParts) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const real = isRealDateParts(draft);
  const future = isFutureDateParts(draft, new Date());
  const usable = real && !future;
  return (
    <Sheet
      title="Editar fecha"
      onClose={onClose}
      saveDisabled={!usable}
      onSave={() => {
        onSave(draft);
        onClose();
      }}
    >
      {usable ? null : (
        <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.sheetInvalid}>
          {future
            ? "Esa fecha todavía no llegó. Elegí tu fecha de nacimiento."
            : "Ese día no existe en el mes que elegiste. Ajustá la fecha para guardar."}
        </Body>
      )}
      <BirthDatePicker value={draft} onChange={setDraft} />
    </Sheet>
  );
}

function TimeSheet({
  value,
  unknown,
  onSave,
  onClose
}: {
  value: BirthTime;
  unknown: boolean;
  onSave: (v: BirthTime, unknown: boolean) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [draftUnknown, setDraftUnknown] = useState(unknown);
  return (
    <Sheet
      title="Editar hora"
      onClose={onClose}
      onSave={() => {
        onSave(draft, draftUnknown);
        onClose();
      }}
    >
      <BirthTimePicker value={draft} onChange={setDraft} unknown={draftUnknown} />
      <Pressable
        onPress={() => setDraftUnknown((v) => !v)}
        accessibilityRole="switch"
        accessibilityLabel="No sé la hora"
        accessibilityState={{ checked: draftUnknown }}
        style={[styles.unknownCard, draftUnknown && styles.unknownCardOn]}
      >
        <Text style={styles.unknownTxt}>No sé la hora</Text>
        <Text style={styles.unknownSub}>Usamos una carta aproximada.</Text>
      </Pressable>
    </Sheet>
  );
}

function PlaceSheet({
  current,
  onSave,
  onClose
}: {
  current: PlaceOption | undefined;
  onSave: (p: PlaceOption) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlaceOption | undefined>(current);
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
        if (requestId.current === id) setResults([]);
      } finally {
        if (requestId.current === id) setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  return (
    <Sheet
      title="Editar lugar"
      onClose={onClose}
      saveDisabled={!picked}
      onSave={() => {
        if (picked) onSave(picked);
        onClose();
      }}
    >
      <Label style={styles.placeLabel}>Ciudad</Label>
      <TextInput
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Tu ciudad de nacimiento"
        placeholder={picked?.label ?? "Escribí tu ciudad"}
        placeholderTextColor={orbita.faint}
        autoCorrect={false}
        autoFocus
        style={styles.placeInput}
      />
      <View style={styles.placeLine} />
      {searching && results.length === 0 ? (
        <Caption style={styles.placeHint}>Buscando…</Caption>
      ) : (
        results.slice(0, 4).map((placeHit) => (
          <Pressable
            key={placeHit.label}
            onPress={() => setPicked(placeHit)}
            accessibilityRole="button"
            accessibilityState={{ selected: picked?.label === placeHit.label }}
            accessibilityHint="Elegí esta ciudad como tu lugar de nacimiento"
            style={styles.placeResult}
          >
            <Text
              style={[styles.placeResultTxt, picked?.label === placeHit.label && styles.placeResultOn]}
            >
              {placeHit.label}
            </Text>
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 20 },
  sub: { marginTop: 8 },
  emblemZone: { alignItems: "center", marginTop: 6, minHeight: 120 },
  rows: { marginTop: 8 },
  row: {
    alignItems: "center",
    borderBottomColor: orbita.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 46,
    paddingVertical: 6
  },
  rowLabel: { width: 74 },
  rowValue: { color: orbita.boneSoft, flex: 1, fontFamily: font.serif, fontSize: 17 },
  rowAction: { color: orbita.copperSoft, fontFamily: font.sansBold, fontSize: 12 },
  rowActionMuted: { color: orbita.faint },
  error: { color: "#D07A5A", marginTop: 14 },
  note: { marginBottom: 8, textAlign: "center" },
  footer: { paddingBottom: 12, paddingTop: 12 },
  spacer: { flex: 1, minHeight: 10 },

  scrim: { backgroundColor: "rgba(7,8,10,0.72)", ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: orbita.bgElev,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    bottom: 0,
    left: 0,
    paddingBottom: 22,
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    position: "absolute",
    right: 0
  },
  handle: {
    alignSelf: "center",
    backgroundColor: orbita.faint,
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 42
  },
  sheetTitle: { color: orbita.bone, fontFamily: font.serif, fontSize: 24, lineHeight: 30 },
  sheetInvalid: { color: "#D07A5A", marginTop: 12 },
  sheetFooter: { gap: 4, marginTop: 20 },
  cancelRow: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  cancelTxt: { color: orbita.muted, fontFamily: font.sans, fontSize: 14 },

  unknownCard: {
    backgroundColor: "rgba(18,20,26,0.6)",
    borderColor: "rgba(214,154,106,0.45)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
    marginTop: 18,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  unknownCardOn: { borderColor: orbita.copper },
  unknownTxt: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 14 },
  unknownSub: { color: orbita.muted, fontFamily: font.sans, fontSize: 12 },

  placeLabel: { marginTop: 14 },
  placeInput: { color: orbita.bone, fontFamily: font.serifReg, fontSize: 20, marginTop: 6, paddingVertical: 6 },
  placeLine: { backgroundColor: orbita.lineStrong, height: 1 },
  placeHint: { marginTop: 14 },
  placeResult: { justifyContent: "center", minHeight: 44 },
  placeResultTxt: { color: orbita.muted, fontFamily: font.sans, fontSize: 15 },
  placeResultOn: { color: orbita.bone, fontFamily: font.sansMed }
});
