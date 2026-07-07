import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { OrbitaLanding } from "@/components/web/orbita-landing";
import { useAppState } from "@/hooks/useAppState";
import { theme } from "@/theme/theme";

export default function IndexRoute() {
  const { isReady, profile } = useAppState();

  if (process.env.EXPO_OS === "web") {
    return <OrbitaLanding />;
  }

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.plum} />
      </View>
    );
  }

  return <Redirect href={profile ? "/(tabs)" : "/onboarding"} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center"
  }
});
