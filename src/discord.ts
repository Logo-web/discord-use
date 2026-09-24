// language: TypeScript, file: src/discord.ts, runtime: node 22
// Discord user-account transport (self-client). Read-only research surface.
// *user tokens violate Discord ToS if automated — keep volume low, read-only, private use*
import { Client } from "discord.js-selfbot-v13";

let client: Client | null = null;
let ready: Promise<Client> | null = null;

export function getClient(): Promise<Client> {
  if (client?.readyAt) return Promise.resolve(client);
  if (ready) return ready;
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("missing DISCORD_TOKEN env");
  const c = new Client();
  ready = c.login(token).then(() => {
    client = c;
    return c;
  });
  return ready;
}

export interface MsgRow {
  id: string;
  author: string;
  authorId: string;
  timestamp: string;
  content: string;
}

export async function listGuilds() {
  const c = await getClient();
  return c.guilds.cache.map((g: any) => ({
    id: g.id,
    name: g.name,
    memberCount: g.memberCount ?? null,
  }));
}

export async function listChannels(guildId: string) {
  const c = await getClient();
  const g: any = c.guilds.cache.get(guildId);
  if (!g) throw new Error(`guild not found: ${guildId}`);
  await g.channels.fetch();
  return g.channels.cache
    .filter((ch: any) => ch?.isText?.() ?? ch?.type === 0)
    .map((ch: any) => ({ id: ch.id, name: ch.name, topic: ch.topic ?? null }));
}

export async function readHistory(
  channelId: string,
  limit = 50,
  before?: string
): Promise<MsgRow[]> {
  const c = await getClient();
  const ch: any = c.channels.cache.get(channelId) ?? (await c.channels.fetch(channelId));
  const msgs = await ch.messages.fetch({ limit: Math.min(limit, 100), ...(before ? { before } : {}) });
  return [...msgs.values()]
    .sort((a: any, b: any) => a.createdTimestamp - b.createdTimestamp)
    .map((m: any) => ({
      id: m.id,
      author: m.author?.username ?? "?",
      authorId: m.author?.id ?? "?",
      timestamp: m.createdAt.toISOString(),
      content: (m.content ?? "") + (m.attachments?.size ? ` [${m.attachments.size} attachment(s)]` : ""),
    }));
}

export async function searchInGuild(
  guildId: string,
  query: string,
  limit = 25
): Promise<MsgRow[]> {
  // user-account message search endpoint via self-client internals
  const c = await getClient();
  const g: any = c.guilds.cache.get(guildId);
  if (!g) throw new Error(`guild not found: ${guildId}`);
  const res: any = await (c as any).api
    .guilds(guildId)
    .messages.search.get({ query: { content: query, limit: Math.min(limit, 25) } })
    .catch(() => null);
  const hits = res?.messages?.flat?.() ?? [];
  return hits.map((m: any) => ({
    id: m.id,
    author: m.author?.username ?? "?",
    authorId: m.author?.id ?? "?",
    timestamp: m.timestamp ?? "",
    content: m.content ?? "",
  }));
}
