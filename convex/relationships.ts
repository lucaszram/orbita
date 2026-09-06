import {
  actionGeneric as action,
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation,
  queryGeneric as query
} from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { runAstrologyApiNatalChart } from "./lib/astrologyApi";
import { findCurrentNatalChart } from "./lib/birthDataConsistency";
import { extractNormalizedChartFromPayload, getZodiacPlacement, type NormalizedAstroChart } from "./lib/orbita";
import { isUserPro } from "./lib/subscriptionAccess";
import {
  computeSynastryContacts,
  FREE_CONTACT_LIMIT,
  signTone,
  summarizeSynastry,
  synastryPrecision,
  type SynastryContact,
  type SynastryLevel
} from "./lib/synastry";
import { findCurrentUser, findUserByTokenIdentifier, omitUndefined, requireIdentity, requireUser } from "./lib/users";

const internalApi = internal as any;
const RELATIONSHIP_CHART_VERSION = "orbita-relationship-chart-v1";
const RELATION_KINDS = new Set([
  // Mismas claves que `relationshipTypeValidator` en la línea de producción (release/1.0.0).
  "romantic",
  "parent_or_caregiver",
  "child",
  "sibling",
  "friendship",
  "work_or_project",
  "other",
  "prefer_not_to_say"
]);
const SIGNS = new Set([
  "aries",
  "tauro",
  "geminis",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "escorpio",
  "sagitario",
  "capricornio",
  "acuario",
  "piscis"
]);
const DISCLAIMER = "Órbita es entretenimiento y autoconocimiento. Una comparación de cartas no predice ni garantiza cómo va a ir un vínculo.";

export const getActive = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;
    return await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .first();
  }
});

/** Alta histórica (build ≤ 16). Se conserva por compatibilidad; CORE-212 usa `addPerson`. */
export const upsert = mutation({
  args: {
    name: v.string(),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthPlaceLabel: v.optional(v.string()),
    zodiacSign: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const active = await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .first();

    const payload = omitUndefined({
      userId: user._id,
      name: args.name.trim(),
      birthDate: args.birthDate,
      birthTime: args.birthTime,
      birthPlaceLabel: args.birthPlaceLabel,
      zodiacSign: args.zodiacSign,
      isActive: true,
      updatedAt: now
    });

    if (active) {
      await ctx.db.patch(active._id, payload);
      return active._id;
    }

    return await ctx.db.insert("relationshipProfiles", {
      ...payload,
      createdAt: now,
      updatedAt: now
    });
  }
});

// ---------------------------------------------------------------------------
// CORE-212 — la primera persona y su comparación
// ---------------------------------------------------------------------------

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && y >= 1900 && y <= 2100;
}

function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * `relationships.addPerson` — guarda a la persona con el nivel de datos que
 * la interfaz declaró y, cuando el nivel lo permite, calcula y persiste su
 * carta con el mismo proveedor que la carta propia. Cada alta crea una persona
 * nueva y la deja activa (CORE-213: la biblioteca conserva a las demás); con
 * `profileId` se editan los datos de una persona ya guardada, reemplazando la
 * fila completa para que no quede una carta de un nivel anterior.
 *
 * Niveles:
 * - `signo`: nombre y signo solar. No se llama al proveedor; no hay contactos.
 * - `fecha`: fecha (lugar opcional). Sin hora se calcula al mediodía; sin
 *   lugar, al mediodía UTC con coordenadas neutras: los planetas lentos no
 *   dependen del lugar y la Luna se declara aproximada.
 * - `carta`: fecha, hora y lugar con coordenadas. Suma casas y ejes.
 *
 * Nada se inventa: si el proveedor no está configurado o falla, la persona se
 * guarda igual con `chartStatus` explícito y la comparación lo dice.
 */
