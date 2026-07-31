import * as React from "react";

import { isRealDateParts } from "@/domain/birthInput";
import { font, orbita } from "@/onboarding/theme";

import { MONTHS } from "../months";
import type { BirthDatePickerProps, BirthTimePickerProps } from "./BirthPicker";

/**
 * Selección de fecha y hora de nacimiento — implementación WEB.
 *
 * **Por qué no es la rueda nativa.** `components/Wheel.tsx` se posiciona con
 * `contentOffset` —que en react-native-web no existe— y confirma con
 * `onMomentumScrollEnd`/`onScrollEndDrag`, que el navegador no emite. La columna
 * mostraba la primera fila mientras el estado seguía en otro valor, y ESE se
 * guardaba: la web mostraba una fecha de nacimiento y persistía otra.
 *
 * **Por qué tampoco es `<input type="date">`.** Resuelve la integridad, pero
 * abre el popover del sistema operativo: un calendario gris de Chrome en el
 * medio de una pantalla cósmica. Rompe la inmersión justo en el momento más
 * personal del alta.
 *
 * Así que la rueda se reimplementa para web con semántica de LISTBOX: cada
 * columna es un `role="listbox"` con opciones `role="option"`, navegable con
 * flechas, Home/End y PageUp/PageDown, clickeable, y arrastrable/scrolleable
 * con el dedo o la rueda del mouse. La posición se fija con `scrollTop`
 * calculado (`índice * alto de fila`) en vez de depender de eventos de momentum,
 * y la selección se confirma al frenar el scroll. No hay ningún popup del
 * sistema.
 *
 * Sobre `React.createElement` en vez de JSX: el proyecto compila con
 * `jsxImportSource: "nativewind"`, así que un elemento intrínseco escrito como
 * JSX pasa por el runtime de NativeWind, que lo trata como componente de React
 * Native. `createElement` con un string va derecho a react-dom. Los estilos son
 * objetos LITERALES por el mismo motivo por el que lo son en el resto del alta:
 * una hoja registrada se compila a clase y pierde contra las clases de Tailwind.
 */

const ROW_H = 40;
const VISIBLE_ROWS = 5;
const COLUMN_H = ROW_H * VISIBLE_ROWS;
/** Relleno para que la fila elegida quede en el centro de la ventana. */
const PAD = ROW_H * 2;
/** Al frenar el scroll se confirma la fila más cercana al centro. */
const SETTLE_MS = 110;
/**
 * Alto FIJO de la leyenda ("DÍA" / "MES" / "AÑO").
 *
 * La banda de selección se posiciona en absoluto dentro del marco, y la leyenda
 * va arriba de cada columna: si su alto dependiera de las métricas de la fuente,
 * la banda quedaría corrida respecto de la fila resaltada — el defecto exacto
 * que este control existe para no tener. Con alto y `line-height` explícitos el
 * offset es aritmética, no una medida del navegador.
 */
const LEGEND_H = 14;
/** Padding vertical del marco. La banda arranca debajo del padding y la leyenda. */
const WRAP_PAD_Y = 8;

const wrapStyle: React.CSSProperties = {
  background: "rgba(18,20,26,0.55)",
  border: `1px solid ${orbita.lineStrong}`,
  borderRadius: 16,
  marginTop: 20,
  overflow: "hidden",
  padding: `${WRAP_PAD_Y}px 4px`,
  position: "relative"
};

const rowsStyle: React.CSSProperties = { display: "flex", gap: 4, justifyContent: "center" };

/** La banda que marca la fila elegida: es la lectura de "rueda". */
const bandStyle: React.CSSProperties = {
  background: "rgba(196,106,58,0.10)",
  borderBottom: `1px solid rgba(196,106,58,0.5)`,
  borderTop: `1px solid rgba(196,106,58,0.5)`,
  height: ROW_H,
  left: 8,
  pointerEvents: "none",
  position: "absolute",
  right: 8,
  // Padding del marco + leyenda + relleno superior de la columna. Antes era
  // `8 + PAD`, que ignoraba la leyenda: la banda quedaba ~14px por encima de la
  // fila que decía estar marcando.
  top: WRAP_PAD_Y + LEGEND_H + PAD,
  zIndex: 2
};

