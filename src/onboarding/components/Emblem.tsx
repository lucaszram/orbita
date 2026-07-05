import { Image, type ImageSourcePropType, View, type ViewStyle } from "react-native";

import { orbita } from "../theme";

type Props = {
  source: ImageSourcePropType;
  size?: number;
  opacity?: number;
  glow?: boolean;
  style?: ViewStyle;
};

/**
 * Circular focal emblem with a soft copper glow — the reusable "patrón"
 * that integrates the dark-field symbol/planet assets on any screen.
 */
export function Emblem({ source, size = 200, opacity = 0.95, glow = true, style }: Props) {
  return (
    <View
      style={[
        { borderRadius: size / 2, height: size, width: size },
        glow && {
          shadowColor: orbita.copper,
          shadowOffset: { height: 0, width: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 26,
        },
        style,
      ]}
    >
      <Image
        source={source}
        resizeMode="cover"
        style={{ borderRadius: size / 2, height: size, opacity, width: size }}
      />
    </View>
  );
}
