import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("campaigns")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const normId = ctx.db.normalizeId("campaigns", args.id);
    if (!normId) return null;
    try {
      const c = await ctx.db.get(normId);
      if (c && c.userId === args.userId) return c;
      return null;
    } catch (e) {
      console.error("[campaigns.get] Failed to fetch campaign:", e);
      return null;
    }
  },
});

export const create = mutation({
  args: {
    userId: v.string(), name: v.string(), subject: v.string(), senderId: v.string(), listId: v.optional(v.string()),
    status: v.string(), htmlBody: v.optional(v.string()), headHtml: v.optional(v.string()), plainText: v.optional(v.string()),
    totalRecipients: v.number(), sentCount: v.number(), deliveredCount: v.number(), bouncedCount: v.number(), openedCount: v.number(),
    clickedCount: v.number(), trackOpens: v.boolean(), trackClicks: v.boolean(), startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()), createdAt: v.string(), updatedAt: v.string(),
  },
  handler: async (ctx, args) => ctx.db.insert("campaigns", args),
});

export const update = mutation({
  args: { id: v.string(), userId: v.string(), updates: v.any() },
  handler: async (ctx, args) => {
    const normId = ctx.db.normalizeId("campaigns", args.id);
    if (!normId) throw new Error("Campaign not found");
    let campaign: any = null;
    try {
      campaign = await ctx.db.get(normId);
    } catch (e) {
      console.error("[campaigns.update] Failed to get campaign:", e);
      throw new Error("Campaign not found");
    }
    if (!campaign || campaign.userId !== args.userId) throw new Error("Campaign not found");
    await ctx.db.patch(campaign._id, { ...args.updates, updatedAt: new Date().toISOString() });
    return args.id;
  },
});

export const acquireSend = mutation({
  args: { id: v.string(), userId: v.string(), leaseId: v.string(), leaseUntil: v.string(), now: v.string() },
  handler: async (ctx, args) => {
    const normId = ctx.db.normalizeId("campaigns", args.id);
    if (!normId) return { acquired: false, reason: "NOT_FOUND" };
    let campaign: any = null;
    try {
      campaign = await ctx.db.get(normId);
    } catch (e) {
      console.error("[campaigns.acquireSend] Failed to get campaign:", e);
      return { acquired: false, reason: "NOT_FOUND" };
    }
    if (!campaign || campaign.userId !== args.userId) return { acquired: false, reason: "NOT_FOUND" };
    const leaseActive = Boolean(campaign.sendLeaseUntil && campaign.sendLeaseUntil > args.now);
    if (campaign.sendLeaseId && campaign.sendLeaseId !== args.leaseId && leaseActive) {
      return { acquired: false, reason: "LEASE_ACTIVE" };
    }

    const freshStart = campaign.status !== "SENDING";
    const patch: any = {
      status: "SENDING",
      sendLeaseId: args.leaseId,
      sendLeaseUntil: args.leaseUntil,
      updatedAt: args.now,
    };
    if (freshStart) {
      patch.startedAt = campaign.startedAt || args.now;
      patch.sendCursor = undefined;
      patch.sendProcessed = 0;
      patch.sendFailed = 0;
      patch.sendSuppressed = 0;
      patch.sentCount = 0;
      patch.totalRecipients = 0;
      patch.completedAt = undefined;
    }
    await ctx.db.patch(campaign._id, patch);
    return {
      acquired: true,
      campaign: { ...campaign, ...patch },
    };
  },
});

export const renewSend = mutation({
  args: { id: v.string(), userId: v.string(), leaseId: v.string(), leaseUntil: v.string(), now: v.string() },
  handler: async (ctx, args) => {
    const normId = ctx.db.normalizeId("campaigns", args.id);
    if (!normId) return false;
    let campaign: any = null;
    try {
      campaign = await ctx.db.get(normId);
    } catch (e) {
      console.error("[campaigns.renewSend] Failed to get campaign:", e);
      return false;
    }
    if (!campaign || campaign.userId !== args.userId) return false;
    if (campaign.sendLeaseId !== args.leaseId) return false;
    await ctx.db.patch(campaign._id, { sendLeaseUntil: args.leaseUntil, updatedAt: args.now });
    return true;
  },
});

export const releaseSend = mutation({
  args: { id: v.string(), userId: v.string(), leaseId: v.string(), now: v.string() },
  handler: async (ctx, args) => {
    const normId = ctx.db.normalizeId("campaigns", args.id);
    if (!normId) return false;
    let campaign: any = null;
    try {
      campaign = await ctx.db.get(normId);
    } catch (e) {
      console.error("[campaigns.releaseSend] Failed to get campaign:", e);
      return false;
    }
    if (!campaign || campaign.userId !== args.userId) return false;
    if (campaign.sendLeaseId !== args.leaseId) return false;
    await ctx.db.patch(campaign._id, { sendLeaseId: undefined, sendLeaseUntil: undefined, updatedAt: args.now });
    return true;
  },
});

export const remove = mutation({
  args: { id: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const normId = ctx.db.normalizeId("campaigns", args.id);
    if (!normId) throw new Error("Campaign not found");
    let campaign: any = null;
    try {
      campaign = await ctx.db.get(normId);
    } catch (e) {
      console.error("[campaigns.remove] Failed to get campaign:", e);
      throw new Error("Campaign not found");
    }
    if (!campaign || campaign.userId !== args.userId) throw new Error("Campaign not found");
    await ctx.db.delete(campaign._id);
    return true;
  },
});
