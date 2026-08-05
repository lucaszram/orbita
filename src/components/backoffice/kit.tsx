/**
 * Primitivas compartidas del backoffice.
 *
 * El backoffice es una superficie INTERNA: no usa el lienzo ni la tipografía
 * editorial del producto, sino una paleta densa de herramienta. Esta paleta ya
 * existía dentro de `BackofficeLab.tsx`; acá se declara una sola vez para que
 * la pestaña `Cuentas` no invente un segundo backoffice al lado del primero.
 *
 * Todo control declara 44px de objetivo táctil y nombre accesible: en web no
 * hay `hitSlop` y sí hay tabulador.
 */
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export const backofficeColors = {
  background: "#111111",
  panel: "#1A1A18",
  panelSoft: "#22211E",
  ink: "#F4EEE3",
  muted: "#AFA698",
  faint: "rgba(244, 238, 227, 0.12)",
  copper: "#D8B46A",
  copperDark: "#7B5B2A",
  dangerBg: "rgba(226, 142, 123, 0.12)",
  dangerLine: "rgba(226, 142, 123, 0.35)",
  warnBg: "rgba(216, 180, 106, 0.14)",
  warnLine: "rgba(216, 180, 106, 0.34)",
  okBg: "rgba(216, 180, 106, 0.11)",
  onCopper: "#15120E"
} as const;

const c = backofficeColors;

export function SetupPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView style={kit.page} contentContainerStyle={kit.setupWrap}>
      <View style={kit.setupPanel}>
        <Text style={kit.kicker}>Órbita Backoffice</Text>
        <Text style={kit.title}>{title}</Text>
        <View style={kit.copyBlock}>{children}</View>
      </View>
    </ScrollView>
  );
}

