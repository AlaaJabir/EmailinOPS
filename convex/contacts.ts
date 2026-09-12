import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contacts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    company: v.optional(v.string()),
    status: v.string(),
    tags: v.array(v.string()),
    customFields: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_userId_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        firstName: args.firstName || existing.firstName,
        lastName: args.lastName || existing.lastName,
        company: args.company || existing.company,
        tags: Array.from(new Set([...existing.tags, ...args.tags])),
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("contacts", args);
  },
});

export const remove = mutation({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id as any);
    return true;
  },
});

export const listLists = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contact_lists")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const createList = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    contactCount: v.number(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("contact_lists", args);
  },
});
