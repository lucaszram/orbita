import type { TransitPanorama, TransitPanoramaRow } from "@/services/appRefs";

/**
 * Tránsitos · AHORA — cómo se lee el panorama en pantalla (CORE-207).
 *
 * Módulo puro sobre el sobre de `transits.getPanorama`: qué filas se muestran
 * al abrir y cuántas quedan plegadas, cómo se escribe cada chip y cada línea
 * meta, y cómo se cuenta el encabezado. Ver `test/transitosPanorama.test.ts`.
 */

/** Cuántas filas se ven antes de «VER LOS N CONTACTOS». */
export const FILAS_VISIBLES = 5;

export type FilaVista = {
  transitId: string;
  rango: number;
  titulo: string;
  /** `"LUNA · MARTE"` */
  linea: string;
  /** `"ACERCÁNDOSE"` · `"INTEGRÁNDOSE"` · `"EXACTO HOY"`; `null` sin hora exacta. */
  chip: string | null;
  /** `"PICO MAÑANA · CASA 6"`, sin duplicar el chip cuando es «exacto hoy». */
  meta: string;
  /** 0–1 para la barra; `null` = sin barra (no se dibuja una vacía). */
  barra: number | null;
  cuerpo: string;
  cadencia: string | null;
};

const CHIP: Record<NonNullable<TransitPanoramaRow["phase"]>, string> = {
  acercandose: "ACERCÁNDOSE",
  integrandose: "INTEGRÁNDOSE",
  exacto: "EXACTO HOY"
};

export function filaVista(row: TransitPanoramaRow): FilaVista {
  const chip = row.phase ? CHIP[row.phase] : null;
  const meta: string[] = [];
  if (row.peakLabel && row.phase !== "exacto") meta.push(row.peakLabel);
  if (typeof row.natalHouse === "number") meta.push(`CASA ${row.natalHouse}`);
  return {
    transitId: row.transitId,
    rango: row.rank,
    titulo: row.title,
    linea: `${row.transitPlanet} · ${row.natalPoint}`,
    chip,
    meta: meta.join(" · "),
    barra: typeof row.closeness === "number" && Number.isFinite(row.closeness) ? Math.max(0, Math.min(1, row.closeness)) : null,
    cuerpo: row.body,
    cadencia: row.cadence ?? null
  };
}

/** Las filas que se muestran: las primeras `FILAS_VISIBLES`, o todas si se desplegó. */
export function filasParaMostrar(rows: readonly TransitPanoramaRow[], desplegado: boolean): FilaVista[] {
  const lista = desplegado ? rows : rows.slice(0, FILAS_VISIBLES);
  return lista.map(filaVista);
}

/** `"VER LOS 8 CONTACTOS"` mientras haya filas plegadas; `null` si ya se ven todas. */
export function etiquetaDeDespliegue(total: number, desplegado: boolean): string | null {
  if (desplegado || total <= FILAS_VISIBLES) return null;
  return `VER LOS ${total} CONTACTOS`;
}

/** `"16 CONTACTOS ACTIVOS · CAMBIA A DIARIO"` / `"1 CONTACTO ACTIVO · …"`. */
export function encabezadoDeAhora(panorama: Extract<TransitPanorama, { status: "ready" }>): string {
  const n = panorama.activeTotal;
  const contactos = n === 1 ? "1 CONTACTO ACTIVO" : `${n} CONTACTOS ACTIVOS`;
  return `${contactos} · ${panorama.cadence.toLocaleUpperCase("es")}`;
}

/** Estado de pantalla a partir del sobre (o de su ausencia). */
export type PanoramaEstado =
  | { kind: "cargando" }
  | { kind: "error" }
  | { kind: "bloqueado" }
  | { kind: "vacio" }
  | { kind: "listo"; panorama: Extract<TransitPanorama, { status: "ready" }> };

export function estadoDelPanorama(value: TransitPanorama | null | undefined): PanoramaEstado {
  if (!value || typeof value !== "object" || !("status" in value)) return { kind: "error" };
  if (value.status === "locked") return { kind: "bloqueado" };
  if (value.status === "empty") return { kind: "vacio" };
  if (value.status === "ready") {
    return Array.isArray(value.rows) && value.rows.length > 0 ? { kind: "listo", panorama: value } : { kind: "vacio" };
  }
  return { kind: "error" };
}
