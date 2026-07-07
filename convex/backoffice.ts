import { actionGeneric as action, mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { resolvePlaceWithAstrologyApi, runAstrologyApiProvider } from "./lib/astrologyApi";
import { buildAstrologicalLabRunPayload, buildLabRunPayload, normalizeBirthInput } from "./lib/orbita";
import { requireBackofficeExistingUser, requireBackofficeIdentity, requireBackofficeUser } from "./lib/backoffice";
import { omitUndefined } from "./lib/users";

const birthTimePrecisionValidator = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));
const reviewStatusValidator = v.union(v.literal("needs_review"), v.literal("approved"), v.literal("rejected"));

const subjectArgs = {
  displayName: v.string(),
  birthDate: v.string(),
  birthTime: v.optional(v.string()),
  birthTimePrecision: birthTimePrecisionValidator,
  birthPlaceLabel: v.string(),
  placeId: v.optional(v.string()),
  placeProvider: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  timezone: v.string(),
  notes: v.optional(v.string())
};

type SubjectInput = {
  displayName: string;
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  placeId?: string;
  placeProvider?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  notes?: string;
};

const fixtureSubjects: SubjectInput[] = [
  {
    displayName: "Fixture Aries exacta",
    birthDate: "1994-04-12",
    birthTime: "09:15",
    birthTimePrecision: "known",
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires",
    notes: "Hora exacta, fuego, ciudad base."
  },
  {
    displayName: "Fixture Tauro sin hora",
    birthDate: "1992-05-08",
    birthTimePrecision: "unknown",
    birthPlaceLabel: "Cordoba, Argentina",
    latitude: -31.4201,
    longitude: -64.1888,
    timezone: "America/Argentina/Cordoba",
    notes: "Caso para probar lectura aproximada sin ascendente firme."
  },
  {
    displayName: "Fixture Geminis aprox",
    birthDate: "1990-06-06",
    birthTime: "14:00",
    birthTimePrecision: "approximate",
    birthPlaceLabel: "Montevideo, Uruguay",
    latitude: -34.9011,
    longitude: -56.1645,
    timezone: "America/Montevideo",
    notes: "Hora aproximada y timezone regional."
  },
  {
    displayName: "Fixture Cancer exacta",
    birthDate: "1988-07-10",
    birthTime: "23:40",
    birthTimePrecision: "known",
    birthPlaceLabel: "Santiago, Chile",
    latitude: -33.4489,
    longitude: -70.6693,
    timezone: "America/Santiago",
    notes: "Prueba de offset con posible horario de invierno."
  },
  {
    displayName: "Fixture Leo exacta",
    birthDate: "1995-08-05",
    birthTime: "06:20",
    birthTimePrecision: "known",
    birthPlaceLabel: "Madrid, Spain",
    latitude: 40.4168,
    longitude: -3.7038,
    timezone: "Europe/Madrid",
    notes: "Europa, offset positivo."
  },
  {
    displayName: "Fixture Virgo exacta",
    birthDate: "1993-09-12",
    birthTime: "16:05",
    birthTimePrecision: "known",
    birthPlaceLabel: "Mexico City, Mexico",
    latitude: 19.4326,
    longitude: -99.1332,
    timezone: "America/Mexico_City",
    notes: "Latitud norte y America."
  },
  {
    displayName: "Fixture Libra exacta",
    birthDate: "1991-10-03",
    birthTime: "11:30",
    birthTimePrecision: "known",
    birthPlaceLabel: "Lima, Peru",
    latitude: -12.0464,
    longitude: -77.0428,
    timezone: "America/Lima",
    notes: "Prueba de timezone sin DST."
  },
  {
    displayName: "Fixture Escorpio exacta",
    birthDate: "1989-11-11",
    birthTime: "02:45",
    birthTimePrecision: "known",
    birthPlaceLabel: "Bogota, Colombia",
    latitude: 4.711,
    longitude: -74.0721,
    timezone: "America/Bogota",
    notes: "Madrugada y hemisferio norte cercano al ecuador."
  },
  {
    displayName: "Fixture Sagitario exacta",
    birthDate: "1997-12-04",
    birthTime: "18:10",
    birthTimePrecision: "known",
    birthPlaceLabel: "New York, USA",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
    notes: "DST/offset USA."
  },
  {
    displayName: "Fixture Capricornio exacta",
    birthDate: "1996-01-15",
    birthTime: "08:30",
    birthTimePrecision: "known",
    birthPlaceLabel: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires",
    notes: "Caso base historico del lab."
  },
  {
    displayName: "Fixture Acuario exacta",
    birthDate: "1994-02-09",
    birthTime: "20:25",
    birthTimePrecision: "known",
    birthPlaceLabel: "Barcelona, Spain",
    latitude: 41.3874,
    longitude: 2.1686,
    timezone: "Europe/Madrid",
    notes: "Ciudad europea para comparar casas."
  },
  {
    displayName: "Fixture Piscis exacta",
    birthDate: "1998-03-05",
    birthTime: "05:50",
    birthTimePrecision: "known",
    birthPlaceLabel: "Los Angeles, USA",
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: "America/Los_Angeles",
    notes: "Costa oeste USA."
  }
];

