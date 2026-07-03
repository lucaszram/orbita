import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";

const iconMap = {
  index: "sparkles",
  explore: "compass",
  relationship: "heart",
  journal: "book",
  profile: "person-circle"
} as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.plum,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: "#fffaf4",
          borderTopColor: theme.colors.border,
          height: 74,
          paddingBottom: 12,
          paddingTop: 8
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons color={color} name={iconMap[route.name as keyof typeof iconMap] ?? "ellipse"} size={size} />
        )
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Hoy" }} />
      <Tabs.Screen name="explore" options={{ title: "Señales" }} />
      <Tabs.Screen name="relationship" options={{ title: "Vínculo" }} />
      <Tabs.Screen name="journal" options={{ title: "Diario" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
