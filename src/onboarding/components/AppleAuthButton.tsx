import { ProviderButton } from "./ProviderButton";

/**
 * "Continuar con Apple" FUERA de iOS: la pastilla que dibuja Órbita.
 *
 * En iOS gana `AppleAuthButton.ios.tsx`, que monta el botón nativo de
 * `expo-apple-authentication` (texto, localización, tipografía, logo y
 * accesibilidad del sistema). Este archivo es el que resuelve el bundler para
 * web y Android, donde ese botón no existe: ahí Apple se resuelve por navegador
 * (`oauth_apple` de Clerk) detrás de `APPLE_AUTH_ENABLED`, y la superficie
 * vuelve a ser la pastilla blanca con el vector oficial del DMG.
 *
 * La separación es por archivo de plataforma a propósito: así el bundle web
 * NUNCA importa `expo-apple-authentication`, que es un módulo sólo de iOS.
 *
 * Mismo contrato de props que la variante nativa. El label vive acá y no en la
 * pantalla porque en iOS no existe: ahí lo pone el sistema.
 */

/** El copy de la vía Apple donde Órbita todavía tiene que escribirlo. */
const LABEL = "Continuar con Apple";

export function AppleAuthButton({
  busy,
  disabled,
  onPress
}: {
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <ProviderButton icon="apple" label={LABEL} busy={busy} disabled={disabled} onPress={onPress} />
  );
}
