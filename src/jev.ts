// language: TypeScript, file: src/jev.ts, runtime: node 22
// Jev via Vercel AI Gateway TypeSafe-compatible endpoint.
// Base URL: https://ai-gateway.vercel.sh/typesafe — auth is the AI_GATEWAY_API_KEY,
// NOT the raw TypeSafe key. TYPESAFE_API_KEY env here holds your vck_ gateway key.
const GATEWAY_BASE = "https://ai-gateway.vercel.sh/typesafe";
const MODEL = "typesafe-ai/jev";

function gatewayKey(): string {
  const k =
    process.env.AI_GATEWAY_API_KEY ||
    process.env.TYPESAFE_API_KEY ||
    process.env.VERCEL_GATEWAY_KEY;
  if (!k) throw new Error("missing AI_GATEWAY_API_KEY (or TYPESAFE_API_KEY holding the vck_ gateway key)");
  return k;
}

export type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: Record<string, string> };

export interface JevResult {
  answers: Record<string, any>;
  usage?: any;
}

export async function jevEvaluate(
  state: string,
  questions: Record<string, JevQuestion>
): Promise<JevResult> {
  const res = await fetch(`${GATEWAY_BASE}/v1/systemone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gatewayKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, state, questions }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`jev ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json() as Promise<JevResult>;
}

// --- discord research helpers ---

// Score a batch of messages for relevance. Returns indices sorted desc.
export async function jevRank(
  query: string,
  messages: string[]
): Promise<{ index: number; score: number }[]> {
  const state = `Research question: ${query}\n\nMessages:\n` +
    messages.map((m, i) => `[${i}] ${m.slice(0, 500)}`).join("\n");
  const questions: Record<string, JevQuestion> = {};
  for (let i = 0; i < messages.length; i++) {
    questions[`m${i}`] = {
      type: "noul",
      instructions: `Is message [${i}] relevant to the research question?`,
    };
  }
  const { answers } = await jevEvaluate(state, questions);
  return messages
    .map((_, i) => ({ index: i, score: answers[`m${i}`]?.noul ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

// Route: which channel/thread to dig next.
export async function jevRoute(
  goal: string,
  candidates: { id: string; label: string }[]
): Promise<{ id: string; confidence: number }> {
  const state = `Goal: ${goal}\n\nCandidates:\n` +
    candidates.map((c) => `${c.id}: ${c.label}`).join("\n");
  const { answers } = await jevEvaluate(state, {
    pick: {
      type: "choice",
      instructions: "Which channel/thread most likely holds the answer?",
      criteria: Object.fromEntries(candidates.map((c) => [c.id, c.label])),
    },
  });
  const a = answers.pick;
  return { id: a.choice, confidence: a.confidence ?? 0 };
}

// Stop check: is the research goal satisfied by what we have?
export async function jevDone(
  goal: string,
  findings: string
): Promise<{ done: boolean; confidence: number }> {
  const { answers } = await jevEvaluate(
    `Goal: ${goal}\n\nFindings so far:\n${findings.slice(0, 4000)}`,
    { satisfied: { type: "noul", instructions: "Is the research goal satisfied by these findings?" } }
  );
  const n = answers.satisfied?.noul ?? 0;
  return { done: n >= 0.8, confidence: n };
}
