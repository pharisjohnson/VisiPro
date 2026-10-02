import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("admin"),
  v.literal("guard"),
  v.literal("host"),
);

// Custom-field answers, keyed by CustomField.key. Only keys that exist as
// custom fields for the org are ever stored (see lib/validation.ts).
const extraData = v.record(v.string(), v.string());

// Every table carries `orgId` (the Clerk organization id taken from the signed
// JWT, never from client arguments) and every index starts with it. All reads
// and writes go through lib/tenancy.ts, which pins functions to the caller's
// organization.
export default defineSchema({
  members: defineTable({
    orgId: v.string(),
    userId: v.string(), // Clerk user id (JWT `sub`)
    name: v.string(),
    email: v.string(),
    photoUrl: v.optional(v.string()),
    role: roleValidator,
  })
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"]),

  visitors: defineTable({
    orgId: v.string(),
    name: v.string(),
    company: v.string(),
    hostName: v.string(),
    hostUserId: v.optional(v.string()),
    purpose: v.string(),
    checkInTime: v.number(), // epoch ms
    checkOutTime: v.optional(v.number()),
    status: v.union(v.literal("in"), v.literal("out")),
    appointmentId: v.optional(v.id("appointments")),
    checkedInBy: v.string(), // member userId
    extraData,
  })
    .index("by_org_time", ["orgId", "checkInTime"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_host_status", ["orgId", "hostUserId", "status"]),

  appointments: defineTable({
    orgId: v.string(),
    visitorName: v.string(),
    visitorCompany: v.string(),
    hostName: v.string(),
    hostUserId: v.optional(v.string()),
    scheduledTime: v.number(), // epoch ms
    checkInCode: v.string(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("arrived"),
      v.literal("cancelled"),
    ),
    createdBy: v.string(), // member userId
  })
    .index("by_org_time", ["orgId", "scheduledTime"])
    .index("by_org_host_time", ["orgId", "hostUserId", "scheduledTime"])
    .index("by_org_code", ["orgId", "checkInCode"]),

  employees: defineTable({
    orgId: v.string(),
    name: v.string(),
    checkInTime: v.number(),
    checkOutTime: v.optional(v.number()),
    status: v.union(v.literal("in"), v.literal("out")),
    extraData,
  })
    .index("by_org_time", ["orgId", "checkInTime"])
    .index("by_org_status", ["orgId", "status"]),

  customFields: defineTable({
    orgId: v.string(),
    label: v.string(),
    key: v.string(),
    target: v.union(v.literal("visitor"), v.literal("employee")),
    required: v.boolean(),
  }).index("by_org", ["orgId"]),

  announcements: defineTable({
    orgId: v.string(),
    title: v.string(),
    content: v.string(),
    authorName: v.string(),
    authorRole: roleValidator,
  }).index("by_org", ["orgId"]),

  notifications: defineTable({
    orgId: v.string(),
    userId: v.string(), // recipient
    message: v.string(),
    read: v.boolean(),
  }).index("by_org_user", ["orgId", "userId"]),
});
