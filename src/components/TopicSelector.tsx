import { StyleSheet, View } from "react-native";
import { Topic, topics } from "@/domain/types";
import { Tag } from "./Tag";
import { theme } from "@/theme/theme";

export const topicLabels: Record<Topic, string> = {
  amor: "Amor",
  trabajo: "Trabajo",
  dinero: "Dinero",
  energia: "Energia",
  familia: "Familia",
  decisiones: "Decisiones",
  claridad: "Claridad",
  proteccion: "Proteccion",
  luna: "Luna"
};

type TopicSelectorProps = {
  selected: Topic[];
  onChange: (selected: Topic[]) => void;
  allowedTopics?: Topic[];
};

export function TopicSelector({ selected, onChange, allowedTopics }: TopicSelectorProps) {
  const options = allowedTopics ?? topics;

  function toggle(topic: Topic) {
    if (selected.includes(topic)) {
      onChange(selected.filter((item) => item !== topic));
      return;
    }

    onChange([...selected, topic]);
  }

  return (
    <View style={styles.wrap}>
      {options.map((topic) => (
        <Tag key={topic} label={topicLabels[topic]} onPress={() => toggle(topic)} selected={selected.includes(topic)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  }
});