const columnStyle: React.CSSProperties = {
  height: COLUMN_H,
  outlineOffset: -2,
  overflowY: "auto",
  scrollSnapType: "y mandatory",
  // Sin barra visible: es una rueda, no una lista.
  scrollbarWidth: "none"
};

const optionBase: React.CSSProperties = {
  alignItems: "center",
  cursor: "pointer",
  display: "flex",
  height: ROW_H,
  justifyContent: "center",
  scrollSnapAlign: "center",
  userSelect: "none"
};

const legendStyle: React.CSSProperties = {
  color: orbita.copper,
  fontFamily: font.sansBold,
  fontSize: 10,
  // Alto y line-height explícitos: la banda se posiciona contando con ellos.
  height: LEGEND_H,
  letterSpacing: 1,
  lineHeight: `${LEGEND_H}px`,
  textAlign: "center",
  textTransform: "uppercase"
};

const hintStyle: React.CSSProperties = {
  color: orbita.faint,
  fontFamily: font.sans,
  fontSize: 12,
  lineHeight: "17px",
  margin: "8px 0 0"
};

function optionStyle(selected: boolean): React.CSSProperties {
  return {
    ...optionBase,
    color: selected ? orbita.bone : orbita.faint,
    fontFamily: selected ? font.serif : font.serifReg,
    fontSize: selected ? 22 : 16
  };
}

