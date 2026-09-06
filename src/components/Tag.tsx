import { Pressable, StyleSheet, Text } from "react-native";
import { usePressedState } from "@/components/v492/Touchable";
import { theme } from "@/theme/theme";

type TagProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Tag({ label, selected = false, onPress }: TagProps) {
  const { pressed, pressableProps } = usePressedState();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      {...pressableProps}
      style={[styles.tag, selected && styles.selected, pressed && onPress ? styles.pressed : null]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: "rgba(255, 255, 255, 0.76)",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  selected: {
    backgroundColor: theme.colors.plum,
    borderColor: theme.colors.plum
  },
  pressed: {
    opacity: 0.78
  },
  label: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0
  },
  selectedLabel: {
    color: "#fff"
  }
});
