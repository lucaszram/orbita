import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { font, orbita } from "../theme";
import { Label } from "./Type";

/** Copper-label + serif-value data row used on the confirmation screens. */
export function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <View style={styles.row}>
        <Label style={styles.label}>{label}</Label>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { width: 84 },
  line: { backgroundColor: orbita.line, height: 1, marginTop: 14 },
  row: { alignItems: "center", flexDirection: "row" },
  value: { color: orbita.bone, flex: 1, fontFamily: font.serifReg, fontSize: 20 },
});
