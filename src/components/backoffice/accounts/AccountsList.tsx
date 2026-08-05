/**
 * El listado de cuentas: tabla en ancho, fichas apiladas en angosto.
 *
 * Es la MISMA fila en las dos formas —mismos datos, mismo orden, mismo destino
 * al tocarla—, así que no hay dos verdades que mantener sincronizadas: cambia
 * la disposición, no el contenido. La decisión de ancho la toma el shell y baja
 * por prop (`wide`); acá no se mide la ventana.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  type AdminAccount,
  adminAccountName,
  adminProviderLabel,
  formatAdminDate,
  formatAdminLastActivity
} from "@/domain/adminAccounts";

import { backofficeColors as c } from "../kit";

const COLUMNS = ["Cuenta", "Acceso", "Racha", "Última actividad", "Alta"] as const;

function accessLine(account: AdminAccount) {
  return account.isPro ? `Pro · ${adminProviderLabel(account.provider)}` : "Free";
}

function rowLabel(account: AdminAccount, now: number) {
  return `${adminAccountName(account)}, ${accessLine(account)}, racha ${account.currentStreak}, ${formatAdminLastActivity(account, now)}`;
}

export function AccountsList({
  accounts,
  selectedUserId,
  onSelect,
  wide,
  now
}: {
  accounts: AdminAccount[];
  selectedUserId: string | null;
  onSelect: (account: AdminAccount) => void;
  wide: boolean;
  now: number;
}) {
  // La cabecera es decorativa para el lector de pantalla: cada fila ya se
  // anuncia con sus valores nombrados (`rowLabel`), así que repetir los títulos
  // columna por columna sólo agregaría ruido.
  if (wide) {
    return (
      <View accessibilityLabel="Cuentas" accessibilityRole="list" style={styles.table}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.headRow}>
          {COLUMNS.map((column) => (
            <Text key={column} style={[styles.headCell, column === "Cuenta" && styles.cellWide]}>
              {column}
            </Text>
          ))}
        </View>
        {accounts.map((account) => {
          const selected = account.userId === selectedUserId;
          return (
            <Pressable
              accessibilityLabel={rowLabel(account, now)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={account.userId}
              onPress={() => onSelect(account)}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <View style={[styles.cell, styles.cellWide]}>
                <Text numberOfLines={1} style={styles.primary}>
                  {adminAccountName(account)}
                </Text>
                <Text numberOfLines={1} style={styles.secondary}>
                  {account.email ?? account.clerkUserId}
                </Text>
              </View>
              <Text style={[styles.cellText, account.isPro && styles.pro]}>{accessLine(account)}</Text>
              <Text style={styles.cellText}>
                {account.currentStreak} · máx {account.longestStreak}
              </Text>
              <Text style={styles.cellText}>{formatAdminLastActivity(account, now)}</Text>
              <Text style={styles.cellText}>{formatAdminDate(account.createdAt)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View accessibilityLabel="Cuentas" accessibilityRole="list" style={styles.cards}>
      {accounts.map((account) => {
        const selected = account.userId === selectedUserId;
        return (
          <Pressable
            accessibilityLabel={rowLabel(account, now)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={account.userId}
            onPress={() => onSelect(account)}
            style={[styles.card, selected && styles.rowSelected]}
          >
            <Text numberOfLines={1} style={styles.primary}>
              {adminAccountName(account)}
            </Text>
            <Text numberOfLines={1} style={styles.secondary}>
              {account.email ?? account.clerkUserId}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={[styles.chip, account.isPro && styles.pro]}>{accessLine(account)}</Text>
              <Text style={styles.chip}>Racha {account.currentStreak}</Text>
              <Text style={styles.chip}>{formatAdminLastActivity(account, now)}</Text>
              <Text style={styles.chip}>Alta {formatAdminDate(account.createdAt)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  headRow: {
    backgroundColor: c.panelSoft,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  headCell: {
    color: c.muted,
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    minWidth: 0,
    textTransform: "uppercase"
  },
  row: {
    alignItems: "center",
    borderTopColor: c.faint,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rowSelected: {
    backgroundColor: "rgba(216, 180, 106, 0.10)",
    borderColor: c.copper
  },
  cell: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  cellWide: {
    flex: 2
  },
  cellText: {
    color: c.ink,
    flex: 1,
    fontSize: 13,
    minWidth: 0
  },
  primary: {
    color: c.ink,
    fontSize: 14,
    fontWeight: "700"
  },
  secondary: {
    color: c.muted,
    fontSize: 12
  },
  pro: {
    color: c.copper,
    fontWeight: "800"
  },
  cards: {
    gap: 8
  },
  card: {
    backgroundColor: c.panelSoft,
    borderColor: c.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    minHeight: 44,
    padding: 12
  },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4
  },
  chip: {
    color: c.muted,
    fontSize: 12
  }
});
