import * as React from "react";
import { isoDateFrom, normalizeDateValue, normalizeTimeValue } from "@/domain/birthInput";
import { font, orbita } from "@/onboarding/theme";
import type { BirthDateFieldProps, BirthTimeFieldProps } from "./BirthDateTimeField";

/**
 * Campo de fecha/hora de nacimiento — implementación WEB.
 *
 * Metro resuelve este archivo por extensión de plataforma (`.web.tsx`) y el
 * hermano `BirthDateTimeField.tsx` (rueda de `DateTimePicker`) en iOS/Android.
 * La interfaz es la misma; el editor no sabe cuál está montada.
 *
 * En web los controles son los NATIVOS DEL NAVEGADOR: `<input type="date">` y
 * `<input type="time">`. Traen calendario, reloj, teclado numérico en móvil,
 * validación de días que no existen y el idioma del sistema — todo gratis y
 * mejor de lo que se puede reimplementar con campos de texto.
 *
 * Por qué `React.createElement` y no JSX: el proyecto compila con
 * `jsxImportSource: "nativewind"` (babel.config.js), así que un `<input>`
 * escrito como JSX pasa por el runtime de NativeWind, que trata los elementos
 * intrínsecos como componentes de React Native. `createElement` con un string
 * va derecho a react-dom y produce el nodo del DOM. Es local a este archivo:
 * no hace falta tocar la configuración de build.
 *
 * Los `<input>` conviven sin problema dentro del árbol de react-native-web:
 * RNW monta con react-dom, así que un elemento del DOM es un hijo válido.
 */

/** El `<input type="date">` se enfoca y navega con teclado por sí solo. */
const inputStyle: React.CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${orbita.lineStrong}`,
  borderRadius: 0,
  boxSizing: "border-box",
  color: orbita.bone,
  // Le dice al navegador que dibuje calendario, reloj e ícono en oscuro; si no,
  // el control queda ilegible sobre el fondo de Órbita.
  colorScheme: "dark",
  display: "block",
  fontFamily: font.sans,
  fontSize: 18,
  // Alto táctil accesible.
  minHeight: 44,
  padding: "10px 0",
  width: "100%"
};

const labelStyle: React.CSSProperties = {
  color: orbita.copper,
  display: "block",
  fontFamily: font.sansBold,
  fontSize: 11,
  letterSpacing: 1,
  marginTop: 22,
  textTransform: "uppercase"
};

/**
 * Etiqueta sólo para lectores de pantalla: la de HORA ya está visible en la
 * fila del interruptor «No sé la hora», y repetirla dejaba dos rótulos
 * seguidos. El control igual necesita su `<label for>` para tener nombre.
 */
const srOnlyLabelStyle: React.CSSProperties = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1
};

const hintStyle: React.CSSProperties = {
  color: orbita.muted,
  fontFamily: font.sans,
  fontSize: 15,
  lineHeight: "22px",
  margin: "6px 0 0"
};

/** `useId` devuelve `«r0»`: válido como id, pero impronunciable para un selector. */
function fieldId(raw: string): string {
  return `birth-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * Props del `<input>` de fecha, aparte del componente para poder probarlas sin
 * montar React: acá vive la conducta que importa — tipo del control, tope, valor
 * vacío cuando no hay dato, y qué se emite al cambiar.
 */
export function birthDateInputProps(args: {
  id: string;
  value: string | null;
  onChange: (next: string | null) => void;
  today: Date;
}): React.InputHTMLAttributes<HTMLInputElement> {
  return {
    "aria-describedby": `${args.id}-hint`,
    id: args.id,
    // Nadie nació mañana: el navegador no deja elegir después de hoy.
    max: isoDateFrom(args.today),
    name: "birth-date",
    // Vaciar el control significa "no elegí nada", no "elegí el vacío": vuelve
    // como ausencia, para que Guardar siga bloqueado.
    onChange: (event) => args.onChange(normalizeDateValue(event.currentTarget.value)),
    style: inputStyle,
    type: "date",
    // Sin valor autoritativo el campo queda vacío de verdad.
    value: args.value ?? ""
  };
}

export function birthTimeInputProps(args: {
  id: string;
  value: string | null;
  onChange: (next: string | null) => void;
}): React.InputHTMLAttributes<HTMLInputElement> {
  return {
    "aria-describedby": `${args.id}-hint`,
    id: args.id,
    name: "birth-time",
    onChange: (event) => args.onChange(normalizeTimeValue(event.currentTarget.value)),
    style: inputStyle,
    type: "time",
    value: args.value ?? ""
  };
}

export function BirthDateField({ value, onChange, label = "Fecha" }: BirthDateFieldProps) {
  const id = fieldId(React.useId());
  return React.createElement(
    "div",
    null,
    React.createElement("label", { htmlFor: id, style: labelStyle }, label),
    React.createElement("input", birthDateInputProps({ id, onChange, today: new Date(), value })),
    React.createElement(
      "p",
      { id: `${id}-hint`, style: hintStyle },
      value === null ? "Elegí tu fecha de nacimiento." : "Día, mes y año en que naciste."
    )
  );
}

export function BirthTimeField({ value, onChange, disabled = false, label = "Hora" }: BirthTimeFieldProps) {
  const id = fieldId(React.useId());
  // Con la hora desconocida el control NO se renderiza: uno deshabilitado pero
  // visible seguiría mostrando una hora que nadie eligió.
  if (disabled) return null;

  return React.createElement(
    "div",
    null,
    React.createElement("label", { htmlFor: id, style: srOnlyLabelStyle }, `${label} de nacimiento`),
    React.createElement("input", birthTimeInputProps({ id, onChange, value })),
    React.createElement(
      "p",
      { id: `${id}-hint`, style: hintStyle },
      value === null ? "Elegí tu hora de nacimiento." : "Hora y minutos en que naciste."
    )
  );
}
