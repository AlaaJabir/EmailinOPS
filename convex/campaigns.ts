import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("campaigns")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.id as any);
    if (c && (c as any).userId === args.userId) return c;
    return null;
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    subject: v.string(),
    senderId: v.string(),
    listId: v.optional(v.string()),
    status: v.string(),
    htmlBody: v.optional(v.string()),
    headHtml: v.optional(v.string()),
    plainText: v.optional(v.string()),
    totalRecipients: v.number(),
    sentCount: v.number(),
    deliveredCount: v.number(),
    bouncedCount: v.number(),
    openedCount: v.number(),
    clickedCount: v.number(),
    trackOpens: v.boolean(),
    trackClicks: v.boolean(),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("campaigns", args);
  },
});

export const update = mutation({
  args: {
    id: v.string(),
    userId: v.string(),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id as any, {
      ...args.updates,
      updatedAt: new Date().toISOString(),
    });
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id as any);
    return true;
  },
});
