import { readFileSync, writeFileSync } from "fs";
for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const T = process.env.DISCORD_TOKEN;
const out = [];
// all sonnet 5.5 msgs 29-30.09 with outcomes
const r = await fetch(`https://discord.com/api/v9/guilds/1496583917074124912/messages/search?content=${encodeURIComponent("sonnet 5.5")}&limit=25`, { headers: { Authorization: T } });
const j = await r.json();
for (const m of (j.messages || []).flat()) {
  if ((m.timestamp || "").slice(0, 10) >= "2026-09-29") {
    out.push({ author: m.author.username, ts: m.timestamp, content: (m.content || "").slice(0, 400) });
  }
}
writeFileSync("scripts/s55out.json", JSON.stringify(out, null, 1));
console.log("WROTE:" + out.length);
process.exit(0);
