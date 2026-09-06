import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { font, orbita } from "../theme";

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "copper" | "secondary";
};

/**
 * Primary onboarding CTA — built on the reusable Button (copper or secondary).
 *
 * Bloqueado se VE y se ANUNCIA. Antes sólo dejaba de responder: quedaba en
 * cobre pleno, idéntico a uno activo, así que un Guardar que no se podía tocar
 * parecía un Guardar roto (D4). Ahora baja a un cobre apagado y declara su
 * estado, y quien lo usa tiene que explicar al lado qué falta para soltarlo.
 */
export function CTA({ label, onPress, disabled, variant = "copper" }: Props) {
  const copper = variant === "copper";
  return (
    <Button
      variant="figma"
      radius={27}
      fill={copper ? (disabled ? orbita.copperOff : orbita.copper) : "transparent"}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={{
        alignItems: "center",
        alignSelf: "stretch",
        borderColor: copper ? undefined : orbita.lineStrong,
        borderWidth: copper ? 0 : 1,
        height: 54,
        justifyContent: "center",
        paddingHorizontal: 20,
      }}
    >
      <Text
        style={{
          color: copper ? (disabled ? orbita.boneSoft : orbita.ink) : disabled ? orbita.faint : orbita.bone,
          fontFamily: font.sansBold,
          fontSize: 16,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Button>
  );
}
