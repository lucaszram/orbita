import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { font, orbita } from "../theme";

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "copper" | "secondary";
};

/** Primary onboarding CTA — built on the reusable Button (copper or secondary). */
export function CTA({ label, onPress, disabled, variant = "copper" }: Props) {
  const copper = variant === "copper";
  return (
    <Button
      variant="figma"
      radius={27}
      fill={copper ? orbita.copper : "transparent"}
      onPress={onPress}
      disabled={disabled}
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
          color: copper ? orbita.ink : orbita.bone,
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