function normalizeSubjectArgs(args: SubjectInput): SubjectInput {
  const normalizedInput = normalizeBirthInput({
    birthDate: args.birthDate,
    birthTime: args.birthTime,
    birthTimePrecision: args.birthTimePrecision,
    birthPlaceLabel: args.birthPlaceLabel,
    latitude: args.latitude,
    longitude: args.longitude,
    timezone: args.timezone
  });

  const displayName = args.displayName.trim();
  if (!displayName) {
    throw new Error("Subject displayName is required.");
  }

  return omitUndefined({
    displayName,
    birthDate: normalizedInput.birthDate,
    birthTime: normalizedInput.birthTime,
    birthTimePrecision: normalizedInput.birthTimePrecision,
    birthPlaceLabel: normalizedInput.birthPlaceLabel,
    placeId: args.placeId?.trim() || undefined,
    placeProvider: args.placeProvider?.trim() || undefined,
    latitude: normalizedInput.latitude,
    longitude: normalizedInput.longitude,
    timezone: normalizedInput.timezone,
    notes: args.notes?.trim() || undefined
  }) as SubjectInput;
}

export const listSubjects = query({
  handler: async (ctx) => {
    const user = await requireBackofficeExistingUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("labSubjects")
      .withIndex("by_createdBy_updatedAt", (q: any) => q.eq("createdByUserId", user._id))
      .order("desc")
      .take(100);
  }
});

