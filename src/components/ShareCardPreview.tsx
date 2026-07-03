import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShareCard } from "@/domain/types";
import { theme } from "@/theme/theme";

type ShareCardPreviewProps = {
  card: ShareCard;
  icon?: ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
};

export function ShareCardPreview({ card, icon = "share-social", onPress }: ShareCardPreviewProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons color="#fff" name={icon} size={18} />
        </View>
        <Text style={styles.meta}>{card.meta}</Text>
      </View>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.subtitle}>{card.subtitle}</Text>
      <Text style={styles.body}>{card.body}</Text>
      <Text style={styles.accent}>Color guia: {card.accent}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.plum,
    borderRadius: theme.radius.md,
    gap: theme.spacing.sm,
    overflow: "hidden",
    padding: theme.spacing.lg
  },
  pressed: {
    opacity: 0.84
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  badge: {
    alignItems: "center",
    backgroundColor: theme.colors.rose,
    borderRadius: theme.radius.full,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  meta: {
    color: "#f2c27e",
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 29
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0
  },
  body: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 23
  },
  accent: {
    color: "#f2c27e",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0
  }
});
