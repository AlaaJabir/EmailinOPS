import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const tokenArgs = {
  token: v.string(),
  email: v.string(),
  contactId: v.optional(v.string()),
  messageId: v.optional(v.string()),
  campaignId: v.optional(v.string()),
  userId: v.optional(v.string()),
  createdAt: v.string(),
};

export const create = mutation({
  args: tokenArgs,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("unsubscribe_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("unsubscribe_tokens", args);
  },
});

export const get = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("unsubscribe_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
  },
});

export const markUnsubscribed = mutation({
  args: { token: v.string(), unsubscribedAt: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("unsubscribe_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!existing) return null;

    await ctx.db.patch(existing._id, { unsubscribedAt: args.unsubscribedAt });
    return existing._id;
  },
});
