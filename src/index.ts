// language: TypeScript, file: src/index.ts, runtime: node 22, opencode plugin entry
// OpenCode plugin: discord-use — user-account research + Jev triage.
// Tools: list guilds/channels, read history, search, Jev-ranked research loop.
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { listGuilds, listChannels, readHistory, searchInGuild } from "./discord.js";
import { jevRank, jevRoute, jevDone } from "./jev.js";

export const DiscordUsePlugin: Plugin = async () => {
  return {
    tool: {
      discord_list_guilds: tool({
        description: "List discord servers (guilds) visible to the user account.",
        args: {},
        async execute() {
          return JSON.stringify(await listGuilds(), null, 2);
        },
      }),

      discord_list_channels: tool({
        description: "List text channels in a guild.",
        args: { guildId: tool.schema.string() },
        async execute(args: any) {
          return JSON.stringify(await listChannels(args.guildId), null, 2);
        },
      }),

      discord_read_history: tool({
        description: "Read recent message history from a channel. Paginate with before (message id).",
        args: {
          channelId: tool.schema.string(),
          limit: tool.schema.number().optional(),
          before: tool.schema.string().optional(),
        },
        async execute(args: any) {
          const rows = await readHistory(args.channelId, args.limit ?? 50, args.before);
          return JSON.stringify(rows, null, 2);
        },
      }),

      discord_search: tool({
        description: "Full-text search messages within a guild.",
        args: {
          guildId: tool.schema.string(),
          query: tool.schema.string(),
          limit: tool.schema.number().optional(),
        },
        async execute(args: any) {
          const rows = await searchInGuild(args.guildId, args.query, args.limit ?? 25);
          return JSON.stringify(rows, null, 2);
        },
      }),

      discord_research: tool({
        description:
          "Jev-triaged research: pull channel history, rank by relevance with Jev, return top hits + done-check.",
        args: {
          channelId: tool.schema.string(),
          query: tool.schema.string(),
          limit: tool.schema.number().optional(),
          topK: tool.schema.number().optional(),
        },
        async execute(args: any) {
          const rows = await readHistory(args.channelId, args.limit ?? 100);
          const texts = rows.map((r) => `${r.author}: ${r.content}`);
          const ranked = await jevRank(args.query, texts);
          const topK = args.topK ?? 15;
          const top = ranked.slice(0, topK).map((r) => ({ ...rows[r.index], jevScore: r.score }));
          const done = await jevDone(
            args.query,
            top.map((t: any) => `${t.author}: ${t.content}`).join("\n")
          );
          return JSON.stringify({ top, done, scanned: rows.length }, null, 2);
        },
      }),

      discord_route: tool({
        description: "Jev picks which channel id to dig next given a goal + candidate list.",
        args: {
          goal: tool.schema.string(),
          candidates: tool.schema.string(), // JSON: [{id,label}]
        },
        async execute(args: any) {
          const cands = JSON.parse(args.candidates);
          return JSON.stringify(await jevRoute(args.goal, cands), null, 2);
        },
      }),
    },
  };
};

export default DiscordUsePlugin;
