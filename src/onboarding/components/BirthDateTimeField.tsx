import { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { Touchable } from "@/components/v492/Touchable";
import {
  dateValueToParts,
  isFutureDateParts,
  isRealDateParts,
  partsToDateValue,
  partsToTimeValue,
  timeValueToParts,
  type BirthDatePartsValue,
  type BirthTimePartsValue
} from "@/domain/birthInput";
import {
  canConfirmBirthWheel,
  WHEEL_DAYS,
  WHEEL_HOURS,
  WHEEL_MINUTES,
  WHEEL_MONTHS,
  wheelYears
} from "@/domain/birthWheels";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Body, Caption, Label } from "@/onboarding/components/Type";
import { Wheel, WHEEL_ROW_H } from "@/onboarding/components/Wheel";
import { MONTHS } from "@/onboarding/months";
import { orbita } from "@/onboarding/theme";

/**
 * Campo de fecha/hora de nacimiento — implementación NATIVA.
 *
 * El hermano `BirthDateTimeField.web.tsx` (extensión de plataforma de Metro)
 * implementa la MISMA interfaz con controles del navegador. Este archivo se
 * bundlea en iOS/Android; ese otro, en web, y no cambia.
 *
 * La interfaz habla los strings del dominio (`YYYY-MM-DD`, `HH:MM`) y no
 * `Date`, por una razón concreta: `Date` no tiene forma de decir "todavía no
 * hay valor". Con `null` el editor puede empezar VACÍO cuando el documento
 * remoto no trae fecha u hora, en vez de mostrar un mediodía inventado.
 *
 * ---
 *
 * **Por qué esto ya no es una rueda incrustada en la página.**
 *
 * La versión anterior dibujaba un `DateTimePicker` nativo con `display="spinner"`
 * dentro del formulario. Eso produjo tres defectos que la certificación midió:
 *
 * - **D2.** La rueda ocupaba casi todo el alto visible y capturaba CUALQUIER
 *   arrastre vertical que empezara sobre ella. Para llegar a "Guardar" hay que
 *   scrollear, y ese scroll cambiaba el dato: `4 de mayo` → `27 de mayo`,
 *   `1994` → `1992`, `09:12` → `09:24`. Se guardaba una fecha que nadie eligió.
 * - **D3.** El control del sistema venía en inglés (`January…December`, `AM/PM`)
 *   dentro de una app íntegramente en español con voseo, y exponía sus tres
 *   columnas como `AXSlider` sin etiqueta.
 * - **D6.** Sin hora guardada, la rueda arrancaba en `12:00 AM` y guardar sin
 *   tocarla escribía medianoche en silencio.
 *
 * La forma que resuelve los tres NO es ajustar el control: es sacarlo del
 * scroll. Acá el formulario muestra una FILA con el valor —o la falta de
 * valor— y las ruedas viven en una hoja modal. Un arrastre sobre la página
 * scrollea la página, porque debajo del dedo no hay ninguna rueda; y cuando la
 * hoja está abierta no hay página que scrollear, así que el gesto es de la
 * rueda sin ambigüedad. Las ruedas son las MISMAS del alta (`Wheel`), que ya
 * están en español y en 24 h, con una etiqueta accesible por columna.
 *
 * Y nada se guarda sin confirmación: la hoja edita una copia y sólo `LISTO`
 * la devuelve. Cuando no había valor, `LISTO` queda bloqueado hasta que la
 * persona elige de verdad — el ancla desde donde arranca la rueda es un punto
 * de partida para mirar, nunca un valor propuesto.
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

const DAYS = [...WHEEL_DAYS];
const YEARS = [...wheelYears(new Date().getFullYear())];
const HOURS = [...WHEEL_HOURS];
const MINUTES = [...WHEEL_MINUTES];

/**
 * Desde dónde arranca la rueda cuando no hay valor.
 *
 * Es un punto de partida para MIRAR, no una propuesta: mientras la persona no
 * confirme, el valor del formulario sigue en `null`. Se eligen a media escala
 * —ni el borde de la lista ni un valor "redondo" que se pueda confundir con un
 * dato real— justamente para que medianoche no vuelva a colarse sola (D6).
 */
