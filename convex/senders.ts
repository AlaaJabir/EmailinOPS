import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("senders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    fromEmail: v.string(),
    replyTo: v.optional(v.string()),
    status: v.string(),
    verification: v.string(),
    sentCount: v.number(),
    dailyQuota: v.number(),
    dailySent: v.number(),
    dkimStatus: v.string(),
    spfStatus: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("senders")
      .withIndex("by_fromEmail", (q) => q.eq("fromEmail", args.fromEmail))
      .first();
    if (existing && existing.userId === args.userId) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("senders", args);
  },
});

export const remove = mutation({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id as any);
    return true;
  },
});
