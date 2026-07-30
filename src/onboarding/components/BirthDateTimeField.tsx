import DateTimePicker from "@react-native-community/datetimepicker";
import { StyleSheet, View } from "react-native";
import { dateFromIso, dateFromTime, dateToIsoValue, timeToIsoValue } from "@/domain/birthInput";
import { Body, Label } from "@/onboarding/components/Type";
import { orbita } from "@/onboarding/theme";

/**
 * Campo de fecha/hora de nacimiento — implementación NATIVA (rueda).
 *
 * El hermano `BirthDateTimeField.web.tsx` (extensión de plataforma de Metro)
 * implementa la MISMA interfaz con controles del navegador. Este archivo se
 * bundlea en iOS/Android; ese otro, en web.
 *
 * La interfaz habla los strings del dominio (`YYYY-MM-DD`, `HH:MM`) y no
 * `Date`, por una razón concreta: `Date` no tiene forma de decir "todavía no
 * hay valor". Con `null` el editor puede empezar VACÍO cuando el documento
 * remoto no trae fecha u hora, en vez de mostrar un mediodía inventado.
 *
 * `null` en nativo: la rueda necesita sí o sí un `Date` para dibujarse, así que
 * se ancla en uno neutro y se avisa en pantalla que todavía no hay elección.
 * El valor sigue siendo `null` hasta que la persona mueve la rueda, y Guardar
 * sigue bloqueado: el ancla NUNCA se guarda.
 */

export type BirthDateFieldProps = {
  /** `YYYY-MM-DD`, o `null` si no hay valor elegido todavía. */
  value: string | null;
  onChange: (next: string | null) => void;
  label?: string;
};

export type BirthTimeFieldProps = {
  /** `HH:MM`, o `null` si no hay valor elegido todavía. */
  value: string | null;
  onChange: (next: string | null) => void;
  /** `No sé la hora` activo: el control se oculta, no se guarda hora inventada. */
  disabled?: boolean;
  label?: string;
};

/** Ancla visual de la rueda cuando no hay fecha: nunca se guarda. */
const DATE_ANCHOR = new Date(1990, 0, 1, 12, 0, 0, 0);

export function BirthDateField({ value, onChange, label = "Fecha" }: BirthDateFieldProps) {
  const picked = value === null ? null : dateFromIso(value);
  return (
    <View>
      <Label style={styles.fieldLabel}>{label}</Label>
      <DateTimePicker
        value={picked ?? DATE_ANCHOR}
        mode="date"
        display="spinner"
        themeVariant="dark"
        maximumDate={new Date()}
        onChange={(_, next) => next && onChange(dateToIsoValue(next))}
        style={styles.picker}
      />
      {picked === null ? (
        <Body accessibilityLiveRegion="polite" style={styles.pending}>
          Todavía no elegiste tu fecha de nacimiento. Movés la rueda para elegirla.
        </Body>
      ) : null}
    </View>
  );
}

export function BirthTimeField({ value, onChange, disabled = false, label = "Hora" }: BirthTimeFieldProps) {
  // Con la hora desconocida el control NO se renderiza: uno deshabilitado pero
  // visible seguiría mostrando una hora que nadie eligió.
  if (disabled) return null;

  const picked = value === null ? null : dateFromTime(value, new Date());
  // Ancla neutra sólo para dibujar la rueda; el valor sigue en `null`.
  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);

  return (
    <View accessibilityLabel={`${label} de nacimiento`}>
      <DateTimePicker
        value={picked ?? anchor}
        mode="time"
        display="spinner"
        themeVariant="dark"
        onChange={(_, next) => next && onChange(timeToIsoValue(next))}
        style={styles.picker}
      />
      {picked === null ? (
        <Body accessibilityLiveRegion="polite" style={styles.pending}>
          Todavía no elegiste tu hora de nacimiento. Movés la rueda para elegirla.
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { marginTop: 22 },
  pending: { color: orbita.muted, marginTop: 6 },
  picker: { alignSelf: "stretch" }
});