export function AdminPanel({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={kit.panel}>
      <View style={kit.panelHeader}>
        <Text style={kit.panelTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export type NoticeTone = "ok" | "warning" | "danger" | "neutral";

const NOTICE_STYLE: Record<NoticeTone, { backgroundColor: string; borderColor: string }> = {
  danger: { backgroundColor: c.dangerBg, borderColor: c.dangerLine },
  neutral: { backgroundColor: c.okBg, borderColor: "rgba(216, 180, 106, 0.28)" },
  ok: { backgroundColor: c.okBg, borderColor: "rgba(216, 180, 106, 0.28)" },
  warning: { backgroundColor: c.warnBg, borderColor: c.warnLine }
};

/**
 * Un aviso. Los de error se anuncian con `role="alert"` y región viva: aparecen
 * sin mover el foco (arriba del control que se acaba de tocar), así que un
 * lector de pantalla no los mencionaría solo.
 */
export function AdminNotice({
  tone,
  title,
  children
}: {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
}) {
  const live = tone === "danger" || tone === "warning";
  return (
    <View
      accessibilityLiveRegion={live ? "polite" : "none"}
      role={live ? "alert" : undefined}
      style={[kit.notice, NOTICE_STYLE[tone]]}
    >
      <Text selectable style={kit.noticeTitle}>
        {title}
      </Text>
      {typeof children === "string" ? (
        <Text selectable style={kit.noticeText}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export function AdminField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={kit.field}>
      <Text style={kit.label}>{label}</Text>
      {children}
      {hint ? (
        <Text selectable style={kit.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Campo de texto. `label` es obligatorio: nunca alcanza con el placeholder. */
export function AdminInput({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline = false,
  onSubmitEditing
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  onSubmitEditing?: () => void;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      editable={editable}
      multiline={multiline}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      placeholder={placeholder}
      placeholderTextColor="rgba(241, 232, 215, 0.38)"
      style={[kit.input, multiline && kit.inputMultiline, !editable && kit.inputDisabled]}
      value={value}
    />
  );
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function AdminButton({
  label,
  onPress,
  variant = "secondary",
  disabled = false,
  accessibilityHint
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        kit.button,
        variant === "primary" && kit.buttonPrimary,
        variant === "secondary" && kit.buttonSecondary,
        variant === "ghost" && kit.buttonGhost,
        variant === "danger" && kit.buttonDanger,
        disabled && kit.buttonDisabled
      ]}
    >
      <Text style={[kit.buttonText, variant === "primary" && kit.buttonTextOnCopper]}>{label}</Text>
    </Pressable>
  );
}

export type ChoiceOption<Value extends string> = { value: Value; label: string };

/**
 * Grupo de opciones excluyentes (rango, segmento, orden, preset del grant).
 *
 * Es un `radiogroup` de verdad: cada opción anuncia si está elegida en vez de
 * comunicarlo sólo con el color de fondo.
 */
export function AdminChoiceGroup<Value extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string;
  value: Value;
  options: ReadonlyArray<ChoiceOption<Value>>;
  onChange: (value: Value) => void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={kit.choiceGroup}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[kit.choice, selected && kit.choiceSelected, disabled && kit.buttonDisabled]}
          >
            <Text style={[kit.choiceText, selected && kit.choiceTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AdminStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={kit.stat}>
      <Text selectable style={kit.statLabel}>
        {label}
      </Text>
      <Text selectable style={kit.statValue}>
        {value}
      </Text>
      {detail ? (
        <Text selectable style={kit.statDetail}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

export function AdminLoading({ label }: { label: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={kit.loading}>
      <ActivityIndicator color={c.copper} />
      <Text style={kit.hint}>{label}</Text>
    </View>
  );
}

export function AdminEmpty({ children }: { children: string }) {
  return (
    <Text selectable style={kit.hint}>
      {children}
    </Text>
  );
}

export const kit = StyleSheet.create({
  page: {
    backgroundColor: c.background,
    flex: 1
  },
  setupWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
    padding: 20
  },
  setupPanel: {
    backgroundColor: c.panel,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    maxWidth: 720,
    padding: 24,
    width: "100%"
  },
  copyBlock: {
    gap: 10
  },
  kicker: {
    color: c.copper,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: c.ink,
    fontFamily: "Newsreader_600SemiBold",
    fontSize: 28,
    lineHeight: 32
  },
  body: {
    color: c.muted,
    fontSize: 15,
    lineHeight: 22
  },
  panel: {
    backgroundColor: c.panel,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    padding: 16
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between"
  },
  panelTitle: {
    color: c.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  notice: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  noticeTitle: {
    color: c.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  noticeText: {
    color: c.muted,
    fontSize: 13,
    lineHeight: 19
  },
  field: {
    flexGrow: 1,
    gap: 6,
    minWidth: 220
  },
  label: {
    color: c.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  hint: {
    color: c.muted,
    fontSize: 13,
    lineHeight: 18
  },
  input: {
    backgroundColor: c.panelSoft,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: c.ink,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: "top"
  },
  inputDisabled: {
    opacity: 0.42
  },
  button: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14
  },
  buttonPrimary: {
    backgroundColor: c.copper
  },
  buttonSecondary: {
    backgroundColor: c.panelSoft,
    borderColor: c.faint,
    borderWidth: 1
  },
  buttonGhost: {
    borderColor: "transparent",
    borderWidth: 1
  },
  buttonDanger: {
    backgroundColor: c.dangerBg,
    borderColor: c.dangerLine,
    borderWidth: 1
  },
  buttonDisabled: {
    opacity: 0.42
  },
  buttonText: {
    color: c.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  buttonTextOnCopper: {
    color: c.onCopper
  },
  choiceGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  choice: {
    alignItems: "center",
    backgroundColor: c.panelSoft,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14
  },
  choiceSelected: {
    backgroundColor: c.copper,
    borderColor: c.copper
  },
  choiceText: {
    color: c.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  choiceTextSelected: {
    color: c.onCopper
  },
  // `flexBasis: "22%"` es lo que hace que las ocho métricas caigan en una grilla
  // pareja: a lo sumo entran cuatro por fila (5 × 22% > 100%), así que 8 se
  // reparten 4 + 4 en escritorio. Sin el basis, en ~1280px entraban siete y la
  // octava —Umbral— quedaba sola, estirada de punta a punta por el `flexGrow`.
  // En pantallas angostas manda `minWidth`, que deja las mismas dos por fila.
  stat: {
    backgroundColor: c.panelSoft,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "22%",
    flexGrow: 1,
    gap: 4,
    minWidth: 150,
    padding: 12
  },
  statLabel: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  statValue: {
    color: c.ink,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26
  },
  statDetail: {
    color: c.muted,
    fontSize: 12,
    lineHeight: 16
  },
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  }
});
