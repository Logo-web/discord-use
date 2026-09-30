// language: TypeScript, file: src/bandwork-cli.ts, runtime: node 22
// CLI: bandwork run <plan.json> — operator supplies plan + generator.
// Generator: --echo (dry-run) or --gateway <model> via Vercel AI Gateway chat.
// Modes: base ladder (default) or --profiled (wall auto-detect + profile switch + cache).
// Usage:
//   node dist/bandwork-cli.js demo
//   node dist/bandwork-cli.js run plan.json --gateway xiaomi/mimo-v2.6-flash [--profiled] [--lang c] [--throttle 4000]
import { readFileSync } from "fs";
import { bandwork, bandworkProfiled, assemble, type Plan } from "./bandwork.js";

const [cmd, ...rest] = process.argv.slice(2);
const flagVal = (name: string, def?: string) => {
  const i = rest.findIndex((a) => a === `--${name}`);
  if (i === -1) return def;
  return rest[i + 1] ?? def;
};
const hasFlag = (name: string) => rest.includes(`--${name}`);

async function gatewayGenerate(
  model: string,
  throttleMs: number,
  lang?: string
): Promise<(prompt: string) => Promise<string>> {
  const key = process.env.AI_GATEWAY_API_KEY || process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error("missing AI_GATEWAY_API_KEY");
  const langLock = lang ? `Answer in ${lang} only. No other language. No markdown fences, raw code only. ` : "";
  return async (prompt: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: langLock + prompt }],
          max_tokens: 500,
        }),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`gateway ${res.status}`);
      const j: any = await res.json();
      await new Promise((r) => setTimeout(r, throttleMs)); // ladder throttle
      return j.choices?.[0]?.message?.content ?? "";
    }
    throw new Error("gateway 429 x3 — rate limited, try later");
  };
}

const echoGenerate = async (prompt: string) =>
  `// echo-body for: ${prompt.slice(0, 60)}\nint placeholder_fn(int x) { return x; }`;

if (cmd === "demo" || cmd === "run") {
  let plan: Plan;
  let generate: (p: string) => Promise<string>;
  if (cmd === "demo") {
    plan = {
      includes: ["#include <stdio.h>"],
      types: ["typedef int num;"],
      slots: [
        { name: "fib", sentence: "compute the nth fibonacci number iteratively", signature: "num fib(num n)" },
        { name: "main_fn", sentence: "print fib(10) to stdout", signature: "int main_fn()" },
      ],
      mainOrder: ["fib", "main_fn"],
    };
    generate = echoGenerate;
  } else {
    plan = JSON.parse(readFileSync(rest[0], "utf8"));
    const gw = rest.findIndex((a) => a === "--gateway");
    const throttle = Number(flagVal("throttle", "4000"));
    const lang = flagVal("lang");
    generate = gw === -1 ? echoGenerate : await gatewayGenerate(rest[gw + 1], throttle, lang);
  }
  const aliases: Record<string, string> = {};
  const profiled = hasFlag("profiled");
  // length-guarded integrate pass: only emit assembled file if complete + >=70% slot coverage
  const show = (bodies: Map<string, string>, log: any[], extra?: any) => {
    const coverage = bodies.size / plan.slots.length;
    console.log("=== LOG ===");
    for (const l of log) console.log(`${l.slot} rung=${l.rung} ${l.reason}`);
    if (extra?.profiles) console.log("PROFILES: " + JSON.stringify(extra.profiles));
    console.log(`COVERAGE: ${bodies.size}/${plan.slots.length} (${Math.round(coverage * 100)}%)`);
    if (bodies.size === plan.slots.length && coverage >= 0.7) {
      console.log("=== ASSEMBLED (integrate pass OK) ===");
      console.log(assemble(plan, bodies));
    } else {
      console.log("=== INTEGRATE BLOCKED — below 70% or incomplete, TODO floor: ===");
      console.log(assemble(plan, bodies));
    }
  };
  if (profiled) {
    const { bodies, log, profiles } = await bandworkProfiled(plan, generate);
    show(bodies, log, { profiles });
  } else {
    const { bodies, log } = await bandwork(plan, aliases, generate);
    show(bodies, log);
  }
  process.exit(0);
} else {
  console.log(`bandwork — decomposition pipeline (cleanroom, from public whitepaper)
usage:
  node dist/bandwork-cli.js demo
  node dist/bandwork-cli.js run <plan.json> [--gateway <model>] [--profiled] [--lang c] [--throttle ms]`);
  process.exit(1);
}
