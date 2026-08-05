/**
 * Controles de la consulta: rango de métricas, búsqueda, segmento y orden.
 *
 * Rango y segmento/orden viven separados a propósito: el rango sólo mueve las
 * métricas del dashboard, mientras que segmento y orden re-arman el listado (y
 * con él el cursor de paginación).
 */
import { StyleSheet, View } from "react-native";

import {
  ADMIN_RANGES,
  ADMIN_SEGMENTS,
  ADMIN_SORTS,
  type AdminRange,
  type AdminSegment,
  type AdminSort
} from "@/domain/adminAccounts";

import { AdminChoiceGroup, AdminField, AdminInput } from "../kit";

export function AccountsFilters({
  range,
  onRangeChange,
  search,
  onSearchChange,
  segment,
  onSegmentChange,
  sort,
  onSortChange,
  sortDisabled
}: {
  range: AdminRange;
  onRangeChange: (value: AdminRange) => void;
  search: string;
  onSearchChange: (value: string) => void;
  segment: AdminSegment;
  onSegmentChange: (value: AdminSegment) => void;
  sort: AdminSort;
  onSortChange: (value: AdminSort) => void;
  sortDisabled: boolean;
}) {
  return (
    <View style={styles.row}>
      <AdminField label="Rango de métricas">
        <AdminChoiceGroup label="Rango de métricas" onChange={onRangeChange} options={ADMIN_RANGES} value={range} />
      </AdminField>
      <AdminField hint="Nombre, email, id de Clerk o id de Convex." label="Buscar">
        <AdminInput
          label="Buscar cuentas"
          onChangeText={onSearchChange}
          placeholder="mica@…, user_…"
          value={search}
        />
      </AdminField>
      <AdminField label="Segmento">
        <AdminChoiceGroup label="Segmento" onChange={onSegmentChange} options={ADMIN_SEGMENTS} value={segment} />
      </AdminField>
      <AdminField
        hint={sortDisabled ? "La búsqueda usa relevancia: el orden vuelve al limpiar el texto." : undefined}
        label="Orden"
      >
        <AdminChoiceGroup
          disabled={sortDisabled}
          label="Orden del listado"
          onChange={onSortChange}
          options={ADMIN_SORTS}
          value={sort}
        />
      </AdminField>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14
  }
});