export const addPerson = action({
  args: {
    name: v.string(),
    level: v.union(v.literal("signo"), v.literal("fecha"), v.literal("carta")),
    relationshipType: v.optional(v.string()),
    zodiacSign: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthPlaceLabel: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    /** Editar una persona ya guardada (propia). Sin él, se crea una nueva. */
    profileId: v.optional(v.id("relationshipProfiles"))
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx as any);
    const name = args.name.trim();
    if (name.length < 1 || name.length > 60) throw new Error("PERSON_NAME_INVALID");
    // Al editar, la propiedad se comprueba ANTES de llamar al proveedor: un id
    // ajeno no cuesta una llamada ni llega a la mutation.
    if (args.profileId) {
      const owned: any = await ctx.runQuery(internalApi.relationships.ownedProfile, {
        tokenIdentifier: identity.tokenIdentifier,
        profileId: args.profileId
      });
      if (!owned) throw new Error("RELATIONSHIP_PROFILE_NOT_FOUND");
    }
    const relationshipType = args.relationshipType ? normalizeKey(args.relationshipType) : undefined;
    if (relationshipType && !RELATION_KINDS.has(relationshipType)) throw new Error("RELATION_KIND_INVALID");

    const level: SynastryLevel = args.level;
    let zodiacSign = args.zodiacSign ? normalizeKey(args.zodiacSign) : undefined;
    const birthDate = args.birthDate?.trim();
    const birthTime = args.birthTime?.trim();
    const birthPlaceLabel = args.birthPlaceLabel?.trim();
    const hasCoordinates = typeof args.latitude === "number" && typeof args.longitude === "number";

    if (level === "signo") {
      if (!zodiacSign || !SIGNS.has(zodiacSign)) throw new Error("ZODIAC_SIGN_REQUIRED");
    } else {
      if (!birthDate || !isIsoDate(birthDate)) throw new Error("BIRTH_DATE_INVALID");
      zodiacSign = normalizeKey(getZodiacPlacement(birthDate).sign);
    }
    if (level === "carta") {
      if (!birthTime || !isTime(birthTime)) throw new Error("BIRTH_TIME_INVALID");
      if (!birthPlaceLabel || !hasCoordinates) throw new Error("BIRTH_PLACE_REQUIRED");
    }
    if (birthTime && !isTime(birthTime)) throw new Error("BIRTH_TIME_INVALID");
    // Una hora sin lugar no se puede ubicar en una zona horaria: no se acepta a
    // medias ni se descarta en silencio.
    if (birthTime && !hasCoordinates) throw new Error("BIRTH_PLACE_REQUIRED_FOR_TIME");
    const usesTime = level !== "signo" && Boolean(birthTime) && hasCoordinates;
    if (hasCoordinates && (Math.abs(args.latitude as number) > 90 || Math.abs(args.longitude as number) > 180)) {
      throw new Error("COORDINATES_INVALID");
    }

    let chartStatus: "ready" | "not_needed" | "not_configured" | "error" = "not_needed";
    let chartPayload: NormalizedAstroChart | undefined;
    let timezone: string | undefined;
    let birthTimePrecision: "known" | "unknown" | undefined;
    if (level !== "signo") {
      birthTimePrecision = usesTime ? "known" : "unknown";
      // La zona sale de la action Node `placeTimezone.atCoordinates` (geo-tz
      // usa `fs`): esta action corre en el runtime estándar y no puede
      // importarla directo.
      timezone = hasCoordinates
        ? (
            await ctx.runAction(api.placeTimezone.atCoordinates, {
              latitude: args.latitude as number,
              longitude: args.longitude as number
            })
          ).timezone
        : "UTC";
      const result = await runAstrologyApiNatalChart({
        input: {
          birthDate: birthDate as string,
          birthTime: usesTime ? birthTime : undefined,
          birthTimePrecision,
          // Sin lugar (nivel fecha) la carta se calcula al mediodía UTC en 0°/0°:
          // las casas que devuelva el proveedor NO son un dato —`chartHasRealTime`
          // las deja fuera de la comparación— y las coordenadas no se persisten.
          birthPlaceLabel: birthPlaceLabel ?? "Sin lugar (mediodía UTC)",
          latitude: hasCoordinates ? (args.latitude as number) : 0,
          longitude: hasCoordinates ? (args.longitude as number) : 0,
          timezone
        },
        localDate: birthDate as string
      });
      if (result.status === "success" && result.normalized?.chart) {
        chartStatus = "ready";
        chartPayload = result.normalized.chart;
      } else if (result.status === "not_configured") {
        chartStatus = "not_configured";
      } else {
        chartStatus = "error";
      }
    }

    const saved: any = await ctx.runMutation(
      internalApi.relationships.persistPerson,
      omitUndefined({
        tokenIdentifier: identity.tokenIdentifier,
        profileId: args.profileId,
        name,
        relationshipType,
        level,
        zodiacSign,
        birthDate: level === "signo" ? undefined : birthDate,
        birthTime: usesTime ? birthTime : undefined,
        birthTimePrecision,
        birthPlaceLabel: level === "signo" ? undefined : birthPlaceLabel,
        latitude: hasCoordinates && level !== "signo" ? args.latitude : undefined,
        longitude: hasCoordinates && level !== "signo" ? args.longitude : undefined,
        timezone,
        chartStatus,
        chartPayload
      })
    );
    return { relationshipProfileId: saved.id as string, chartStatus, level };
  }
});

