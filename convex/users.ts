import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
  },
});

export const create = mutation({
  args: {
    email: v.string(),
    fullName: v.optional(v.string()),
    role: v.string(),
    plan: v.string(),
    passwordHash: v.optional(v.string()),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        fullName: args.fullName || existing.fullName,
        role: args.role,
        plan: args.plan,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      ...args,
      email: args.email.toLowerCase(),
    });
  },
});
