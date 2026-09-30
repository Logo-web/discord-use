// language: TypeScript, file: src/bandwork-cli.ts, runtime: node 22
// CLI demo: bandwork run <plan.json> — operator supplies plan + generator.
// Generator options: --echo (dry-run, no model) or --gateway <model> via Vercel AI Gateway chat.
// Usage:
//   node dist/bandwork-cli.js run plan.json --echo
//   node dist/bandwork-cli.js run plan.json --gateway openai/gpt-5-mini
//   node dist/bandwork-cli.js demo   (harmless fibonacci plan, echo generator)
import { readFileSync } from "fs";
import { bandwork, assemble, type Plan } from "./bandwork.js";

const [cmd, ...rest] = process.argv.slice(2);

async function gatewayGenerate(model: string): Promise<(prompt: string) => Promise<string>> {
  const key = process.env.AI_GATEWAY_API_KEY || process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error("missing AI_GATEWAY_API_KEY");
  return async (prompt: string) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 800 }),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`gateway ${res.status}`);
      const j: any = await res.json();
      await new Promise((r) => setTimeout(r, 2000)); // ladder throttle
      return j.choices?.[0]?.message?.content ?? "";
    }
    throw new Error("gateway 429 x4 — rate limited, try later");
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
    generate = gw === -1 ? echoGenerate : await gatewayGenerate(rest[gw + 1]);
  }
  const aliases: Record<string, string> = {};
  const { bodies, log } = await bandwork(plan, aliases, generate);
  console.log("=== LOG ===");
  for (const l of log) console.log(`${l.slot} rung=${l.rung} ${l.reason}`);
  console.log("=== ASSEMBLED ===");
  console.log(assemble(plan, bodies));
  process.exit(0);
} else {
  console.log(`bandwork — decomposition pipeline (cleanroom, from public whitepaper)
usage:
  node dist/bandwork-cli.js demo
  node dist/bandwork-cli.js run <plan.json> [--gateway <model>]`);
  process.exit(1);
}
