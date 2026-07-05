import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const identity = v.union(v.literal("ella"), v.literal("el"), v.literal("prefiero_no_decirlo"));
const paymentState = v.union(v.literal("not_started"), v.literal("started"), v.literal("paid"), v.literal("skipped"));
const birthTimePrecision = v.union(v.literal("known"), v.literal("approximate"), v.literal("unknown"));
const entitlement = v.union(v.literal("free"), v.literal("plus"));
const subscriptionStatus = v.union(
  v.literal("inactive"),
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("expired")
);
const contentStatus = v.union(v.literal("draft"), v.literal("review"), v.literal("published"), v.literal("archived"));
const labReviewStatus = v.union(v.literal("needs_review"), v.literal("approved"), v.literal("rejected"));

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    locale: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkUserId", ["clerkUserId"]),

  onboardingDrafts: defineTable({
    userId: v.optional(v.id("users")),
    clientDraftId: v.optional(v.string()),
    currentStep: v.number(),
    identity: v.optional(identity),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthTimePrecision: v.optional(birthTimePrecision),
    birthPlaceLabel: v.optional(v.string()),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.optional(v.string()),
    accountState: v.union(v.literal("anonymous"), v.literal("created")),
    paymentState,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_clientDraftId", ["clientDraftId"]),

  birthData: defineTable({
    userId: v.id("users"),
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision,
    birthPlaceLabel: v.string(),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    source: v.union(v.literal("onboarding"), v.literal("profile"), v.literal("import")),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  natalCharts: defineTable({
    userId: v.id("users"),
    birthDataId: v.id("birthData"),
    calculationVersion: v.string(),
    payload: v.any(),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_birthData", ["birthDataId"])
    .index("by_user_version", ["userId", "calculationVersion"]),

  dailyReadings: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    timezone: v.string(),
    natalChartId: v.optional(v.id("natalCharts")),
    contentVersion: v.string(),
    payload: v.any(),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "localDate"]),

  transitReadings: defineTable({
    userId: v.id("users"),
    localDate: v.string(),
    timezone: v.string(),
    natalChartId: v.optional(v.id("natalCharts")),
    payload: v.any(),
    createdAt: v.number()
  }).index("by_user_date", ["userId", "localDate"]),

  savedReadings: defineTable({
    userId: v.id("users"),
    readingId: v.optional(v.id("dailyReadings")),
    readingDate: v.string(),
    readingPayload: v.any(),
    note: v.optional(v.string()),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_reading", ["userId", "readingId"]),

  journalEntries: defineTable({
    userId: v.id("users"),
    readingId: v.optional(v.id("dailyReadings")),
    title: v.string(),
    note: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_reading", ["readingId"]),

  relationshipProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthPlaceLabel: v.optional(v.string()),
    zodiacSign: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    enabled: v.boolean(),
    dailyTime: v.string(),
    timezone: v.string(),
    topics: v.array(v.string()),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  devices: defineTable({
    userId: v.id("users"),
    platform: v.string(),
    pushToken: v.string(),
    permissionStatus: v.string(),
    lastSeenAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_pushToken", ["pushToken"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    entitlement,
    status: subscriptionStatus,
    provider: v.optional(v.string()),
    productId: v.optional(v.string()),
    providerCustomerId: v.optional(v.string()),
    originalTransactionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  labSubjects: defineTable({
    createdByUserId: v.id("users"),
    displayName: v.string(),
    birthDate: v.string(),
    birthTime: v.optional(v.string()),
    birthTimePrecision,
    birthPlaceLabel: v.string(),
    placeId: v.optional(v.string()),
    placeProvider: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    timezone: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_createdBy", ["createdByUserId"])
    .index("by_createdBy_updatedAt", ["createdByUserId", "updatedAt"]),

  labRuns: defineTable({
    createdByUserId: v.id("users"),
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
    modelGaps: v.array(v.string()),
    editorialPayload: v.optional(v.any()),
    futureSelfNote: v.optional(v.string()),
    editorialUpdatedAt: v.optional(v.number()),
    reviewStatus: v.optional(labReviewStatus),
    reviewNote: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index("by_createdBy", ["createdByUserId"])
    .index("by_createdBy_createdAt", ["createdByUserId", "createdAt"])
    .index("by_subject_createdAt", ["subjectId", "createdAt"]),

  contentModules: defineTable({
    kind: v.union(
      v.literal("headline"),
      v.literal("do"),
      v.literal("avoid"),
      v.literal("energy"),
      v.literal("action"),
      v.literal("topic"),
      v.literal("long_read"),
      v.literal("education")
    ),
    locale: v.string(),
    topic: v.optional(v.string()),
    zodiacSign: v.optional(v.string()),
    transitType: v.optional(v.string()),
    entitlement,
    title: v.string(),
    body: v.string(),
    action: v.optional(v.string()),
    status: contentStatus,
    version: v.string(),
    publishedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index("by_kind_status", ["kind", "status"])
    .index("by_locale_status", ["locale", "status"])
});