const ANCLA_FECHA: BirthDatePartsValue = { day: 1, month: 1, year: 1990 };
const ANCLA_HORA: BirthTimePartsValue = { hour: 12, minute: 0 };

function textoFecha(parts: BirthDatePartsValue): string {
  return `${parts.day} de ${MONTHS[parts.month - 1].toLocaleLowerCase("es")} de ${parts.year}`;
}

function textoHora(parts: BirthTimePartsValue): string {
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function BirthDateField({ value, onChange, label = "Fecha de nacimiento" }: BirthDateFieldProps) {
  const [abierto, setAbierto] = useState(false);
  const parts = value ? dateValueToParts(value) : null;

  return (
    <View>
      <Label style={styles.fieldLabel}>{label}</Label>
      <FilaValor
        texto={parts ? textoFecha(parts) : "Elegir la fecha"}
        elegido={parts !== null}
        accessibilityLabel={label}
        accessibilityValue={parts ? textoFecha(parts) : "todavía sin elegir"}
        onPress={() => setAbierto(true)}
      />
      {parts === null ? (
        <Body accessibilityLiveRegion="polite" style={styles.pending}>
          Todavía no elegiste tu fecha de nacimiento.
        </Body>
      ) : null}

      <HojaDeRueda
        visible={abierto}
        titulo={label}
        inicial={parts ?? ANCLA_FECHA}
        requiereEleccion={parts === null}
        // Una fecha imposible (31 de febrero) o futura no se puede confirmar: el
        // botón lo dice en vez de guardar algo que el backend va a rechazar.
        validar={(borrador) =>
          !isRealDateParts(borrador)
            ? "Ese día no existe en ese mes."
            : isFutureDateParts(borrador, new Date())
              ? "La fecha de nacimiento no puede ser futura."
              : null
        }
        onCancel={() => setAbierto(false)}
        onConfirm={(borrador) => {
          setAbierto(false);
          onChange(partsToDateValue(borrador));
        }}
        columnas={(borrador, setBorrador) => [
          {
            key: "dia",
            label: "Día",
            width: 64,
            items: DAYS,
            index: borrador.day - 1,
            onChange: (i) => setBorrador({ ...borrador, day: i + 1 })
          },
          {
            key: "mes",
            label: "Mes",
            width: 140,
            items: [...WHEEL_MONTHS],
            index: borrador.month - 1,
            onChange: (i) => setBorrador({ ...borrador, month: i + 1 })
          },
          {
            key: "anio",
            label: "Año",
            width: 84,
            items: YEARS,
            index: Math.max(0, YEARS.indexOf(String(borrador.year))),
            onChange: (i) => setBorrador({ ...borrador, year: Number(YEARS[i]) })
          }
        ]}
      />
    </View>
  );
}

export function BirthTimeField({
  value,
  onChange,
  disabled = false,
  label = "Hora de nacimiento"
}: BirthTimeFieldProps) {
  const [abierto, setAbierto] = useState(false);
  // Con la hora desconocida el control NO se renderiza: uno deshabilitado pero
  // visible seguiría mostrando una hora que nadie eligió.
  const parts = value ? timeValueToParts(value) : null;
  if (disabled) return null;

  return (
    <View>
      <FilaValor
        texto={parts ? textoHora(parts) : "Elegir la hora"}
        elegido={parts !== null}
        accessibilityLabel={label}
        accessibilityValue={parts ? textoHora(parts) : "todavía sin elegir"}
        onPress={() => setAbierto(true)}
      />
      {parts === null ? (
        <Body accessibilityLiveRegion="polite" style={styles.pending}>
          Todavía no elegiste tu hora de nacimiento. No suponemos ninguna: sin elegirla, no se guarda.
        </Body>
      ) : null}

      <HojaDeRueda
        visible={abierto}
        titulo={label}
        inicial={parts ?? ANCLA_HORA}
        requiereEleccion={parts === null}
        validar={() => null}
        onCancel={() => setAbierto(false)}
        onConfirm={(borrador) => {
          setAbierto(false);
          onChange(partsToTimeValue(borrador));
        }}
        columnas={(borrador, setBorrador) => [
          {
            key: "hora",
            label: "Hora",
            width: 84,
            items: HOURS,
            index: borrador.hour,
            onChange: (i) => setBorrador({ ...borrador, hour: i })
          },
          {
            key: "minuto",
            label: "Minuto",
            width: 84,
            items: MINUTES,
            index: borrador.minute,
            onChange: (i) => setBorrador({ ...borrador, minute: i })
          }
        ]}
      />
    </View>
  );
}

/**
 * La fila que abre la hoja: 44 pt de alto y un botón real para VoiceOver.
 *
 * Va por `Touchable` y no por `Pressable` directo: con `jsxImportSource:
 * "nativewind"`, la forma FUNCIÓN de `style` se descarta en silencio y la fila
 * pierde su borde, su alto mínimo y su repartición. Es el mismo defecto que
 * amontonaba la barra de pestañas (D1).
 */
function FilaValor({
  texto,
  elegido,
  accessibilityLabel,
  accessibilityValue,
  onPress
}: {
  texto: string;
  elegido: boolean;
  accessibilityLabel: string;
  accessibilityValue: string;
  onPress: () => void;
}) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: accessibilityValue }}
      accessibilityHint="Abre el selector"
      style={styles.fila}
      pressedStyle={styles.pressed}
    >
      <Body style={elegido ? styles.valor : styles.valorVacio}>{texto}</Body>
      <Caption style={styles.cambiar}>{elegido ? "CAMBIAR" : "ELEGIR"}</Caption>
    </Touchable>
  );
}

