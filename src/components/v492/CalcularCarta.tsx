import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAction } from "convex/react";
import { Card, ModuleHeader } from "@/components/v492/Module";
import { Section } from "@/components/v492/Screen";
import { PrimaryButton } from "@/components/v492/States";
import { Body } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { appApi } from "@/services/appRefs";

/**
 * Datos natales completos y todavía sin carta: se calcula, no se muestra una
 * aproximada.
 *
 * `calculateOrCreateNatalChart` devuelve la carta exacta si ya existe y la crea
 * si no, así que entrar a una pantalla de la carta —que es la intención
 * explícita de verla— dispara un intento y reintentar es seguro.
 *
 * Vive acá y no dentro de una pantalla porque el hub y la carta completa tienen
 * que hacer EXACTAMENTE lo mismo: un intento automático al entrar, un solo
 * intento en vuelo por vez, y un fallo que se dice con reintento en vez de
 * dejar la pantalla girando.
 */
export function CalcularCarta({
  /** Los datos natales cambiaron desde el último cálculo: se recalcula. */
  stale,
  /** Qué aparece cuando termine, en las palabras de la pantalla que llama. */
  readyLine = "Cuando termine, tu carta aparece acá."
}: {
  stale: boolean;
  readyLine?: string;
}) {
  const calculate = useAction(appApi.charts.calculateOrCreateNatalChart);
  const [state, setState] = useState<"idle" | "working" | "failed">("working");
  const running = useRef(false);
  const autoAttempted = useRef(false);

  const run = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setState("working");
    calculate({})
      .then(() => setState("idle"))
      .catch(() => setState("failed"))
      .finally(() => {
        running.current = false;
      });
  }, [calculate]);

  useEffect(() => {
    if (autoAttempted.current) return;
    autoAttempted.current = true;
    run();
  }, [run]);

  return (
    <Section>
      <ModuleHeader
        module={stale ? "Tu carta se recalcula" : "Estamos calculando tu carta"}
        cadence="una sola vez"
        intro={
          stale
            ? "Tus datos de nacimiento cambiaron desde el último cálculo. La recalculamos con los datos actuales en vez de mostrarte la anterior."
            : "Tus datos de nacimiento ya están guardados. El cálculo tarda unos segundos."
        }
      />
      <Card>
        <Body>
          {state === "failed"
            ? "No pudimos calcularla ahora. Tus datos siguen guardados: probá de nuevo cuando quieras."
            : readyLine}
        </Body>
      </Card>
      <View style={styles.actionRow}>
        <PrimaryButton
          label={state === "working" ? "CALCULANDO…" : state === "failed" ? "REINTENTAR" : "CALCULAR MI CARTA"}
          accessibilityLabel="Calcular mi carta natal"
          onPress={run}
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  actionRow: { marginTop: v492.space.xl }
});
