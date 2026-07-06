import { Stack } from "expo-router";
import { orbita } from "@/theme/orbita";

export default function ReadingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: orbita.colors.background },
        animation: "slide_from_right"
      }}
    >
      <Stack.Screen name="deep-dive" />
      <Stack.Screen name="topic" />
      <Stack.Screen name="long-read" />
    </Stack>
  );
}
