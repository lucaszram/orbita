import { Tabs } from "expo-router";
import { OrbitaTabBar } from "@/components/orbita/TabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <OrbitaTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="carta" options={{ title: "Carta" }} />
      <Tabs.Screen name="transitos" options={{ title: "Tránsitos" }} />
      <Tabs.Screen name="vinculo" options={{ title: "Vínculo" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
