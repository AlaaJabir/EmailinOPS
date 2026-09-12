import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("domains")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    domain: v.string(),
    status: v.string(),
    verified: v.boolean(),
    dkimStatus: v.string(),
    spfStatus: v.string(),
    dmarcStatus: v.string(),
    mxStatus: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("domains", args);
  },
});
