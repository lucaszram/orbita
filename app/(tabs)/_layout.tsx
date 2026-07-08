import { Tabs } from "expo-router";
import { OrbitaTabBar } from "@/components/orbita/TabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <OrbitaTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="vacio" options={{ title: "Umbral" }} />
      <Tabs.Screen name="transitos" options={{ title: "Tránsitos" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
      {/* Fuera de la barra pero siguen como rutas: Carta vive en el Perfil ("algo de
          una vez"); Vínculo queda parkeado (Próximamente). */}
      <Tabs.Screen name="carta" options={{ href: null }} />
      <Tabs.Screen name="vinculo" options={{ href: null }} />
    </Tabs>
  );
}
