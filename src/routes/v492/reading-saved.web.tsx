import { Alert } from "react-native";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Eyebrow, InsightRow } from "@/components/orbita/kit";
import { EmptyState, LoadingState } from "@/components/orbita/states";
import { DailyReading } from "@/domain/types";
import { useAppState } from "@/hooks/useAppState";

export default function SavedScreen() {
  const { savedReadings, savedReadingsSyncing, removeSavedReading } = useAppState();

  function confirmarBorrado(reading: DailyReading) {
    Alert.alert(reading.headline, "¿Querés borrar esta lectura de tus guardadas?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => void removeSavedReading(reading.id)
      }
    ]);
  }

  // Con sesión, el archivo remoto puede estar llegando: carga hasta la data
  // real, nunca un vacío que después se pisa con las lecturas recuperadas.
  if (savedReadings.length === 0 && savedReadingsSyncing) {
    return (
      <DetailScreen eyebrow="Guardadas">
        <LoadingState />
      </DetailScreen>
    );
  }

  if (savedReadings.length === 0) {
    return (
      <DetailScreen eyebrow="Guardadas">
        <EmptyState
          title={"Todavía no\nguardaste nada."}
          body="Cuando guardes una lectura, la vas a encontrar acá para volver cuando quieras."
          cta="VOLVER A HOY"
          onCta={() => router.replace("/(tabs)")}
        />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen eyebrow="Guardadas">
      <Eyebrow>TUS LECTURAS</Eyebrow>
      {savedReadings.map((r) => (
        <InsightRow key={r.id} title={r.headline} body={r.dateLabel} onPress={() => confirmarBorrado(r)} />
      ))}
    </DetailScreen>
  );
}
