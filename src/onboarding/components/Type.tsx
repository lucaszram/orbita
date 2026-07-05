import { type TextStyle } from "react-native";

import { Text } from "@/components/ui/text";

import { font, orbita } from "../theme";

type OTextProps = React.ComponentProps<typeof Text> & { style?: TextStyle | TextStyle[] };

/** Editorial serif headline (Newsreader Medium). */
export function Title({ style, ...props }: OTextProps) {
  return (
    <Text
      {...props}
      style={[
        { color: orbita.bone, fontFamily: font.serif, fontSize: 30, lineHeight: 36 },
        style as TextStyle,
      ]}
    />
  );
}

/** Supporting body copy. */
export function Body({ style, ...props }: OTextProps) {
  return (
    <Text
      {...props}
      style={[
        { color: orbita.muted, fontFamily: font.sans, fontSize: 15, lineHeight: 22 },
        style as TextStyle,
      ]}
    />
  );
}

/** Copper eyebrow / uppercase kicker. */
export function Eyebrow({ style, ...props }: OTextProps) {
  return (
    <Text
      {...props}
      style={[
        {
          color: orbita.copper,
          fontFamily: font.sansBold,
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
        },
        style as TextStyle,
      ]}
    />
  );
}

/** Small copper field label (SOL, ELEMENTO, HORA…). */
export function Label({ style, ...props }: OTextProps) {
  return (
    <Text
      {...props}
      style={[
        {
          color: orbita.copper,
          fontFamily: font.sansBold,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
        style as TextStyle,
      ]}
    />
  );
}

/** Faint fine print / privacy caption. */
export function Caption({ style, ...props }: OTextProps) {
  return (
    <Text
      {...props}
      style={[
        { color: orbita.faint, fontFamily: font.sans, fontSize: 12, lineHeight: 17 },
        style as TextStyle,
      ]}
    />
  );
}
