import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const rowValidator = v.object({ email: v.string(), firstName: v.optional(v.string()), lastName: v.optional(v.string()), company: v.optional(v.string()) });

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => ctx.db.query("import_jobs").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").take(100),
});

export const get = query({
  args: { userId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id as any);
    if (!job || job.userId !== args.userId) return null;
    return job;
  },
});

export const start = mutation({
  args: { userId: v.string(), name: v.string(), originalFilename: v.string(), listName: v.string(), listDescription: v.optional(v.string()), sourceSizeBytes: v.number(), now: v.string() },
  handler: async (ctx, args) => {
    const listId = await ctx.db.insert("contact_lists", { userId: args.userId, name: args.listName, description: args.listDescription, contactCount: 0, createdAt: args.now });
    const importId = await ctx.db.insert("import_jobs", {
      userId: args.userId, name: args.name, originalFilename: args.originalFilename, status: "PROCESSING", listId: listId as string,
      sourceSizeBytes: args.sourceSizeBytes, uploadOffsetBytes: 0, processedRows: 0, totalRows: 0, validRows: 0, invalidRows: 0,
      duplicateRows: 0, suppressedRows: 0, importedRows: 0, parserTail: "", startedAt: args.now, updatedAt: args.now,
    });
    return { importId, listId };
  },
});

export const processChunk = mutation({
  args: {
    userId: v.string(), importId: v.string(), chunkId: v.string(), offset: v.number(), nextOffset: v.number(), parserTail: v.string(),
    rows: v.array(rowValidator), invalidRows: v.number(), suppressedEmails: v.array(v.string()), now: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.importId as any);
    if (!job || job.userId !== args.userId) throw new Error("Import job not found");
    if (job.status === "COMPLETED" || job.status === "CANCELLED") throw new Error(`Import is ${job.status.toLowerCase()}`);
    if (job.lastChunkId === args.chunkId) return job;
    if (args.offset !== job.uploadOffsetBytes) throw new Error(`OFFSET_MISMATCH:${job.uploadOffsetBytes}`);

    const suppressed = new Set(args.suppressedEmails.map((email) => email.toLowerCase()));
    let importedRows = 0;
    let duplicateRows = 0;
    let suppressedRows = 0;

    for (const row of args.rows) {
      const email = row.email.trim().toLowerCase();
      if (suppressed.has(email)) { suppressedRows += 1; continue; }

      const existing = await ctx.db.query("contacts").withIndex("by_userId_email", (q) => q.eq("userId", args.userId).eq("email", email)).first();
      let contactId: any;
      if (existing) {
        duplicateRows += 1;
        contactId = existing._id;
        await ctx.db.patch(existing._id, { firstName: row.firstName || existing.firstName, lastName: row.lastName || existing.lastName, company: row.company || existing.company, updatedAt: args.now, tags: Array.from(new Set([...existing.tags, "import"])) });
      } else {
        contactId = await ctx.db.insert("contacts", { userId: args.userId, email, firstName: row.firstName, lastName: row.lastName, company: row.company, status: "ACTIVE", tags: ["import"], createdAt: args.now, updatedAt: args.now });
        importedRows += 1;
      }

      const membership = await ctx.db.query("contact_list_memberships").withIndex("by_userId_listId_contactId", (q) => q.eq("userId", args.userId).eq("listId", job.listId).eq("contactId", contactId)).first();
      if (!membership) {
        await ctx.db.insert("contact_list_memberships", { userId: args.userId, listId: job.listId, contactId: contactId as string, joinedAt: args.now });
        const list = await ctx.db.get(job.listId as any);
        if (list) await ctx.db.patch(list._id, { contactCount: list.contactCount + 1 });
      }
    }

    const updated = {
      uploadOffsetBytes: args.nextOffset, processedRows: job.processedRows + args.rows.length, totalRows: job.totalRows + args.rows.length,
      validRows: job.validRows + args.rows.length, invalidRows: job.invalidRows + args.invalidRows, duplicateRows: job.duplicateRows + duplicateRows,
      suppressedRows: job.suppressedRows + suppressedRows, importedRows: job.importedRows + importedRows, lastChunkId: args.chunkId,
      parserTail: args.parserTail, updatedAt: args.now,
    };
    await ctx.db.patch(job._id, updated);
    return { ...job, ...updated };
  },
});

export const complete = mutation({
  args: { userId: v.string(), importId: v.string(), now: v.string(), finalOffset: v.number(), parserTail: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.importId as any);
    if (!job || job.userId !== args.userId) throw new Error("Import job not found");
    if (args.parserTail.trim()) throw new Error("IMPORT_INCOMPLETE_PARSER_TAIL");
    await ctx.db.patch(job._id, { status: "COMPLETED", uploadOffsetBytes: Math.max(job.uploadOffsetBytes, args.finalOffset), parserTail: "", completedAt: args.now, updatedAt: args.now });
    return { ...job, status: "COMPLETED", completedAt: args.now };
  },
});

export const cancel = mutation({
  args: { userId: v.string(), importId: v.string(), now: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.importId as any);
    if (!job || job.userId !== args.userId) throw new Error("Import job not found");
    await ctx.db.patch(job._id, { status: "CANCELLED", completedAt: args.now, updatedAt: args.now });
    return { ...job, status: "CANCELLED", completedAt: args.now };
  },
});
