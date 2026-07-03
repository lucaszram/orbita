import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAppState } from "@/hooks/useAppState";
import { theme } from "@/theme/theme";

export default function IndexRoute() {
  const { isReady, profile } = useAppState();

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
