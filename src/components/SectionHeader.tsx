import { StyleSheet, Text, View } from "react-native";
import { textStyles } from "@/theme/text";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  body?: string;
};

export function SectionHeader({ eyebrow, title, body }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={textStyles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={textStyles.sectionTitle}>{title}</Text>
      {body ? <Text style={textStyles.muted}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4
  }
});