type Columna = {
  key: string;
  label: string;
  width: number;
  items: string[];
  index: number;
  onChange: (index: number) => void;
};

/**
 * La hoja con las ruedas.
 *
 * Edita un BORRADOR y no el valor del formulario: mientras está abierta, mover
 * una rueda no cambia nada de lo guardado. `LISTO` es lo único que confirma, y
 * `CANCELAR` —o tocar afuera— deja todo como estaba.
 *
 * `requiereEleccion` es la guarda de D6: si el campo venía vacío, el ancla desde
 * donde arranca la rueda no puede confirmarse sin tocar nada. Hay que mover
 * alguna columna, y así ninguna medianoche —ni ningún 1 de enero de 1990— entra
 * por inercia.
 */
function HojaDeRueda<T extends object>({
  visible,
  titulo,
  inicial,
  requiereEleccion,
  validar,
  columnas,
  onCancel,
  onConfirm
}: {
  visible: boolean;
  titulo: string;
  inicial: T;
  requiereEleccion: boolean;
  validar: (borrador: T) => string | null;
  columnas: (borrador: T, setBorrador: (next: T) => void) => Columna[];
  onCancel: () => void;
  onConfirm: (borrador: T) => void;
}) {
  const reducirMovimiento = useReducedMotion();
  const [borrador, setBorrador] = useState<T>(inicial);
  const [tocado, setTocado] = useState(false);

  const aplicar = (next: T) => {
    setBorrador(next);
    setTocado(true);
  };

  const problema = validar(borrador);
  const bloqueado = !canConfirmBirthWheel({ requiresChoice: requiereEleccion, touched: tocado, problem: problema });

  return (
    <Modal
      visible={visible}
      transparent
      // "Reducir movimiento" apaga la transición: la hoja aparece, no se desliza.
      animationType={reducirMovimiento ? "none" : "slide"}
      onRequestClose={onCancel}
      // Cada apertura estrena borrador: sin esto, cancelar y volver a abrir
      // mostraría lo que se había movido la vez anterior.
      onShow={() => {
        setBorrador(inicial);
        setTocado(false);
      }}
    >
      <View style={styles.fondo}>
        <Touchable style={styles.fondoTap} accessibilityLabel="Cerrar sin elegir" onPress={onCancel}>
          <View />
        </Touchable>
        <View style={styles.hoja} accessibilityViewIsModal>
          <Label style={styles.hojaTitulo}>{titulo}</Label>

          <View style={styles.ruedas}>
            <View style={styles.hairlineTop} pointerEvents="none" />
            <View style={styles.hairlineBottom} pointerEvents="none" />
            <View style={styles.columnas}>
              {columnas(borrador, aplicar).map((columna) => (
                <Wheel
                  key={columna.key}
                  label={columna.label}
                  items={columna.items}
                  index={columna.index}
                  onChange={columna.onChange}
                  width={columna.width}
                  align="center"
                />
              ))}
            </View>
          </View>

          <View style={styles.aviso} accessibilityLiveRegion="polite">
            {problema !== null ? (
              <Caption style={styles.problema}>{problema}</Caption>
            ) : requiereEleccion && !tocado ? (
              <Caption style={styles.pista}>Mové una rueda para elegir. No proponemos ningún valor.</Caption>
            ) : null}
          </View>

          <View style={styles.acciones}>
            <Touchable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              style={styles.accion}
              pressedStyle={styles.pressed}
            >
              <Label style={styles.accionTexto}>CANCELAR</Label>
            </Touchable>
            <Touchable
              onPress={() => onConfirm(borrador)}
              disabled={bloqueado}
              accessibilityRole="button"
              accessibilityLabel="Listo"
              accessibilityState={{ disabled: bloqueado }}
              style={[styles.accion, bloqueado ? styles.accionApagada : styles.accionPrincipal]}
              pressedStyle={styles.pressed}
            >
              <Label style={[styles.accionTexto, bloqueado ? styles.accionTextoApagado : styles.accionTextoFuerte]}>
                LISTO
              </Label>
            </Touchable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  accion: {
    alignItems: "center",
    borderColor: orbita.line,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44
  },
  accionApagada: { borderColor: orbita.line },
  accionPrincipal: { borderColor: orbita.copper },
  accionTexto: { color: orbita.muted },
  accionTextoApagado: { color: orbita.faint },
  accionTextoFuerte: { color: orbita.copperSoft },
  acciones: { flexDirection: "row", gap: 12, marginTop: 16 },
  aviso: { minHeight: 20, marginTop: 12 },
  cambiar: { color: orbita.copperSoft },
  columnas: { flexDirection: "row", gap: 12, justifyContent: "center" },
  fieldLabel: { marginTop: 22 },
  fila: {
    alignItems: "center",
    borderBottomColor: orbita.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: 8
  },
  fondo: { backgroundColor: "rgba(6, 7, 10, 0.75)", flex: 1, justifyContent: "flex-end" },
  fondoTap: { flex: 1 },
  hairlineBottom: {
    backgroundColor: orbita.lineStrong,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: WHEEL_ROW_H * 3,
    zIndex: 2
  },
  hairlineTop: {
    backgroundColor: orbita.lineStrong,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: WHEEL_ROW_H * 2,
    zIndex: 2
  },
  hoja: {
    backgroundColor: orbita.bgElev,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 34,
    paddingHorizontal: 24,
    paddingTop: 20
  },
  hojaTitulo: { color: orbita.copperSoft },
  pending: { color: orbita.muted, marginTop: 6 },
  pista: { color: orbita.muted },
  pressed: { opacity: 0.6 },
  problema: { color: orbita.copperSoft },
  ruedas: { marginTop: 16 },
  valor: { color: orbita.bone },
  valorVacio: { color: orbita.faint }
});
