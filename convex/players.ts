import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { playerSchema } from "./schema";

export const addPlayer = mutation({
  args: playerSchema,
  handler: async (ctx, args) => {
    const player = await ctx.db.insert("players", args);
    return player;
  },
});
export const getPlayers = query({
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    return players;
  },
});

export const updatePlayer = mutation({
  args: { id: v.id("players"), playerSchema },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.playerSchema);
  },
});

export const deletePlayer = mutation({
  args: { id: v.id("players") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
