import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const save = mutation({
  args: {
    userId: v.string(),
    key: v.string(),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    storageId: v.optional(v.string()),
    url: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("files")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("files", args);
  },
});

export const remove = mutation({
  args: { key: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("files")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing && existing.userId === args.userId) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
