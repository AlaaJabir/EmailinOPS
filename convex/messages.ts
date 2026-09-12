import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 200;
    return await ctx.db
      .query("messages")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const get = query({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const byInternal = await ctx.db
      .query("messages")
      .withIndex("by_internalId", (q) => q.eq("internalId", args.id))
      .first();
    if (byInternal && byInternal.userId === args.userId) return byInternal;

    const byMsgId = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.id))
      .first();
    if (byMsgId && byMsgId.userId === args.userId) return byMsgId;

    return null;
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    internalId: v.string(),
    messageId: v.string(),
    campaignId: v.optional(v.string()),
    senderId: v.string(),
    fromName: v.optional(v.string()),
    fromEmail: v.string(),
    toEmail: v.string(),
    replyTo: v.optional(v.string()),
    subject: v.string(),
    htmlBody: v.optional(v.string()),
    plainText: v.optional(v.string()),
    status: v.string(),
    provider: v.string(),
    smtpResponse: v.optional(v.string()),
    queuedAt: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_internalId", (q) => q.eq("internalId", args.internalId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("messages", args);
  },
});

export const updateStatus = mutation({
  args: {
    messageId: v.string(),
    status: v.string(),
    smtpResponse: v.optional(v.string()),
    bounceReason: v.optional(v.string()),
    deliveredAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();
    if (msg) {
      await ctx.db.patch(msg._id, {
        status: args.status,
        smtpResponse: args.smtpResponse,
        bounceReason: args.bounceReason,
        deliveredAt: args.deliveredAt,
      });
      return msg._id;
    }
    return null;
  },
});

export const addEvent = mutation({
  args: {
    userId: v.string(),
    messageId: v.string(),
    eventType: v.string(),
    eventData: v.optional(v.any()),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("message_events", args);
  },
});

export const getEvents = query({
  args: { messageId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("message_events")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .collect();
  },
});
