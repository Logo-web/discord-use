import { readFileSync, writeFileSync } from "fs";
for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const T = process.env.DISCORD_TOKEN;
const out = [];
// sonnet fail reports: search fail/broken/not working + sonnet context
for (const q of ["sonnet 5.5", "sonnet not working", "sonnet flagged", "sonnet refused"]) {
  const r = await fetch(`https://discord.com/api/v9/guilds/1496583917074124912/messages/search?content=${encodeURIComponent(q)}&limit=25`, { headers: { Authorization: T } });
  const j = await r.json();
  for (const m of (j.messages || []).flat()) {
    const c = (m.content || "");
    if (/fail|broke|not work|flag|refus|patch|fix|stopped|doesn.t work/i.test(c)) {
      out.push({ author: m.author.username, ts: m.timestamp, content: c.slice(0, 500), att: (m.attachments || []).map((a) => a.filename) });
    }
  }
}
// fresh history from jailbreak channels for sonnet outcomes
for (const ch of ["1496588820773343493", "1496633518170701955"]) {
  const r = await fetch(`https://discord.com/api/v9/channels/${ch}/messages?limit=100`, { headers: { Authorization: T } });
  const j = await r.json();
  for (const m of j) {
    const c = (m.content || "").toLowerCase();
    if (c.includes("sonnet") && /fail|broke|not work|flag|refus|patch|stopped|working|works/i.test(c)) {
      if (!out.find((o) => o.ts === m.timestamp)) {
        out.push({ author: m.author.username, ts: m.timestamp, content: (m.content || "").slice(0, 500), att: (m.attachments || []).map((a) => a.filename) });
      }
    }
  }
}
writeFileSync("scripts/sonnetfail.json", JSON.stringify(out, null, 1));
console.log("WROTE:" + out.length);
process.exit(0);
