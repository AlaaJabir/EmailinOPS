import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("technical_logs")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    service: v.string(),
    event: v.string(),
    severity: v.string(),
    response: v.string(),
    details: v.optional(v.any()),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("technical_logs", args);
  },
});
