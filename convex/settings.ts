import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { userId: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_userId_category", (q) =>
        q.eq("userId", args.userId).eq("category", args.category)
      )
      .first();
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    category: v.string(),
    values: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_userId_category", (q) =>
        q.eq("userId", args.userId).eq("category", args.category)
      )
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        values: args.values,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("settings", {
      userId: args.userId,
      category: args.category,
      values: args.values,
      updatedAt: now,
    });
  },
});
