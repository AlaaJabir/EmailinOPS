import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const rowValidator = v.object({
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  company: v.optional(v.string()),
});

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("import_jobs")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(100),
});

export const get = query({
  args: { userId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    const normId = ctx.db.normalizeId("import_jobs", args.id);
    if (!normId) return null;
    try {
      const job = await ctx.db.get(normId);
      if (!job || job.userId !== args.userId) return null;
      return job;
    } catch (e) {
      console.error("[imports.get] Failed to fetch import job:", e);
      return null;
    }
  },
});

export const start = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    originalFilename: v.string(),
    listName: v.string(),
    listId: v.optional(v.string()),
    listDescription: v.optional(v.string()),
    sourceSizeBytes: v.number(),
    now: v.string(),
  },
  handler: async (ctx, args) => {
    let targetListId = args.listId;
    let existingList: any = null;

    if (targetListId) {
      const normId = ctx.db.normalizeId("contact_lists", targetListId);
      if (normId) {
        try {
          existingList = await ctx.db.get(normId);
        } catch (e) {
          console.warn("[imports.start] Failed to fetch list:", e);
          existingList = null;
        }
      }
      if (!existingList) {
        // Check if there is an existing list with this name for this user
        existingList = await ctx.db
          .query("contact_lists")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("name"), args.listName))
          .first();
      }
    } else if (args.listName) {
      existingList = await ctx.db
        .query("contact_lists")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("name"), args.listName))
        .first();
    }

    if (existingList) {
      targetListId = existingList._id;
    } else {
      targetListId = (await ctx.db.insert("contact_lists", {
        userId: args.userId,
        name: args.listName || "Imported Audience",
        description: args.listDescription || `Audience for ${args.originalFilename}`,
        contactCount: 0,
        createdAt: args.now,
      })) as string;
    }

    const importId = await ctx.db.insert("import_jobs", {
      userId: args.userId,
      name: args.name,
      originalFilename: args.originalFilename,
      status: "PROCESSING",
      listId: targetListId,
      sourceSizeBytes: args.sourceSizeBytes,
      uploadOffsetBytes: 0,
      processedRows: 0,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      suppressedRows: 0,
      importedRows: 0,
      parserTail: "",
      startedAt: args.now,
      updatedAt: args.now,
    });

    return { importId, listId: targetListId };
  },
});

export const processChunk = mutation({
  args: {
    userId: v.string(),
    importId: v.string(),
    chunkId: v.string(),
    offset: v.number(),
    nextOffset: v.number(),
    parserTail: v.string(),
    rows: v.array(rowValidator),
    invalidRows: v.number(),
    suppressedEmails: v.array(v.string()),
    now: v.string(),
  },
  handler: async (ctx, args) => {
    const normJobId = ctx.db.normalizeId("import_jobs", args.importId);
    if (!normJobId) throw new Error("Import job not found");
    let job: any = null;
    try {
      job = await ctx.db.get(normJobId);
    } catch (e) {
      console.error("[imports.processChunk] Failed to get job:", e);
      throw new Error("Import job not found");
    }
    if (!job || job.userId !== args.userId) throw new Error("Import job not found");
    if (job.status === "COMPLETED" || job.status === "CANCELLED") {
      throw new Error(`Import is ${job.status.toLowerCase()}`);
    }
    if (job.lastChunkId === args.chunkId) return job;
    if (args.offset !== job.uploadOffsetBytes) {
      throw new Error(`OFFSET_MISMATCH:${job.uploadOffsetBytes}`);
    }

    const suppressed = new Set(args.suppressedEmails.map((email) => email.toLowerCase()));

    // De-duplicate rows within this chunk (case-insensitive), keeping the first
    // occurrence. This is required because rows are now looked up/written
    // concurrently below — two rows sharing the same email in one chunk would
    // otherwise race each other and create two separate contacts.
    const seen = new Map<string, (typeof args.rows)[number]>();
    let intraChunkDuplicates = 0;
    for (const row of args.rows) {
      const email = row.email.trim().toLowerCase();
      if (!email) continue;
      if (seen.has(email)) {
        intraChunkDuplicates += 1;
      } else {
        seen.set(email, row);
      }
    }

    let importedRows = 0;
    let duplicateRows = intraChunkDuplicates;
    let suppressedRows = 0;
    let newMembersAdded = 0;

    const normListId = job.listId ? ctx.db.normalizeId("contact_lists", job.listId) : null;

    const workingRows: Array<[string, (typeof args.rows)[number]]> = [];
    for (const [email, row] of seen) {
      if (suppressed.has(email)) {
        suppressedRows += 1;
        continue;
      }
      workingRows.push([email, row]);
    }

    // Phase 1: look up existing contacts concurrently instead of one row at a
    // time — this is what previously made large chunks (tens of thousands of
    // rows for plain email lists) exceed a single mutation's execution budget.
    const existingLookups = await Promise.all(
      workingRows.map(([email]) =>
        ctx.db
          .query("contacts")
          .withIndex("by_userId_email", (q) => q.eq("userId", args.userId).eq("email", email))
          .first()
      )
    );

    // Phase 2: insert/patch contacts concurrently and collect their ids.
    const contactIds = await Promise.all(
      workingRows.map(async ([email, row], idx) => {
        const existing = existingLookups[idx];
        if (existing) {
          duplicateRows += 1;
          await ctx.db.patch(existing._id, {
            firstName: row.firstName || existing.firstName,
            lastName: row.lastName || existing.lastName,
            company: row.company || existing.company,
            updatedAt: args.now,
            tags: Array.from(new Set([...(existing.tags || []), "import"])),
          });
          return existing._id as any;
        }
        const id = await ctx.db.insert("contacts", {
          userId: args.userId,
          email,
          firstName: row.firstName,
          lastName: row.lastName,
          company: row.company,
          status: "ACTIVE",
          tags: ["import"],
          createdAt: args.now,
          updatedAt: args.now,
        });
        importedRows += 1;
        return id;
      })
    );

    // Phase 3: audience-list memberships, also concurrently.
    if (normListId) {
      const membershipChecks = await Promise.all(
        contactIds.map((contactId) =>
          ctx.db
            .query("contact_list_memberships")
            .withIndex("by_userId_listId_contactId", (q) =>
              q.eq("userId", args.userId).eq("listId", normListId).eq("contactId", contactId)
            )
            .first()
        )
      );

      await Promise.all(
        contactIds.map(async (contactId, idx) => {
          if (!membershipChecks[idx]) {
            await ctx.db.insert("contact_list_memberships", {
              userId: args.userId,
              listId: normListId,
              contactId: contactId as string,
              joinedAt: args.now,
            });
            newMembersAdded += 1;
          }
        })
      );

      if (newMembersAdded > 0) {
        try {
          const list = await ctx.db.get(normListId);
          if (list) {
            await ctx.db.patch(list._id, {
              contactCount: (list.contactCount || 0) + newMembersAdded,
            });
          }
        } catch (e) {
          console.warn("[imports.processChunk] Failed to update list count:", e);
        }
      }
    }

    const updated = {
      uploadOffsetBytes: args.nextOffset,
      processedRows: job.processedRows + args.rows.length,
      totalRows: job.totalRows + args.rows.length,
      validRows: job.validRows + args.rows.length,
      invalidRows: job.invalidRows + args.invalidRows,
      duplicateRows: job.duplicateRows + duplicateRows,
      suppressedRows: job.suppressedRows + suppressedRows,
      importedRows: job.importedRows + importedRows,
      lastChunkId: args.chunkId,
      parserTail: args.parserTail,
      updatedAt: args.now,
    };
    await ctx.db.patch(job._id, updated);
    return { ...job, ...updated };
  },
});

