/**
 * Shell del backoffice: la navegación interna `Cuentas | Lab`.
 *
 * El backoffice ya existía y era una sola cosa (el Lab de modelo). Este shell
 * lo envuelve —`BackofficeLabWorkspace` es la misma pantalla de antes— y le
 * suma la pestaña `Cuentas` al lado.
 *
 * La sesión es del shell: el email y `Cambiar cuenta` viven acá arriba, una
 * sola vez para las dos pestañas. Por eso el Lab ya no los recibe.
 *
 * Es el único archivo del backoffice que mide la ventana: el modo ancho baja
 * por prop a la tabla y al detalle, así que ninguna pieza de abajo vuelve a
 * consultar el viewport por su cuenta.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { AdminButton, backofficeColors as c } from "./kit";
import { AccountsWorkspace } from "./accounts/AccountsWorkspace";
import { BackofficeLabWorkspace } from "./BackofficeLab";

export type BackofficeTab = "accounts" | "lab";

export const BACKOFFICE_TABS: Array<{ value: BackofficeTab; label: string }> = [
  { value: "accounts", label: "Cuentas" },
  { value: "lab", label: "Lab" }
];

/** Ancho a partir del cual el listado se dibuja como tabla y el detalle al lado. */
export const BACKOFFICE_WIDE_BREAKPOINT = 1020;

export function BackofficeScreen({ onSignOut, userEmail }: { onSignOut: () => void; userEmail?: string }) {
  const [tab, setTab] = useState<BackofficeTab>("accounts");
  const { width } = useWindowDimensions();
  const wide = width >= BACKOFFICE_WIDE_BREAKPOINT;

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {BACKOFFICE_TABS.map((option) => {
            const selected = option.value === tab;
            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => setTab(option.value)}
                style={[styles.tab, selected && styles.tabSelected]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.session}>
          <Text selectable style={styles.sessionEmail}>
            {userEmail ?? "Clerk conectado"}
          </Text>
          <AdminButton label="Cambiar cuenta" onPress={onSignOut} variant="secondary" />
        </View>
      </View>

      <View style={styles.body}>
        {tab === "accounts" ? (
          <AccountsWorkspace wide={wide} />
        ) : (
          <BackofficeLabWorkspace />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: c.background,
    flex: 1
  },
  bar: {
    alignItems: "center",
    backgroundColor: c.panel,
    borderBottomColor: c.faint,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  tabs: {
    flexDirection: "row",
    gap: 6
  },
  tab: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16
  },
  tabSelected: {
    backgroundColor: c.copper,
    borderColor: c.copper
  },
  tabText: {
    color: c.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  tabTextSelected: {
    color: c.onCopper
  },
  session: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  sessionEmail: {
    color: c.muted,
    fontSize: 12
  },
  body: {
    flex: 1
  }
});
