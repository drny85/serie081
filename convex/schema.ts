import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const playerSchema = v.object({
  name: v.string(),
  jerseyName: v.string(),
  number: v.string(),
  position: v.string(),
  size: v.union(
    v.literal("XS"),
    v.literal("S"),
    v.literal("M"),
    v.literal("L"),
    v.literal("XL"),
    v.literal("XXL")
  ),
  notes: v.optional(v.string()),
});
export default defineSchema({
  players: defineTable(playerSchema),
});