export const persistPerson = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    profileId: v.optional(v.id("relationshipProfiles")),
    name: v.string(),
    relationshipType: v.optional(v.string()),
    level: v.union(v.literal("signo"), v.literal("fecha"), v.literal("carta")),
    zodiacSign: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthTimePrecision: v.optional(v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"))),
    birthPlaceLabel: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.optional(v.string()),
    chartStatus: v.union(v.literal("ready"), v.literal("not_needed"), v.literal("not_configured"), v.literal("error")),
    chartPayload: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const now = Date.now();
    const { tokenIdentifier: _token, profileId, ...fields } = args;
    // La persona nueva (o editada) queda activa; las demás siguen guardadas,
    // sólo pierden la marca. `by_user_active` sigue apuntando a una sola.
    const actives = await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .collect();
    for (const row of actives) {
      if (!profileId || row._id !== profileId) await ctx.db.patch(row._id, { isActive: false, updatedAt: now });
    }
    // Reemplazo completo al editar: los campos que el nivel nuevo no trae se
    // borran, así una persona guardada «con carta» y vuelta a guardar «con
    // signo» no conserva una carta que ya no corresponde.
    const record = {
      userId: user._id,
      name: fields.name,
      relationshipType: fields.relationshipType,
      level: fields.level,
      zodiacSign: fields.zodiacSign,
      birthDate: fields.birthDate,
      birthTime: fields.birthTime,
      birthTimePrecision: fields.birthTimePrecision,
      birthPlaceLabel: fields.birthPlaceLabel,
      latitude: fields.latitude,
      longitude: fields.longitude,
      timezone: fields.timezone,
      chartStatus: fields.chartStatus,
      chartVersion: fields.chartPayload ? RELATIONSHIP_CHART_VERSION : undefined,
      chartPayload: fields.chartPayload,
      isActive: true,
      updatedAt: now
    };
    if (profileId) {
      const existing = await ctx.db.get(profileId);
      if (!existing || existing.userId !== user._id) throw new Error("RELATIONSHIP_PROFILE_NOT_FOUND");
      // Renombrar no puede perder una carta ya calculada: si los insumos de la
      // carta no cambiaron y el proveedor falló esta vez, se conserva la que
      // había en vez de bajarla a `error`.
      const sameInputs =
        existing.level === record.level &&
        existing.birthDate === record.birthDate &&
        existing.birthTime === record.birthTime &&
        existing.latitude === record.latitude &&
        existing.longitude === record.longitude;
      const keepChart = sameInputs && existing.chartStatus === "ready" && existing.chartPayload && record.chartStatus !== "ready";
      const merged = keepChart
        ? { ...record, chartStatus: "ready" as const, chartVersion: existing.chartVersion, chartPayload: existing.chartPayload }
        : record;
      await ctx.db.replace(profileId, { ...merged, createdAt: existing.createdAt });
      return { id: profileId };
    }
    const id = await ctx.db.insert("relationshipProfiles", { ...record, createdAt: now });
    return { id };
  }
});

