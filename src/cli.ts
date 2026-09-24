// language: TypeScript, file: src/cli.ts, runtime: node 22
// CLI: discord-use <cmd> — humans + scripts, no agent host required.
// cmds: guilds | channels <guildId> | history <channelId> [--limit N] [--before ID]
//        search <guildId> <query> | research <channelId> <query> [--topK N] | route <goal> <candidatesJson>
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// tiny .env loader (no dep)
try {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  for (const f of [join(root, ".env"), ".env"]) {
    try {
      for (const line of readFileSync(f, "utf8").split("\n")) {
        const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
      break;
    } catch {}
  }
} catch {}

const { listGuilds, listChannels, readHistory, searchInGuild } = await import("./discord.js");
const { jevRank, jevRoute, jevDone } = await import("./jev.js");

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string, def?: string) => {
  const i = rest.findIndex((a) => a === `--${name}`);
  if (i === -1) return def;
  return rest[i + 1] ?? def;
};
const j = (v: unknown) => console.log(JSON.stringify(v, null, 2));

switch (cmd) {
  case "guilds":
    j(await listGuilds());
    break;
  case "channels":
    j(await listChannels(rest[0]));
    break;
  case "history":
    j(await readHistory(rest[0], Number(flag("limit", "50")), flag("before")));
    break;
  case "search":
    j(await searchInGuild(rest[0], rest.slice(1).join(" ")));
    break;
  case "research": {
    const [channelId, ...qparts] = rest.filter((a) => !a.startsWith("--") && a !== flag("topK", ""));
    const query = qparts.join(" ");
    const rows = await readHistory(channelId, Number(flag("limit", "100")));
    const texts = rows.map((r) => `${r.author}: ${r.content}`);
    const ranked = await jevRank(query, texts);
    const topK = Number(flag("topK", "15"));
    const top = ranked.slice(0, topK).map((r) => ({ ...rows[r.index], jevScore: r.score }));
    const done = await jevDone(query, top.map((t: any) => `${t.author}: ${t.content}`).join("\n"));
    j({ top, done, scanned: rows.length });
    break;
  }
  case "route":
    j(await jevRoute(rest[0], JSON.parse(rest[1])));
    break;
  default:
    console.log(`discord-use — discord user-account research + Jev triage
usage:
  discord-use guilds
  discord-use channels <guildId>
  discord-use history <channelId> [--limit N] [--before ID]
  discord-use search <guildId> <query...>
  discord-use research <channelId> <query...> [--limit N] [--topK N]
  discord-use route <goal> <candidatesJson>
env: DISCORD_TOKEN, AI_GATEWAY_API_KEY`);
    process.exit(cmd ? 1 : 0);
}
process.exit(0);
