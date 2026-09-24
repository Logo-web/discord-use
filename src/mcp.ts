// language: TypeScript, file: src/mcp.ts, runtime: node 22
// MCP server (stdio) — exposes discord-use to Claude Code, Cursor, Windsurf,
// Cline, Kilo, OpenClaw, or any MCP client. Same tools as the opencode plugin.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listGuilds, listChannels, readHistory, searchInGuild } from "./discord.js";
import { jevRank, jevRoute, jevDone } from "./jev.js";

const server = new McpServer({ name: "discord-use", version: "0.2.0" });
const j = (v: unknown) => JSON.stringify(v, null, 2);

server.tool("discord_list_guilds", "List discord servers visible to the user account.", {}, async () => ({
  content: [{ type: "text", text: j(await listGuilds()) }],
}));

server.tool(
  "discord_list_channels",
  "List text channels in a guild.",
  { guildId: z.string() },
  async ({ guildId }) => ({ content: [{ type: "text", text: j(await listChannels(guildId)) }] })
);

server.tool(
  "discord_read_history",
  "Read recent message history from a channel. Paginate with before (message id).",
  { channelId: z.string(), limit: z.number().optional(), before: z.string().optional() },
  async ({ channelId, limit, before }) => ({
    content: [{ type: "text", text: j(await readHistory(channelId, limit ?? 50, before)) }],
  })
);

server.tool(
  "discord_search",
  "Full-text search messages within a guild.",
  { guildId: z.string(), query: z.string(), limit: z.number().optional() },
  async ({ guildId, query, limit }) => ({
    content: [{ type: "text", text: j(await searchInGuild(guildId, query, limit ?? 25)) }],
  })
);

server.tool(
  "discord_research",
  "Jev-triaged research: pull channel history, rank by relevance with Jev, return top hits + done-check.",
  { channelId: z.string(), query: z.string(), limit: z.number().optional(), topK: z.number().optional() },
  async ({ channelId, query, limit, topK }) => {
    const rows = await readHistory(channelId, limit ?? 100);
    const texts = rows.map((r) => `${r.author}: ${r.content}`);
    const ranked = await jevRank(query, texts);
    const top = ranked.slice(0, topK ?? 15).map((r) => ({ ...rows[r.index], jevScore: r.score }));
    const done = await jevDone(query, top.map((t: any) => `${t.author}: ${t.content}`).join("\n"));
    return { content: [{ type: "text", text: j({ top, done, scanned: rows.length }) }] };
  }
);

server.tool(
  "discord_route",
  "Jev picks which channel id to dig next given a goal + candidate list (JSON array).",
  { goal: z.string(), candidates: z.string() },
  async ({ goal, candidates }) => ({
    content: [{ type: "text", text: j(await jevRoute(goal, JSON.parse(candidates))) }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
