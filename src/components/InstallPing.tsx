import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { proposedApi } from "@/services/appRefs";

const FLAG = "orbita_install_pinged_v1";

/**
 * Avisa "nueva instalación" al bot de Telegram una sola vez por install (guardado
 * en AsyncStorage). Se monta bajo el ConvexProvider y no requiere sesión, así que
 * cuenta también a los invitados. Best-effort: nunca rompe la app.
 */
export function InstallPing() {
  const ping = useMutation(proposedApi.appOpened);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const already = await AsyncStorage.getItem(FLAG);
        if (already) return;
        await ping({ platform: Platform.OS });
        await AsyncStorage.setItem(FLAG, "1");
      } catch {
        // best-effort
      }
    })();
  }, [ping]);

  return null;
}
