import { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

type EmptyStateProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
};

export function EmptyState({ icon, title, body }: EmptyStateProps) {
  return (
    <Card>
      <View style={styles.iconCircle}>
        <Ionicons color={theme.colors.plum} name={icon} size={22} />
      </View>
      <Text style={textStyles.cardTitle}>{title}</Text>
      <Text style={textStyles.muted}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceWarm,
    borderRadius: theme.radius.full,
    height: 44,
    justifyContent: "center",
    width: 44
  }
});
