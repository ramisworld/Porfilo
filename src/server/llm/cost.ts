import "server-only";

/**
 * Token + cost accounting for LLM calls. Every live generation logs exact tokens
 * and computed cost per layer (Haiku facts, Haiku world chooser) plus a run total, so we
 * can analyse spend per run. Grep server logs for `[cost]`.
 */

// USD per 1,000,000 tokens (see docs/ARCHITECTURE.md §4). Keep in sync with models.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
};

// Cache multipliers (read ~0.1x input price, write ~1.25x). 0 for our uncached calls.
const CACHE_READ_MULT = 0.1;
const CACHE_WRITE_MULT = 1.25;

interface RawUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export interface UsageRecord {
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

export function buildUsageRecord(
  label: string,
  model: string,
  usage: RawUsage,
): UsageRecord {
  const price = PRICING[model] ?? { input: 0, output: 0 };
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;

  const costUsd =
    (inputTokens * price.input +
      outputTokens * price.output +
      cacheReadTokens * price.input * CACHE_READ_MULT +
      cacheCreationTokens * price.input * CACHE_WRITE_MULT) /
    1_000_000;

  return {
    label,
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd,
  };
}

export function logUsage(r: UsageRecord): void {
  const cache =
    r.cacheReadTokens || r.cacheCreationTokens
      ? ` cache(r=${r.cacheReadTokens},w=${r.cacheCreationTokens})`
      : "";
  console.log(
    `[cost] ${r.label.padEnd(14)} ${r.model.padEnd(18)} in=${r.inputTokens} out=${r.outputTokens}${cache} → $${r.costUsd.toFixed(4)}`,
  );
}

export function logRunTotal(
  meta: { username: string; slug: string },
  records: UsageRecord[],
): void {
  if (records.length === 0) {
    console.log(`[cost] run ${meta.username} (${meta.slug}) — MOCK, $0.0000`);
    return;
  }
  const sum = (f: (r: UsageRecord) => number) =>
    records.reduce((a, r) => a + f(r), 0);
  const inTok = sum((r) => r.inputTokens);
  const outTok = sum((r) => r.outputTokens);
  const total = sum((r) => r.costUsd);
  console.log(
    `[cost] ═══ RUN TOTAL ${meta.username} (${meta.slug}): in=${inTok} out=${outTok} → $${total.toFixed(4)} ═══`,
  );
  recordSpend(total);
}

// ───────────────────────── daily spend budget ──────────────────────────────
// In-process, resets at UTC midnight. Hard kill-switch: when DAILY_LLM_BUDGET_USD
// is exceeded, /api/generate refuses new runs until the day rolls over. This
// protects the bill from a runaway loop or an attacker who got past rate limits.

let spendDay = utcDay();
let spendUsd = 0;

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function rollIfNewDay() {
  const today = utcDay();
  if (today !== spendDay) {
    spendDay = today;
    spendUsd = 0;
  }
}

function recordSpend(usd: number) {
  rollIfNewDay();
  spendUsd += usd;
}

// If the operator forgets to set DAILY_LLM_BUDGET_USD, production must NOT run
// uncapped — a rate-limit bypass could otherwise run up an unbounded bill. Fall
// back to a conservative daily ceiling in production; dev stays uncapped.
const PROD_DEFAULT_BUDGET_USD = 25;

/** Returns `null` when there's headroom, or a reason string when the cap is reached. */
export function checkBudget(): string | null {
  rollIfNewDay();
  const raw = process.env.DAILY_LLM_BUDGET_USD;
  let cap = raw ? Number.parseFloat(raw) : NaN;
  if (!Number.isFinite(cap) || cap <= 0) {
    // No valid explicit cap: enforce a default in production, stay uncapped in dev.
    if (process.env.NODE_ENV === "production") cap = PROD_DEFAULT_BUDGET_USD;
    else return null;
  }
  if (spendUsd >= cap) {
    return `Daily generation budget reached ($${spendUsd.toFixed(2)} / $${cap.toFixed(2)}). Try again tomorrow.`;
  }
  return null;
}

export function currentSpendUsd() {
  rollIfNewDay();
  return spendUsd;
}