/** ¿Este perfil es de la persona con sesión? Para validar antes de llamar al proveedor. */
export const ownedProfile = internalQuery({
  args: { tokenIdentifier: v.string(), profileId: v.id("relationshipProfiles") },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) return null;
    const row = await ctx.db.get(args.profileId);
    return row && row.userId === user._id ? { id: row._id } : null;
  }
});

/** Estado interno para acciones que necesiten la persona activa (no se usa desde el cliente). */
export const activeState = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) throw new Error("User record not found");
    const person = await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .first();
    return { userId: user._id, person };
  }
});

export type VinculoComparacionStatus =
  | "ready"
  | "no_person"
  | "needs_natal_chart"
  | "person_chart_unavailable";

/**
 * `relationships.synastry` — la comparación entre la carta propia y la
 * de la persona guardada, reactiva. Devuelve siempre un sobre con `status`:
 * `no_person` (nada guardado), `needs_natal_chart` (la propia carta no está
 * calculada), `person_chart_unavailable` (la persona tiene fecha pero el
 * proveedor no devolvió su carta) o `ready`. En Free la lista de contactos se
 * corta en `FREE_CONTACT_LIMIT` y `hiddenContacts` dice cuántos faltan; los
 * conteos y las dimensiones siempre se calculan sobre la lista entera.
 */
export const synastry = query({
  args: {
    /** Una persona concreta de la biblioteca (CORE-213). Sin él, la activa. */
    profileId: v.optional(v.id("relationshipProfiles"))
  },
  handler: async (ctx, args) => {
    const user = await findCurrentUser(ctx);
    if (!user) return { status: "no_person" as const, person: null };
    const person = args.profileId
      ? await ctx.db.get(args.profileId)
      : await ctx.db
          .query("relationshipProfiles")
          .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
          .first();
    if (!person || person.userId !== user._id) return { status: "no_person" as const, person: null };

    const personSummary = personSummaryOf(person);

    const natalChart = await findCurrentNatalChart(ctx, user._id);
    const chartA = extractNormalizedChartFromPayload(natalChart?.payload);
    if (!chartA) {
      return { status: "needs_natal_chart" as const, person: personSummary };
    }
    const isPro = await isUserPro(ctx, user._id);
    const mySun = chartA.summary.sun?.signEs ?? null;
    const theirSign = personSummary.zodiacSign;
    const pairing = `${mySun ? capitalizeSign(mySun) : "Tu Sol"} + ${theirSign ? capitalizeSign(theirSign) : personSummary.name}`;

    if (personSummary.level === "signo") {
      // `signEs` es la clave en español que `elementOfSign` conoce; `sign` viene en
      // inglés del proveedor (`Gemini`, `Scorpio`) y no sirve de clave.
      const tone = mySun && theirSign ? signTone(mySun, theirSign) : null;
      return {
        status: "ready" as const,
        person: personSummary,
        precision: synastryPrecision({ level: "signo", chartA, chartB: null }),
        pairing,
        tone,
        contacts: [] as SynastryContact[],
        hiddenContacts: 0,
        summary: summarizeSynastry([]),
        access: { isPro, contactLimit: isPro ? null : FREE_CONTACT_LIMIT },
        disclaimer: DISCLAIMER
      };
    }

    const chartB = extractNormalizedChartFromPayload(person.chartPayload);
    if (!chartB) {
      return {
        status: "person_chart_unavailable" as const,
        person: personSummary,
        pairing,
        disclaimer: DISCLAIMER
      };
    }
    const contacts = computeSynastryContacts(chartA, chartB);
    const visible = isPro ? contacts : contacts.slice(0, FREE_CONTACT_LIMIT);
    return {
      status: "ready" as const,
      person: personSummary,
      precision: synastryPrecision({ level: personSummary.level, chartA, chartB }),
      pairing,
      tone: mySun && theirSign ? signTone(mySun, theirSign) : null,
      contacts: visible,
      hiddenContacts: contacts.length - visible.length,
      summary: summarizeSynastry(contacts),
      access: { isPro, contactLimit: isPro ? null : FREE_CONTACT_LIMIT },
      disclaimer: DISCLAIMER
    };
  }
});

