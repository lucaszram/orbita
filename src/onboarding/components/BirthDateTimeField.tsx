import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import { parseDateInput, parseTimeInput } from "@/domain/birthInput";
import { Body, Label } from "@/onboarding/components/Type";
import { font, orbita } from "@/onboarding/theme";

/**
 * Campo de fecha/hora de nacimiento: una interfaz, dos implementaciones.
 *
 * Nativo conserva el `DateTimePicker` de rueda de siempre. Web usa campos de
 * texto con validación estricta.
 *
 * LIMITACIÓN CONOCIDA en web: no hay `<input type="date">` del navegador. No se
 * pudo llegar al DOM por ninguno de estos caminos: `TextInput` de
 * react-native-web descarta el prop `type`; el JSX `<input>` no llega al DOM
 * porque el proyecto compila con `jsxImportSource: "nativewind"`
 * (babel.config.js); y ni `createElement` de React ni `unstable_createElement`
 * de RNW producen el nodo, porque el árbol se monta con el host config de RNW.
 * Un archivo `.web.tsx` aparte tampoco renderizó. Resolverlo pide una decisión
 * de configuración, anotada en el reporte del PR.
 *
 * Lo que sí ofrece hoy: campos visibles, tabulables, etiquetados, con alto
 * táctil de 44px, formato de ejemplo y validación que impide que un texto
 * inválido llegue al estado — así no se puede guardar una fecha que no existe.
 *
 * Las dos ramas escriben el MISMO `Date`: no hay estado paralelo.
 */

const IS_WEB = Platform.OS === "web";

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BirthDateField({
  value,
  onChange,
  label = "Fecha"
}: {
  value: Date;
  onChange: (next: Date) => void;
  label?: string;
}) {
  const [text, setText] = useState(() => toDateInput(value));
  const [invalid, setInvalid] = useState(false);

  if (!IS_WEB) {
    return (
      <>
        <Label style={styles.fieldLabel}>{label}</Label>
        <DateTimePicker
          value={value}
          mode="date"
          display="spinner"
          themeVariant="dark"
          maximumDate={new Date()}
          onChange={(_, next) => next && onChange(next)}
          style={styles.picker}
        />
      </>
    );
  }

  return (
    <>
      <Label style={styles.fieldLabel}>{label}</Label>
      <TextInput
        accessibilityLabel="Fecha de nacimiento, en formato año-mes-día"
        accessibilityHint="Cuatro dígitos de año, dos de mes y dos de día, separados por guiones"
        value={text}
        onChangeText={(next) => {
          setText(next);
          const parsed = parseDateInput(next);
          setInvalid(next.trim() !== "" && parsed === null);
          // Sin parseo válido NO se toca el estado: el valor vigente se conserva.
          if (!parsed) return;
          const d = new Date(value);
          d.setFullYear(parsed.y, parsed.m - 1, parsed.d);
          onChange(d);
        }}
        placeholder="1996-11-11"
        placeholderTextColor={orbita.faint}
        inputMode="numeric"
        maxLength={10}
        style={styles.input}
      />
      {invalid ? (
        <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.invalid}>
          Usá el formato año-mes-día, por ejemplo 1996-11-11.
        </Body>
      ) : null}
    </>
  );
}

export function BirthTimeField({
  value,
  onChange,
  disabled = false,
  label = "Hora"
}: {
  value: Date;
  onChange: (next: Date) => void;
  /** `No sé la hora` activo: el control se oculta, no se guarda hora inventada. */
  disabled?: boolean;
  label?: string;
}) {
  const [text, setText] = useState(() => toTimeInput(value));
  const [invalid, setInvalid] = useState(false);

  // Con la hora desconocida el control NO se renderiza: uno deshabilitado pero
  // visible seguiría mostrando una hora que nadie eligió.
  if (disabled) return null;

  if (!IS_WEB) {
    return (
      <DateTimePicker
        value={value}
        mode="time"
        display="spinner"
        themeVariant="dark"
        onChange={(_, next) => next && onChange(next)}
        style={styles.picker}
      />
    );
  }

  return (
    <View>
      <TextInput
        accessibilityLabel={`${label} de nacimiento, en formato horas y minutos`}
        accessibilityHint="Dos dígitos de hora y dos de minutos, en 24 horas"
        value={text}
        onChangeText={(next) => {
          setText(next);
          const parsed = parseTimeInput(next);
          setInvalid(next.trim() !== "" && parsed === null);
          if (!parsed) return;
          const d = new Date(value);
          d.setHours(parsed.h, parsed.m, 0, 0);
          onChange(d);
        }}
        placeholder="10:32"
        placeholderTextColor={orbita.faint}
        inputMode="numeric"
        maxLength={5}
        style={styles.input}
      />
      {invalid ? (
        <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.invalid}>
          Usá el formato de 24 horas, por ejemplo 10:32.
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { marginTop: 22 },
  picker: { alignSelf: "stretch" },
  input: {
    borderBottomColor: orbita.line,
    borderBottomWidth: 1,
    color: orbita.bone,
    fontFamily: font.sans,
    fontSize: 18,
    // Alto táctil accesible; el foco lo dibuja el navegador.
    minHeight: 44,
    paddingVertical: 10
  },
  invalid: { color: "#D07A5A", marginTop: 6 }
});
