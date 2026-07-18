import "server-only";
import { Prisma } from "../../../generated/prisma";
import { env } from "~/env";
import { db } from "~/server/db";

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
): number {
  if (records.length === 0) {
    console.log(`[cost] run ${meta.username} (${meta.slug}) — MOCK, $0.0000`);
    return 0;
  }
  const sum = (f: (r: UsageRecord) => number) =>
    records.reduce((a, r) => a + f(r), 0);
  const inTok = sum((r) => r.inputTokens);
  const outTok = sum((r) => r.outputTokens);
  const total = sum((r) => r.costUsd);
  console.log(
    `[cost] ═══ RUN TOTAL ${meta.username} (${meta.slug}): in=${inTok} out=${outTok} → $${total.toFixed(4)} ═══`,
  );
  return total;
}

// ───────────────────── durable daily spend budget ──────────────────────────
// Reservations are persisted before any paid model call. Serializable
// transactions make the cap consistent across Railway replicas and restarts.

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function toMicros(usd: number): number {
  return Math.max(0, Math.round(usd * 1_000_000));
}

function configuredCapUsd(): number | null {
  const raw = env.DAILY_LLM_BUDGET_USD;
  const explicit = raw ? Number.parseFloat(raw) : NaN;
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return env.NODE_ENV === "production" ? PROD_DEFAULT_BUDGET_USD : null;
}

type SpendRow = {
  status: string;
  reservedMicros: number;
  actualMicros: number;
  expiresAt: Date;
};

export function committedSpendMicros(rows: SpendRow[], now: Date): number {
  return rows.reduce((sum, row) => {
    if (row.status === "settled") return sum + row.actualMicros;
    if (row.expiresAt > now) {
      return sum + Math.max(row.reservedMicros, row.actualMicros);
    }
    return sum + row.actualMicros;
  }, 0);
}

// If the operator forgets to set DAILY_LLM_BUDGET_USD, production must NOT run
// uncapped — a rate-limit bypass could otherwise run up an unbounded bill. Fall
// back to a conservative daily ceiling in production; dev stays uncapped.
const PROD_DEFAULT_BUDGET_USD = 25;

export type BudgetReservation = { id: string };
export type BudgetReservationResult =
  | { ok: true; reservation: BudgetReservation | null }
  | { ok: false; message: string };

function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/** Reserve budget before a generation can call Anthropic. */
export async function reserveGenerationBudget(): Promise<BudgetReservationResult> {
  if (env.MOCK_LLM === "true") return { ok: true, reservation: null };
  const capUsd = configuredCapUsd();
  if (capUsd === null) return { ok: true, reservation: null };

  const capMicros = toMicros(capUsd);
  const reservedMicros = toMicros(env.LLM_GENERATION_RESERVATION_USD);
  if (reservedMicros > capMicros) {
    return {
      ok: false,
      message: "Daily generation budget reached. Try again tomorrow.",
    };
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const reservation = await db.$transaction(
        async (tx) => {
          const now = new Date();
          const rows = await tx.llmSpendReservation.findMany({
            where: { day: utcDay() },
            select: {
              status: true,
              reservedMicros: true,
              actualMicros: true,
              expiresAt: true,
            },
          });
          const committedMicros = committedSpendMicros(rows, now);
          if (committedMicros + reservedMicros > capMicros) return null;

          return tx.llmSpendReservation.create({
            data: {
              day: utcDay(),
              reservedMicros,
              expiresAt: new Date(now.getTime() + 20 * 60 * 1000),
            },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return reservation
        ? { ok: true, reservation }
        : {
            ok: false,
            message: "Daily generation budget reached. Try again tomorrow.",
          };
    } catch (error) {
      if (isSerializationFailure(error) && attempt < 3) continue;
      throw error;
    }
  }

  return {
    ok: false,
    message: "Daily generation budget reached. Try again tomorrow.",
  };
}

/** Persist exact usage immediately after every successful model call. */
export async function recordReservedUsage(
  reservation: BudgetReservation | null,
  usage: UsageRecord,
): Promise<void> {
  if (!reservation) return;
  await db.llmSpendReservation.updateMany({
    where: { id: reservation.id, status: "pending" },
    data: { actualMicros: { increment: toMicros(usage.costUsd) } },
  });
}

export async function settleGenerationBudget(
  reservation: BudgetReservation | null,
): Promise<void> {
  if (!reservation) return;
  await db.llmSpendReservation.updateMany({
    where: { id: reservation.id, status: "pending" },
    data: { status: "settled", expiresAt: new Date() },
  });
}

export async function currentSpendUsd(): Promise<number> {
  const now = new Date();
  const rows = await db.llmSpendReservation.findMany({
    where: { day: utcDay() },
    select: {
      status: true,
      reservedMicros: true,
      actualMicros: true,
      expiresAt: true,
    },
  });
  const micros = committedSpendMicros(rows, now);
  return micros / 1_000_000;
}
