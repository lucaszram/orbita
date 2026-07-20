type DeletionCtx = {
  db: any;
};

type IndexedDeletionStep = {
  table: string;
  index: string;
  field: "userId" | "createdByUserId";
};

/**
 * Every table whose rows belong to one Órbita user.
 *
 * Children are intentionally listed before the documents they reference. Convex
 * does not enforce foreign keys, but this order prevents dangling references and
 * keeps the operation safe if those references become stricter later.
 *
 * When a new user-owned table is added to schema.ts, the structural regression
 * in test/accountDeletion.test.ts forces this plan to be updated too.
 */
export const USER_SCOPED_DELETION_STEPS: readonly IndexedDeletionStep[] = [
  { table: "productEvents", index: "by_user_date", field: "userId" },
  { table: "productActors", index: "by_user", field: "userId" },
  { table: "labRuns", index: "by_createdBy", field: "createdByUserId" },
  { table: "labSubjects", index: "by_createdBy", field: "createdByUserId" },
  { table: "savedReadings", index: "by_user", field: "userId" },
  { table: "journalEntries", index: "by_user", field: "userId" },
  { table: "natalInterpretations", index: "by_user", field: "userId" },
  { table: "profileAstrologyCaches", index: "by_user", field: "userId" },
  { table: "dailyLlmReadings", index: "by_user", field: "userId" },
  { table: "dailyReadings", index: "by_user", field: "userId" },
  { table: "transitReadings", index: "by_user_date", field: "userId" },
  { table: "transitTimelineCaches", index: "by_user_period", field: "userId" },
  { table: "dailyGuides", index: "by_user_date", field: "userId" },
  { table: "voidAnswers", index: "by_user_date", field: "userId" },
  { table: "voidPromptSets", index: "by_user_date", field: "userId" },
  { table: "relationshipProfiles", index: "by_user", field: "userId" },
  { table: "notificationPreferences", index: "by_user", field: "userId" },
  { table: "devices", index: "by_user", field: "userId" },
  { table: "subscriptions", index: "by_user", field: "userId" },
  { table: "natalCharts", index: "by_user", field: "userId" },
  { table: "birthData", index: "by_user", field: "userId" },
  { table: "onboardingDrafts", index: "by_user", field: "userId" }
] as const;

async function deleteRowsByIndex(
  ctx: DeletionCtx,
  step: { table: string; index: string; field: string },
  value: unknown
): Promise<number> {
  const rows = await ctx.db
    .query(step.table)
    .withIndex(step.index, (q: any) => q.eq(step.field, value))
    .collect();

  for (const row of rows) {
    await ctx.db.delete(row._id);
  }

  return rows.length;
}

export async function deleteAccountData(
  ctx: DeletionCtx,
  args: {
    userId?: unknown;
    clerkUserIds: readonly string[];
  }
): Promise<number> {
  let deletedRecords = 0;

  if (args.userId !== undefined) {
    // Los eventos previos al login no tienen userId, pero quedan vinculados al
    // productActor cuando esa instalación se identifica. También deben salir.
    const actors = await ctx.db
      .query("productActors")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .collect();
    for (const actor of actors) {
      deletedRecords += await deleteRowsByIndex(
        ctx,
        { table: "productEvents", index: "by_actor_date", field: "actorId" },
        actor._id
      );
    }

    for (const step of USER_SCOPED_DELETION_STEPS) {
      deletedRecords += await deleteRowsByIndex(ctx, step, args.userId);
    }
  }

  for (const clerkUserId of new Set(args.clerkUserIds.filter(Boolean))) {
    deletedRecords += await deleteRowsByIndex(
      ctx,
      { table: "paymentEvents", index: "by_clerkUserId", field: "clerkUserId" },
      clerkUserId
    );
  }

  if (args.userId !== undefined) {
    await ctx.db.delete(args.userId);
    deletedRecords += 1;
  }

  return deletedRecords;
}
