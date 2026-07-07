import { HomeReading } from "./types";

/**
 * Adapta el payload de `readings.getToday` (Convex, hoy stub editorial de
 * `convex/lib/orbita.ts#buildDailyReadingPayload`) al `HomeReading` local.
 * Defensivo campo a campo: todo lo que el backend no traiga cae al fallback
 * del engine local, para que la Home nunca muestre huecos.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | undefined {
  const v = record?.[key];
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

/** Acepta string o lista (el Home Lab pide 3 ítems para hacé/evitá). */
function readStringOrList(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (Array.isArray(value)) {
    const items = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (items.length > 0) return items.join(" · ");
  }
  return undefined;
}

export function toHomeReading(payload: unknown, fallback: HomeReading): HomeReading {
  const p = asRecord(payload);
  if (!p) return fallback;

  const modules = asRecord(p.modules);
  const longRead = asRecord(p.longRead);
  const topicsRaw = Array.isArray(p.topics) ? p.topics.map(asRecord) : [];

  const topics = fallback.topics.map((ft) => {
    const match = topicsRaw.find((t) => t && t.topic === ft.topic);
    if (!match) return ft;
    return {
      ...ft,
      title: readString(match, "title") ?? ft.title,
      oneLine: readString(match, "body") ?? ft.oneLine
    };
  });

  return {
    ...fallback,
    headline: readString(modules, "headline") ?? fallback.headline,
    hace: readStringOrList(modules?.do) ?? fallback.hace,
    evita: readStringOrList(modules?.avoid) ?? fallback.evita,
    energia: readString(modules, "energy") ?? fallback.energia,
    accion: readString(modules, "action") ?? fallback.accion,
    topics,
    longReadTitle: readString(longRead, "title") ?? fallback.longReadTitle,
    longReadBody: readString(longRead, "body") ?? fallback.longReadBody
  };
}