export const complete = mutation({
  args: {
    userId: v.string(),
    importId: v.string(),
    now: v.string(),
    finalOffset: v.number(),
    parserTail: v.string(),
  },
  handler: async (ctx, args) => {
    const normJobId = ctx.db.normalizeId("import_jobs", args.importId);
    if (!normJobId) throw new Error("Import job not found");
    let job: any = null;
    try {
      job = await ctx.db.get(normJobId);
    } catch (e) {
      console.error("[imports.complete] Failed to get job:", e);
      throw new Error("Import job not found");
    }
    if (!job || job.userId !== args.userId) throw new Error("Import job not found");
    if (args.parserTail && args.parserTail.trim()) {
      // If there's an email in the parser tail, we can also insert it or ignore
    }
    await ctx.db.patch(job._id, {
      status: "COMPLETED",
      uploadOffsetBytes: Math.max(job.uploadOffsetBytes, args.finalOffset),
      parserTail: "",
      completedAt: args.now,
      updatedAt: args.now,
    });
    return { ...job, status: "COMPLETED", completedAt: args.now };
  },
});

export const cancel = mutation({
  args: { userId: v.string(), importId: v.string(), now: v.string() },
  handler: async (ctx, args) => {
    const normJobId = ctx.db.normalizeId("import_jobs", args.importId);
    if (!normJobId) throw new Error("Import job not found");
    let job: any = null;
    try {
      job = await ctx.db.get(normJobId);
    } catch (e) {
      console.error("[imports.cancel] Failed to get job:", e);
      throw new Error("Import job not found");
    }
    if (!job || job.userId !== args.userId) throw new Error("Import job not found");
    await ctx.db.patch(job._id, {
      status: "CANCELLED",
      completedAt: args.now,
      updatedAt: args.now,
    });
    return { ...job, status: "CANCELLED", completedAt: args.now };
  },
});

export const fail = mutation({
  args: { userId: v.string(), importId: v.string(), now: v.string() },
  handler: async (ctx, args) => {
    const normJobId = ctx.db.normalizeId("import_jobs", args.importId);
    if (!normJobId) throw new Error("Import job not found");
    let job: any = null;
    try {
      job = await ctx.db.get(normJobId);
    } catch (e) {
      console.error("[imports.fail] Failed to get job:", e);
      throw new Error("Import job not found");
    }
    if (!job || job.userId !== args.userId) throw new Error("Import job not found");
    if (job.status === "COMPLETED" || job.status === "CANCELLED") {
      return job;
    }
    await ctx.db.patch(job._id, {
      status: "FAILED",
      completedAt: args.now,
      updatedAt: args.now,
    });
    return { ...job, status: "FAILED", completedAt: args.now };
  },
});
