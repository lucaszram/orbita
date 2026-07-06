import { useState } from "react";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Divider, Eyebrow, TabStrip } from "@/components/orbita/kit";
import { GlyphRow } from "@/components/orbita/GlyphRow";
import { useAppData } from "@/domain/appData";

type Tab = "amor" | "trabajo" | "vinculos" | "energia";

export default function TransitosPorAreaScreen() {
  const { transitos } = useAppData();
  const [tab, setTab] = useState<Tab>("amor");
  return (
    <DetailScreen eyebrow="Tránsitos">
      <TabStrip
        tabs={[
          { key: "amor", label: "Amor" },
          { key: "trabajo", label: "Trabajo" },
          { key: "vinculos", label: "Vínculos" },
          { key: "energia", label: "Energía" }
        ]}
        active={tab}
        onChange={setTab}
      />
      <Divider />
      <Eyebrow>TRÁNSITOS POR ÁREA</Eyebrow>
      {transitos.porArea.map((t) => (
        <GlyphRow key={t.title} title={t.title} body={t.body} onPress={() => router.push("/reading/transito")} />
      ))}
    </DetailScreen>
  );
}
