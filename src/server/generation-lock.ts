import "server-only";

import { Prisma } from "../../generated/prisma";
import { db } from "~/server/db";

const GENERATION_LOCK_TTL_MS = 15 * 60 * 1000;
const QUOTA_REACHED = "QUOTA_REACHED";

type LockDeniedCode =
  | "generation_in_progress"
  | "quota_reached"
  | "session_invalid";

export type GenerationLockResult =
  | { ok: true }
  | {
      ok: false;
      code: LockDeniedCode;
      error: string;
      status: 401 | 409;
      retryAfter?: number;
    };

function hasPrismaErrorCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === code
  );
}

const isUniqueConflict = (e: unknown) => hasPrismaErrorCode(e, "P2002");
const isFkViolation = (e: unknown) => hasPrismaErrorCode(e, "P2003");

export async function acquireGenerationLock(
  ownerId: string,
  githubUsername: string,
): Promise<GenerationLockResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GENERATION_LOCK_TTL_MS);

  try {
    await db.$transaction(
      async (tx) => {
        await tx.generationLock.deleteMany({
          where: { expiresAt: { lt: now } },
        });

        const existing = await tx.portfolio.count({ where: { ownerId } });
        if (existing >= 1) {
          throw new Error(QUOTA_REACHED);
        }

        await tx.generationLock.create({
          data: {
            ownerId,
            githubUsername: githubUsername.toLowerCase(),
            expiresAt,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === QUOTA_REACHED) {
      return {
        ok: false,
        code: "quota_reached",
        status: 409,
        error:
          "You already have a portfolio. Porfilo is in beta — only one portfolio per account for now.",
      };
    }

    if (isUniqueConflict(err)) {
      const lock = await db.generationLock.findUnique({
        where: { ownerId },
        select: { expiresAt: true },
      });
      const retryAfter = lock
        ? Math.max(1, Math.ceil((lock.expiresAt.getTime() - Date.now()) / 1000))
        : undefined;

      return {
        ok: false,
        code: "generation_in_progress",
        status: 409,
        retryAfter,
        error:
          "A generation is already running for this account. Wait for it to finish before starting another.",
      };
    }

    // P2003 here means the session pointed at a `User.id` that no longer
    // exists (admin nuked the row, dev wiped the DB, etc.). The cookie was
    // still cryptographically valid, but the underlying account is gone, so
    // the right response is "your session ended — sign in again", NOT a 500.
    if (isFkViolation(err)) {
      return {
        ok: false,
        code: "session_invalid",
        status: 401,
        error:
          "Your session is no longer valid. Sign in again to keep generating.",
      };
    }

    throw err;
  }
}

export async function releaseGenerationLock(ownerId: string) {
  await db.generationLock.deleteMany({ where: { ownerId } });
}
