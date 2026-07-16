import { router } from "expo-router";
import { EmptyState } from "@/components/orbita/states";
import { backendConfig } from "@/services/backendProviders";

/**
 * Estado honesto de INVITADO (decisión de producto 2026-07-16: la app no
 * muestra mocks). En vez de datos demo presentados como personalizados, la
 * pantalla dice qué falta y ofrece entrar. El CTA va al login existente
 * (`/iniciar-sesion`, que a su vez orienta a crear la carta si sos nuevo).
 */
export function GuestState({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <EmptyState
      eyebrow={eyebrow}
      title={title}
      body={body}
      cta={backendConfig.isConfigured ? "INICIAR SESIÓN" : undefined}
      onCta={() => router.push("/iniciar-sesion")}
    />
  );
}