/** `useId` devuelve `«r0»`: válido como id, impronunciable para un selector. */
function safeId(raw: string): string {
  return `onb-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * Una columna de la rueda, con semántica de listbox.
 *
 * Aparte del componente para poder razonarla: el índice SIEMPRE viene de las
 * props (la única fuente de verdad es el estado del alta), y cada camino de
 * entrada —click, teclado, scroll— emite el mismo `onChange(i)`.
 */
function WheelColumn({
  label,
  items,
  index,
  onChange,
  width
}: {
  label: string;
  items: string[];
  index: number;
  onChange: (next: number) => void;
  width: number;
}) {
  const id = safeId(React.useId());
  const ref = React.useRef<HTMLDivElement | null>(null);
  const settle = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clamped = Math.max(0, Math.min(items.length - 1, index));

  // La posición se CALCULA desde el índice; no se hereda del scroll previo ni
  // de eventos de momentum. Es lo que garantiza que lo que se ve sea el estado.
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const target = clamped * ROW_H;
    if (Math.abs(node.scrollTop - target) > 1) node.scrollTop = target;
  }, [clamped]);

  const commitFromScroll = () => {
    const node = ref.current;
    if (!node) return;
    const next = Math.max(0, Math.min(items.length - 1, Math.round(node.scrollTop / ROW_H)));
    if (next !== clamped) onChange(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const last = items.length - 1;
    const map: Record<string, number | undefined> = {
      ArrowDown: Math.min(last, clamped + 1),
      ArrowUp: Math.max(0, clamped - 1),
      PageDown: Math.min(last, clamped + VISIBLE_ROWS),
      PageUp: Math.max(0, clamped - VISIBLE_ROWS),
      Home: 0,
      End: last
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    if (next !== clamped) onChange(next);
  };

  return React.createElement(
    "div",
    { style: { width } },
    React.createElement("div", { "aria-hidden": true, style: legendStyle }, label),
    React.createElement(
      "div",
      {
        "aria-activedescendant": `${id}-${clamped}`,
        "aria-label": label,
        id,
        onKeyDown,
        onScroll: () => {
          if (settle.current) clearTimeout(settle.current);
          settle.current = setTimeout(commitFromScroll, SETTLE_MS);
        },
        ref,
        role: "listbox",
        style: { ...columnStyle, width },
        tabIndex: 0
      },
      React.createElement("div", { key: "pad-top", style: { height: PAD } }),
      ...items.map((item, i) =>
        React.createElement(
          "div",
          {
            "aria-selected": i === clamped,
            id: `${id}-${i}`,
            key: item + i,
            onClick: () => {
              if (i !== clamped) onChange(i);
            },
            role: "option",
            style: optionStyle(i === clamped)
          },
          item
        )
      ),
      React.createElement("div", { key: "pad-bottom", style: { height: PAD } })
    )
  );
}

const DAYS_31 = Array.from({ length: 31 }, (_, i) => String(i + 1));
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/** Años hasta HOY: nadie nació mañana (lo que antes hacía el `max` del input). */
export function yearOptions(today: Date, span = 100): string[] {
  const top = today.getFullYear();
  return Array.from({ length: span }, (_, i) => String(top - i));
}

export function BirthDatePicker({ value, onChange }: BirthDatePickerProps) {
  const hintId = safeId(React.useId());
  const years = React.useMemo(() => yearOptions(new Date()), []);
  const yearIndex = Math.max(0, years.indexOf(String(value.year)));
  // Se muestran los 31 días SIEMPRE, a propósito: recortarlos al mes elegido
  // cambiaría el día en silencio al pasar de enero a febrero. El día que no
  // existe se rechaza donde ya se rechazaba —`isRealDateParts` en la pantalla—
  // y acá sólo se marca, para que la rueda diga por qué.
  const invalid = !isRealDateParts(value);

  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { "aria-describedby": hintId, "aria-label": "Fecha de nacimiento", role: "group", style: wrapStyle },
      React.createElement("div", { style: bandStyle }),
      React.createElement(
        "div",
        { style: rowsStyle },
        React.createElement(WheelColumn, {
          index: value.day - 1,
          items: DAYS_31,
          key: "d",
          label: "Día",
          onChange: (i) => onChange({ ...value, day: i + 1 }),
          width: 64
        }),
        React.createElement(WheelColumn, {
          index: value.month - 1,
          items: [...MONTHS],
          key: "m",
          label: "Mes",
          onChange: (i) => onChange({ ...value, month: i + 1 }),
          width: 132
        }),
        React.createElement(WheelColumn, {
          index: yearIndex,
          items: years,
          key: "y",
          label: "Año",
          onChange: (i) => onChange({ ...value, year: Number(years[i]) }),
          width: 84
        })
      )
    ),
    React.createElement(
      "p",
      { id: hintId, style: hintStyle },
      invalid
        ? `${MONTHS[value.month - 1]} no tiene ${value.day} días.`
        : "Deslizá, tocá o usá las flechas del teclado."
    )
  );
}

export function BirthTimePicker({ value, onChange, unknown }: BirthTimePickerProps) {
  const hintId = safeId(React.useId());
  // Con la hora desconocida el control NO se renderiza: una hora visible que
  // nadie eligió es el mismo error que este archivo viene a evitar.
  if (unknown) return null;

  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { "aria-describedby": hintId, "aria-label": "Hora de nacimiento", role: "group", style: wrapStyle },
      React.createElement("div", { style: bandStyle }),
      React.createElement(
        "div",
        { style: rowsStyle },
        React.createElement(WheelColumn, {
          index: value.hour,
          items: HOURS,
          key: "h",
          label: "Hora",
          onChange: (i) => onChange({ ...value, hour: i }),
          width: 84
        }),
        React.createElement(WheelColumn, {
          index: value.minute,
          items: MINUTES,
          key: "min",
          label: "Minuto",
          onChange: (i) => onChange({ ...value, minute: i }),
          width: 84
        })
      )
    ),
    React.createElement(
      "p",
      { id: hintId, style: hintStyle },
      "Deslizá, tocá o usá las flechas del teclado."
    )
  );
}
