import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("templates")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.id as any);
    if (t && (t as any).userId === args.userId) return t;
    return null;
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    subject: v.string(),
    preheader: v.optional(v.string()),
    htmlBody: v.string(),
    headHtml: v.optional(v.string()),
    plainText: v.optional(v.string()),
    variables: v.optional(v.array(v.string())),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    customHeaders: v.optional(v.any()),
    trackOpens: v.optional(v.boolean()),
    trackClicks: v.optional(v.boolean()),
    isMarketing: v.optional(v.boolean()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("templates", args);
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