export const upsertSubject = mutation({
  args: {
    subjectId: v.optional(v.id("labSubjects")),
    ...subjectArgs
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeUser(ctx);
    const now = Date.now();
    const payload = normalizeSubjectArgs(args);

    if (args.subjectId) {
      const existing = await ctx.db.get(args.subjectId);
      if (!existing || existing.createdByUserId !== user._id) {
        throw new Error("Lab subject not found.");
      }

      await ctx.db.patch(args.subjectId, {
        ...payload,
        updatedAt: now
      });
      return args.subjectId;
    }

    return await ctx.db.insert("labSubjects", {
      ...payload,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const seedSubjects = mutation({
  handler: async (ctx) => {
    const user = await requireBackofficeUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("labSubjects")
      .withIndex("by_createdBy_updatedAt", (q: any) => q.eq("createdByUserId", user._id))
      .take(200);
    const existingNames = new Set(existing.map((subject: any) => subject.displayName));
    let created = 0;

    for (const fixture of fixtureSubjects) {
      if (existingNames.has(fixture.displayName)) {
        continue;
      }

      await ctx.db.insert("labSubjects", {
        ...normalizeSubjectArgs(fixture),
        createdByUserId: user._id,
        createdAt: now,
        updatedAt: now
      });
      created += 1;
    }

    return { created, total: fixtureSubjects.length };
  }
});

export const runModel = mutation({
  args: {
    subjectId: v.id("labSubjects"),
    localDate: v.string(),
    timezone: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeUser(ctx);
    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.createdByUserId !== user._id) {
      throw new Error("Lab subject not found.");
    }

    const timezone = args.timezone?.trim() || subject.timezone;
    const runPayload = buildLabRunPayload({
      localDate: args.localDate.trim(),
      input: {
        birthDate: subject.birthDate,
        birthTime: subject.birthTime,
        birthTimePrecision: subject.birthTimePrecision,
        birthPlaceLabel: subject.birthPlaceLabel,
        latitude: subject.latitude,
        longitude: subject.longitude,
        timezone
      }
    });

    const runId = await ctx.db.insert("labRuns", {
      createdByUserId: user._id,
      subjectId: subject._id,
      localDate: args.localDate.trim(),
      timezone,
      normalizedInput: runPayload.normalizedInput,
      chartPayload: runPayload.chart,
      dailyReadingPayload: runPayload.dailyReading,
      modelVersions: runPayload.modelVersions,
      modelGaps: runPayload.modelGaps,
      reviewStatus: "needs_review",
      createdAt: Date.now()
    });

    return await ctx.db.get(runId);
  }
});

export const previewAstrologyRun = action({
  args: {
    subjectId: v.optional(v.string()),
    ...subjectArgs,
    localDate: v.string(),
    runTimezone: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireBackofficeIdentity(ctx);
    const subject = normalizeSubjectArgs(args);
    const timezone = args.runTimezone?.trim() || subject.timezone;
    const input = {
      birthDate: subject.birthDate,
      birthTime: subject.birthTime,
      birthTimePrecision: subject.birthTimePrecision,
      birthPlaceLabel: subject.birthPlaceLabel,
      latitude: subject.latitude,
      longitude: subject.longitude,
      timezone
    };
    const providerResult = await runAstrologyApiProvider({
      input,
      localDate: args.localDate.trim()
    });

    return buildAstrologicalLabRunPayload({
      localDate: args.localDate.trim(),
      input,
      providerResult
    });
  }
});

export const saveLabRun = mutation({
  args: {
    subjectId: v.id("labSubjects"),
    localDate: v.string(),
    timezone: v.string(),
    normalizedInput: v.any(),
    chartPayload: v.any(),
    dailyReadingPayload: v.any(),
    modelVersions: v.object({
      chart: v.string(),
      dailyReading: v.string()
    }),
    modelGaps: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeUser(ctx);
    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.createdByUserId !== user._id) {
      throw new Error("Lab subject not found.");
    }

    const runId = await ctx.db.insert("labRuns", {
      createdByUserId: user._id,
      subjectId: subject._id,
      localDate: args.localDate.trim(),
      timezone: args.timezone.trim(),
      normalizedInput: args.normalizedInput,
      chartPayload: args.chartPayload,
      dailyReadingPayload: args.dailyReadingPayload,
      modelVersions: args.modelVersions,
      modelGaps: args.modelGaps,
      reviewStatus: "needs_review",
      createdAt: Date.now()
    });

    return await ctx.db.get(runId);
  }
});

export const reviewRun = mutation({
  args: {
    runId: v.id("labRuns"),
    reviewStatus: reviewStatusValidator,
    reviewNote: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeUser(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.createdByUserId !== user._id) {
      throw new Error("Lab run not found.");
    }

    await ctx.db.patch(args.runId, {
      reviewStatus: args.reviewStatus,
      reviewNote: args.reviewNote?.trim() || undefined,
      reviewedAt: Date.now()
    });

    return await ctx.db.get(args.runId);
  }
});

export const updateRunEditorialPayload = mutation({
  args: {
    runId: v.id("labRuns"),
    editorialPayload: v.any()
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeUser(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.createdByUserId !== user._id) {
      throw new Error("Lab run not found.");
    }

    await ctx.db.patch(args.runId, {
      editorialPayload: args.editorialPayload,
      editorialUpdatedAt: Date.now()
    });

    return await ctx.db.get(args.runId);
  }
});

export const saveFutureSelfNote = mutation({
  args: {
    runId: v.id("labRuns"),
    futureSelfNote: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeUser(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.createdByUserId !== user._id) {
      throw new Error("Lab run not found.");
    }

    const note = args.futureSelfNote?.trim();
    await ctx.db.patch(args.runId, {
      futureSelfNote: note || undefined,
      editorialUpdatedAt: Date.now()
    });

    return await ctx.db.get(args.runId);
  }
});

export const resolvePlace = action({
  args: {
    query: v.string()
  },
  handler: async (ctx, args) => {
    await requireBackofficeIdentity(ctx);
    return await resolvePlaceWithAstrologyApi(args.query);
  }
});

export const listRuns = query({
  args: {
    subjectId: v.optional(v.id("labSubjects"))
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeExistingUser(ctx);
    if (!user) {
      return [];
    }

    if (args.subjectId) {
      const subject = await ctx.db.get(args.subjectId);
      if (!subject || subject.createdByUserId !== user._id) {
        throw new Error("Lab subject not found.");
      }

      return await ctx.db
        .query("labRuns")
        .withIndex("by_subject_createdAt", (q: any) => q.eq("subjectId", args.subjectId))
        .order("desc")
        .take(20);
    }

    return await ctx.db
      .query("labRuns")
      .withIndex("by_createdBy_createdAt", (q: any) => q.eq("createdByUserId", user._id))
      .order("desc")
      .take(20);
  }
});

export const getRun = query({
  args: {
    runId: v.id("labRuns")
  },
  handler: async (ctx, args) => {
    const user = await requireBackofficeExistingUser(ctx);
    if (!user) {
      throw new Error("Lab run not found.");
    }

    const run = await ctx.db.get(args.runId);
    if (!run || run.createdByUserId !== user._id) {
      throw new Error("Lab run not found.");
    }

    const subject = await ctx.db.get(run.subjectId);
    return {
      run,
      subject
    };
  }
});
