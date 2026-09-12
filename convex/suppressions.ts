import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suppressions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const isSuppressed = query({
  args: { userId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suppressions")
      .withIndex("by_userId_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email.toLowerCase())
      )
      .first();
  },
});

export const add = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    reason: v.string(),
    suppressionType: v.string(),
    source: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("suppressions")
      .withIndex("by_userId_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email.toLowerCase())
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("suppressions", {
      ...args,
      email: args.email.toLowerCase(),
    });
  },
});

export const remove = mutation({
  args: { userId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("suppressions")
      .withIndex("by_userId_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email.toLowerCase())
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
