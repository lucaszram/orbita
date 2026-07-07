import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Eyebrow, InsightRow } from "@/components/orbita/kit";
import { EmptyState } from "@/components/orbita/states";
import { useAppState } from "@/hooks/useAppState";

export default function SavedScreen() {
  const { savedReadings } = useAppState();

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
        <InsightRow key={r.id} title={r.headline} body={r.dateLabel} />
      ))}
    </DetailScreen>
  );
}
