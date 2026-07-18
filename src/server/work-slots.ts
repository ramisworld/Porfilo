import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "~/server/db";

export type WorkLease = {
  kind: string;
  slot: number;
  token: string;
};

/**
 * Atomically claim one fixed slot. Database state makes the ceiling effective
 * across Railway replicas; an expiry lets another process recover crashed work.
 */
export async function tryAcquireWorkSlot({
  kind,
  maxConcurrent,
  leaseMs,
}: {
  kind: string;
  maxConcurrent: number;
  leaseMs: number;
}): Promise<WorkLease | null> {
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);

  for (let slot = 0; slot < maxConcurrent; slot += 1) {
    await db.workSlot.upsert({
      where: { kind_slot: { kind, slot } },
      create: { kind, slot },
      update: {},
    });
    const claimed = await db.workSlot.updateMany({
      where: {
        kind,
        slot,
        OR: [{ token: null }, { expiresAt: { lt: now } }],
      },
      data: { token, expiresAt },
    });
    if (claimed.count === 1) return { kind, slot, token };
  }

  return null;
}

export async function releaseWorkSlot(lease: WorkLease): Promise<void> {
  await db.workSlot.updateMany({
    where: {
      kind: lease.kind,
      slot: lease.slot,
      token: lease.token,
    },
    data: { token: null, expiresAt: null },
  });
}
