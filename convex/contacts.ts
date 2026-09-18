import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => ctx.db.query("contacts").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").take(Math.min(Math.max(args.limit ?? 100, 1), 500)),
});

export const listPage = query({
  args: { userId: v.string(), listId: v.optional(v.string()), cursor: v.optional(v.string()), numItems: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(args.numItems ?? 250, 1), 500);
    if (!args.listId) {
      return await ctx.db.query("contacts").withIndex("by_userId", (q) => q.eq("userId", args.userId)).order("desc").paginate({ numItems, cursor: args.cursor ?? null });
    }
    const memberships = await ctx.db.query("contact_list_memberships").withIndex("by_userId_listId", (q) => q.eq("userId", args.userId).eq("listId", args.listId!)).order("desc").paginate({ numItems, cursor: args.cursor ?? null });
    const contacts = [];
    for (const membership of memberships.page) {
      const normalizedContactId = ctx.db.normalizeId("contacts", membership.contactId);
      if (!normalizedContactId) continue;
      try {
        const contact = await ctx.db.get(normalizedContactId);
        if (contact) contacts.push(contact);
      } catch (e) {
        console.warn("[contacts.listPage] Failed to get contact:", e);
      }
    }
    return { ...memberships, page: contacts };
  },
});

export const create = mutation({
  args: { userId: v.string(), email: v.string(), firstName: v.optional(v.string()), lastName: v.optional(v.string()), company: v.optional(v.string()), status: v.string(), tags: v.array(v.string()), customFields: v.optional(v.any()), createdAt: v.string(), updatedAt: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("contacts").withIndex("by_userId_email", (q) => q.eq("userId", args.userId).eq("email", args.email)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { firstName: args.firstName || existing.firstName, lastName: args.lastName || existing.lastName, company: args.company || existing.company, tags: Array.from(new Set([...existing.tags, ...args.tags])), updatedAt: args.updatedAt });
      return existing._id;
    }
    return await ctx.db.insert("contacts", args);
  },
});

export const remove = mutation({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const contactId = ctx.db.normalizeId("contacts", args.id);
    if (!contactId) return false;
    let contact: any = null;
    try {
      contact = await ctx.db.get(contactId);
    } catch (e) {
      console.warn("[contacts.remove] Failed to get contact:", e);
      return false;
    }
    if (!contact || contact.userId !== args.userId) return false;
    await ctx.db.delete(contact._id);
    return true;
  },
});

export const addToList = mutation({
  args: { userId: v.string(), listId: v.string(), contactId: v.string(), joinedAt: v.string() },
  handler: async (ctx, args) => {
    const contactId = ctx.db.normalizeId("contacts", args.contactId);
    const listId = ctx.db.normalizeId("contact_lists", args.listId);
    if (!contactId || !listId) throw new Error("Invalid contact or list ID");
    let contact: any = null;
    let list: any = null;
    try {
      contact = await ctx.db.get(contactId);
      list = await ctx.db.get(listId);
    } catch (e) {
      console.warn("[contacts.addToList] Failed to get contact or list:", e);
      throw new Error("Invalid contact or list");
    }
    if (!contact || contact.userId !== args.userId || !list || list.userId !== args.userId) throw new Error("Invalid contact or list");
  const existing = await ctx.db.query("contact_list_memberships").withIndex("by_userId_listId_contactId", (q) => q.eq("userId", args.userId).eq("listId", args.listId).eq("contactId", args.contactId)).first();
  if (existing) return existing._id;
  const id = await ctx.db.insert("contact_list_memberships", args);
  await ctx.db.patch(list._id, { contactCount: (list.contactCount || 0) + 1 });
  return id;
},
});

export const listLists = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => ctx.db.query("contact_lists").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
});

export const createList = mutation({
  args: { userId: v.string(), name: v.string(), description: v.optional(v.string()), contactCount: v.number(), createdAt: v.string() },
  handler: async (ctx, args) => ctx.db.insert("contact_lists", args),
});
