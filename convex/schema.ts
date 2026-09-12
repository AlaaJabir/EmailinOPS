import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    fullName: v.optional(v.string()),
    role: v.string(), // "ADMIN" | "OPERATOR" | "VIEWER"
    plan: v.string(), // "PRO" | "ENTERPRISE"
    passwordHash: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_email", ["email"]),

  senders: defineTable({
    userId: v.string(),
    name: v.string(),
    fromEmail: v.string(),
    replyTo: v.optional(v.string()),
    status: v.string(), // "active" | "inactive"
    verification: v.string(), // "VERIFIED" | "PENDING"
    sentCount: v.number(),
    dailyQuota: v.number(),
    dailySent: v.number(),
    dkimStatus: v.string(),
    spfStatus: v.string(),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_fromEmail", ["fromEmail"]),

  domains: defineTable({
    userId: v.string(),
    domain: v.string(),
    status: v.string(),
    verified: v.boolean(),
    dkimStatus: v.string(),
    spfStatus: v.string(),
    dmarcStatus: v.string(),
    mxStatus: v.string(),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_domain", ["domain"]),

  contacts: defineTable({
    userId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    company: v.optional(v.string()),
    status: v.string(), // "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED"
    tags: v.array(v.string()),
    customFields: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_userId_email", ["userId", "email"]),

  contact_lists: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    contactCount: v.number(),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]),

  campaigns: defineTable({
    userId: v.string(),
    name: v.string(),
    subject: v.string(),
    senderId: v.string(),
    listId: v.optional(v.string()),
    status: v.string(), // "DRAFT" | "QUEUED" | "SENDING" | "COMPLETED" | "PAUSED" | "CANCELLED"
    htmlBody: v.optional(v.string()),
    headHtml: v.optional(v.string()),
    plainText: v.optional(v.string()),
    totalRecipients: v.number(),
    sentCount: v.number(),
    deliveredCount: v.number(),
    bouncedCount: v.number(),
    openedCount: v.number(),
    clickedCount: v.number(),
    trackOpens: v.boolean(),
    trackClicks: v.boolean(),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),

  messages: defineTable({
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
    status: v.string(), // "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED" | "REJECTED"
    provider: v.string(), // "KumoMTA"
    smtpResponse: v.optional(v.string()),
    bounceReason: v.optional(v.string()),
    queuedAt: v.string(),
    sentAt: v.optional(v.string()),
    deliveredAt: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_internalId", ["internalId"]).index("by_messageId", ["messageId"]),

  message_events: defineTable({
    userId: v.string(),
    messageId: v.string(),
    eventType: v.string(), // "QUEUED" | "SENT" | "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "FAILED"
    eventData: v.optional(v.any()),
    timestamp: v.string(),
  }).index("by_userId", ["userId"]).index("by_messageId", ["messageId"]),

  suppressions: defineTable({
    userId: v.string(),
    email: v.string(),
    reason: v.string(),
    suppressionType: v.string(),
    source: v.string(),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_userId_email", ["userId", "email"]),

  templates: defineTable({
    userId: v.string(),
    name: v.string(),
    subject: v.string(),
    preheader: v.optional(v.string()),
    htmlBody: v.string(),
    headHtml: v.optional(v.string()),
    plainText: v.optional(v.string()),
    variables: v.optional(v.array(v.string())),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    customHeaders: v.optional(v.any()),
    trackOpens: v.optional(v.boolean()),
    trackClicks: v.optional(v.boolean()),
    isMarketing: v.optional(v.boolean()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),

  settings: defineTable({
    userId: v.string(),
    category: v.string(),
    values: v.any(),
    updatedAt: v.string(),
  }).index("by_userId_category", ["userId", "category"]),

  api_keys: defineTable({
    userId: v.string(),
    name: v.string(),
    keyPrefix: v.string(),
    keyHash: v.string(),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]),

  technical_logs: defineTable({
    userId: v.string(),
    service: v.string(),
    event: v.string(),
    severity: v.string(),
    response: v.string(),
    details: v.optional(v.any()),
    timestamp: v.string(),
  }).index("by_userId", ["userId"]),

  files: defineTable({
    userId: v.string(),
    key: v.string(),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    storageId: v.optional(v.string()),
    url: v.string(),
    createdAt: v.string(),
  }).index("by_userId", ["userId"]).index("by_key", ["key"]),
});
