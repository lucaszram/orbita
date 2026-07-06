import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, H2, Note, Pill } from "@/components/orbita/kit";
import { orbita } from "@/theme/orbita";

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={orbita.colors.mutedDim}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

export default function VinculoAddScreen() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  return (
    <DetailScreen eyebrow="Nuevo vínculo">
      <H2>¿Con quién{"\n"}lo mirás?</H2>
      <Body>Con el nombre y la fecha alcanza para una lectura base. La hora afina, pero es opcional.</Body>
      <View style={{ height: orbita.spacing.xl }} />
      <Field label="NOMBRE" placeholder="Ej. Alex" value={name} onChange={setName} />
      <Field label="FECHA DE NACIMIENTO" placeholder="DD / MM / AAAA" value={date} onChange={setDate} />
      <Field label="HORA  (OPCIONAL)" placeholder="— — : — —" value={time} onChange={setTime} />
      <Note>Usamos estos datos solo para leer el vínculo. No se publican.</Note>
      <View style={{ height: orbita.spacing.xl }} />
      <Pill label="GUARDAR PERSONA" onPress={() => router.push("/reading/vinculo-result")} />
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: orbita.spacing.xl },
  label: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 0.5, marginBottom: orbita.spacing.sm },
  input: {
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.body,
    fontSize: 15,
    height: 52,
    paddingHorizontal: orbita.spacing.lg
  }
});
