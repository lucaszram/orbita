import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebNav } from "@/components/web/web-nav";

const colors = {
  black: "#07080A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)"
};

type NavKey = "hoy" | "carta" | "transitos" | "diario";

export function OrbitaSoon({ active, eyebrow, title, body }: { active: NavKey; eyebrow: string; title: string; body: string }) {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });
  if (!fontsLoaded) {
    return <View style={styles.center}><ActivityIndicator color={colors.copperSoft} /></View>;
  }
  return (
    <View style={styles.page}>
      <WebNav active={active} />
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{body}</Text>
        <Text style={styles.soon}>Próximamente — el diseño ya está en Figma (Web B0).</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.black, flex: 1 },
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center" },
  body: { alignItems: "flex-start", flex: 1, gap: 14, justifyContent: "center", maxWidth: 700, paddingHorizontal: 120, width: "100%" },
  eyebrow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 44, lineHeight: 50 },
  text: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 18, lineHeight: 27 },
  soon: { color: colors.copperSoft, fontFamily: "Inter_500Medium", fontSize: 14, marginTop: 8 }
});

export default OrbitaSoon;