function inferLevel(person: any): SynastryLevel {
  if (!person.birthDate) return "signo";
  if (person.birthTime && typeof person.latitude === "number") return "carta";
  return "fecha";
}

function capitalizeSign(sign: string) {
  const labels: Record<string, string> = {
    aries: "Aries",
    tauro: "Tauro",
    geminis: "Géminis",
    cancer: "Cáncer",
    leo: "Leo",
    virgo: "Virgo",
    libra: "Libra",
    escorpio: "Escorpio",
    sagitario: "Sagitario",
    capricornio: "Capricornio",
    acuario: "Acuario",
    piscis: "Piscis"
  };
  return labels[sign] ?? sign;
}

// --- CORE-213: la biblioteca de personas guardadas --------------------------

/** El resumen público de una persona guardada: sólo datos autorizados y su nivel. */
function personSummaryOf(person: any) {
  return {
    id: person._id as string,
    name: person.name as string,
    relationshipType: (person.relationshipType as string | undefined) ?? null,
    level: ((person.level as SynastryLevel | undefined) ?? inferLevel(person)) as SynastryLevel,
    zodiacSign: (person.zodiacSign as string | undefined) ?? null,
    birthDate: (person.birthDate as string | undefined) ?? null,
    birthTime: (person.birthTime as string | undefined) ?? null,
    birthPlaceLabel: (person.birthPlaceLabel as string | undefined) ?? null,
    chartStatus: ((person.chartStatus as string | undefined) ?? (person.chartPayload ? "ready" : "not_needed")) as string,
    isActive: Boolean(person.isActive),
    savedAt: (person.createdAt as number | undefined) ?? 0
  };
}

/**
 * `relationships.listPeople` — todas las personas guardadas de la cuenta, de
 * la más reciente a la más antigua, con la activa marcada. Reactiva: guardar,
 * editar o elegir a alguien actualiza la lista sola. Sin sesión: lista vacía.
 */
export const listPeople = query({
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return { people: [], activeId: null };
    const rows = await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
    const people = rows.map(personSummaryOf).sort((a, b) => b.savedAt - a.savedAt);
    const active = people.find((p) => p.isActive) ?? null;
    return { people, activeId: active ? active.id : null };
  }
});

/**
 * `relationships.selectPerson({ profileId })` — deja activa a una persona de la
 * biblioteca. No calcula nada: la comparación de cada persona sale de su carta
 * ya guardada, así que elegir no genera otra por navegar.
 */
export const selectPerson = mutation({
  args: { profileId: v.id("relationshipProfiles") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const target = await ctx.db.get(args.profileId);
    if (!target || target.userId !== user._id) throw new Error("RELATIONSHIP_PROFILE_NOT_FOUND");
    const now = Date.now();
    const actives = await ctx.db
      .query("relationshipProfiles")
      .withIndex("by_user_active", (q: any) => q.eq("userId", user._id).eq("isActive", true))
      .collect();
    for (const row of actives) {
      if (row._id !== target._id) await ctx.db.patch(row._id, { isActive: false, updatedAt: now });
    }
    if (!target.isActive) await ctx.db.patch(target._id, { isActive: true, updatedAt: now });
    return { profileId: target._id };
  }
});
