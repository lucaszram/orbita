import * as React from "react";

import {
  isoDateFrom,
  partsToDateValue,
  partsToTimeValue,
  dateValueToParts,
  timeValueToParts
} from "@/domain/birthInput";
import { font, orbita } from "@/onboarding/theme";

import type { BirthDatePickerProps, BirthTimePickerProps } from "./BirthPicker";

/**
 * Selección de fecha y hora de nacimiento — implementación WEB.
 *
 * **Por qué existe este archivo (bug de integridad, bloqueante de lanzamiento).**
 * La rueda de `components/Wheel.tsx` se posiciona con `contentOffset`, que en
 * react-native-web NO existe: el scroll arrancaba siempre en 0. Y confirma la
 * elección con `onMomentumScrollEnd`/`onScrollEndDrag`, que el navegador tampoco
 * emite al girar la rueda del mouse. Resultado: la columna MOSTRABA la primera
 * fila —1 · Enero · 2014, 00:00— mientras el estado seguía en el valor por
 * defecto —15 · Enero · 1996, 12:00— y era ESE el que se confirmaba y se
 * guardaba. La web mostraba una fecha de nacimiento y persistía otra.
 *
 * No se puede arreglar la rueda en web sin reimplementar scroll, snap, momentum
 * y accesibilidad a mano. Así que la web usa lo mismo que ya funciona en el
 * editor de datos (`BirthDateTimeField.web.tsx`): los controles NATIVOS del
 * navegador. Traen calendario, reloj, teclado numérico en móvil, validación de
 * días que no existen, navegación por teclado y el idioma del sistema.
 *
 * Sobre `React.createElement` en vez de JSX: el proyecto compila con
 * `jsxImportSource: "nativewind"`, así que un `<input>` escrito como JSX pasa
 * por el runtime de NativeWind, que trata los elementos intrínsecos como
 * componentes de React Native. `createElement` con un string va derecho a
 * react-dom. Es local a este archivo; no hace falta tocar el build.
 */

const controlStyle: React.CSSProperties = {
  appearance: "none",
  background: "rgba(18,20,26,0.6)",
  border: `1px solid ${orbita.lineStrong}`,
  borderRadius: 14,
  boxSizing: "border-box",
  color: orbita.bone,
  // Calendario, reloj e ícono en oscuro; si no, el control queda ilegible.
  colorScheme: "dark",
  display: "block",
  fontFamily: font.serifReg,
  fontSize: 22,
  // Alto táctil accesible.
  minHeight: 56,
  padding: "12px 16px",
  width: "100%"
};

const labelStyle: React.CSSProperties = {
  color: orbita.copper,
  display: "block",
  fontFamily: font.sansBold,
  fontSize: 11,
  letterSpacing: 1,
  marginBottom: 8,
  textTransform: "uppercase"
};

const hintStyle: React.CSSProperties = {
  color: orbita.faint,
  fontFamily: font.sans,
  fontSize: 12,
  lineHeight: "17px",
  margin: "8px 0 0"
};

/** `useId` devuelve `«r0»`: válido como id, pero impronunciable para un selector. */
function fieldId(raw: string): string {
  return `onb-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * Props del `<input>` de fecha, aparte del componente para poder probar sin
 * montar React la única conducta que importa: que el valor MOSTRADO salga de
 * las mismas partes que usa el resto del flujo, y que lo que se emite al
 * cambiar sean esas mismas partes.
 */
export function birthDateControlProps(args: {
  id: string;
  value: BirthDatePickerProps["value"];
  onChange: BirthDatePickerProps["onChange"];
  today: Date;
}): React.InputHTMLAttributes<HTMLInputElement> {
  return {
    "aria-describedby": `${args.id}-hint`,
    id: args.id,
    // Nadie nació mañana.
    max: isoDateFrom(args.today),
    name: "birth-date",
    onChange: (event) => {
      const parts = dateValueToParts(event.currentTarget.value);
      // Un control vaciado no puede reescribir el estado con basura: se ignora
      // y queda el último valor real elegido.
      if (parts) args.onChange(parts);
    },
    style: controlStyle,
    type: "date",
    // EL punto de todo esto: lo que se ve es exactamente lo que hay en el
    // estado. Si las partes no forman un día real, el control queda vacío —
    // nunca muestra una fecha distinta de la que se va a guardar.
    value: partsToDateValue(args.value) ?? ""
  };
}

export function birthTimeControlProps(args: {
  id: string;
  value: BirthTimePickerProps["value"];
  onChange: BirthTimePickerProps["onChange"];
}): React.InputHTMLAttributes<HTMLInputElement> {
  return {
    "aria-describedby": `${args.id}-hint`,
    id: args.id,
    name: "birth-time",
    onChange: (event) => {
      const parts = timeValueToParts(event.currentTarget.value);
      if (parts) args.onChange(parts);
    },
    style: controlStyle,
    type: "time",
    value: partsToTimeValue(args.value) ?? ""
  };
}

export function BirthDatePicker({ value, onChange }: BirthDatePickerProps) {
  const id = fieldId(React.useId());
  const shown = partsToDateValue(value);
  return React.createElement(
    "div",
    { style: { marginTop: 36 } },
    React.createElement("label", { htmlFor: id, style: labelStyle }, "Fecha de nacimiento"),
    React.createElement("input", birthDateControlProps({ id, onChange, today: new Date(), value })),
    React.createElement(
      "p",
      { id: `${id}-hint`, style: hintStyle },
      shown === null
        ? "Esa combinación de día y mes no existe. Elegí una fecha real."
        : "Día, mes y año en que naciste."
    )
  );
}

export function BirthTimePicker({ value, onChange, unknown }: BirthTimePickerProps) {
  const id = fieldId(React.useId());
  // Con la hora desconocida el control NO se renderiza: uno deshabilitado pero
  // visible seguiría mostrando una hora que nadie eligió — el mismo error que
  // este archivo viene a arreglar, en otra forma.
  if (unknown) return null;

  return React.createElement(
    "div",
    { style: { marginTop: 28 } },
    React.createElement("label", { htmlFor: id, style: labelStyle }, "Hora de nacimiento"),
    React.createElement("input", birthTimeControlProps({ id, onChange, value })),
    React.createElement("p", { id: `${id}-hint`, style: hintStyle }, "Hora y minutos en que naciste.")
  );
}
