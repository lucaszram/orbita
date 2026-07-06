import { useState } from "react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Divider, Eyebrow, TabStrip } from "@/components/orbita/kit";
import { GlyphRow } from "@/components/orbita/GlyphRow";
import { useAppData } from "@/domain/appData";

type Tab = "planetas" | "casas" | "aspectos" | "elementos";

export default function CartaPosicionesScreen() {
  const { carta } = useAppData();
  const [tab, setTab] = useState<Tab>("planetas");
  return (
    <DetailScreen eyebrow="Carta">
      <TabStrip
        tabs={[
          { key: "planetas", label: "Planetas" },
          { key: "casas", label: "Casas" },
          { key: "aspectos", label: "Aspectos" },
          { key: "elementos", label: "Elementos" }
        ]}
        active={tab}
        onChange={setTab}
      />
      <Divider />
      <Eyebrow>POSICIONES</Eyebrow>
      {carta.positions.map((p) => (
        <GlyphRow key={p.title} title={p.title} body={p.body} />
      ))}
    </DetailScreen>
  );
}
