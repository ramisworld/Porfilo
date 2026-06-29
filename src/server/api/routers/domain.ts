import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "../../../../generated/prisma";
import type { CustomDomain } from "../../../../generated/prisma";
import type { db as DbType } from "~/server/db";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { validateHostname } from "~/server/domains/validate";
import {
  validateFreeSubdomainLabel,
  suggestAlternatives,
} from "~/server/domains/subdomain";
import {
  checkDomainStatus,
  toDisplayStatus,
} from "~/server/domains/status";
import { shouldRefreshCustomDomain } from "~/server/domains/row-state";
import {
  CloudflareApiError,
  CloudflareDisabledError,
  cfCreateOrGetHostname,
  cfDeleteHostname,
  type CfHostname,
} from "~/server/domains/cloudflare";
import { limit } from "~/server/ratelimit";
import type { DomainDisplayStatus } from "~/server/domains/types";
import { cnameLabel } from "~/server/domains/cname-label";

export const domainRouter = createTRPCRouter({
  mine: protectedProcedure.query(async ({ ctx }) => {
    const portfolio = await ctx.db.portfolio.findUnique({
      where: { ownerId: ctx.user.id },
      select: { id: true },
    });
    if (!portfolio) return null;

    let row = await ctx.db.customDomain.findUnique({
      where: { portfolioId: portfolio.id },
    });
    if (!row) return null;

    if (shouldRefreshCustomDomain(row)) {
      row = await refreshCustomDomainRow(ctx, row);
    }

    return withInstructions(row, toDisplayStatus(row));
  }),

  addFreeSubdomain: protectedProcedure
    .input(z.object({ label: z.string().min(1).max(63) }))
    .mutation(async ({ ctx, input }) => {
      const portfolio = await requirePortfolio(ctx);
      await ensureNoExistingDomain(ctx, portfolio.id);

      const rl = limit(`domain:add:${ctx.user.id}`, { window: "10m", max: 5 });
      if (!rl.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Wait a few minutes and try again.",
        });
      }

      const root = env.NEXT_PUBLIC_ROOT_DOMAIN;
      const v = validateFreeSubdomainLabel(input.label, root);
      if (!v.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: v.suggestions?.length
            ? `${v.reason} Try: ${v.suggestions.join(", ")}`
            : v.reason,
        });
      }

      const claimed = await ctx.db.customDomain.findUnique({
        where: { hostname: v.hostname },
        select: { id: true },
      });
      if (claimed) {
        const alt = suggestAlternatives(v.label);
        throw new TRPCError({
          code: "CONFLICT",
          message:
            alt.length > 0
              ? `"${v.label}" is taken. Try: ${alt.join(", ")}`
              : `"${v.label}" is already taken.`,
        });
      }

      let created: CustomDomain;
      try {
        created = await ctx.db.customDomain.create({
          data: {
            portfolioId: portfolio.id,
            hostname: v.hostname,
            type: "free_subdomain",
            status: "active",
            dnsVerified: true,
            httpVerified: true,
            ownershipStatus: "active",
            sslStatus: "active",
            activatedAt: new Date(),
            lastCheckedAt: new Date(),
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const alt = suggestAlternatives(v.label);
          throw new TRPCError({
            code: "CONFLICT",
            message:
              alt.length > 0
                ? `"${v.label}" is taken. Try: ${alt.join(", ")}`
                : `"${v.label}" is already taken.`,
          });
        }
        throw err;
      }

      return withInstructions(created, "FREE_SUBDOMAIN_ACTIVE");
    }),

  addCustomDomain: protectedProcedure
    .input(z.object({ hostname: z.string().min(1).max(253) }))
    .mutation(async ({ ctx, input }) => {
      const portfolio = await requirePortfolio(ctx);
      await ensureNoExistingDomain(ctx, portfolio.id);

      const rl = limit(`domain:add:${ctx.user.id}`, { window: "10m", max: 5 });
      if (!rl.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Wait a few minutes and try again.",
        });
      }

      const v = validateHostname(input.hostname, env.NEXT_PUBLIC_ROOT_DOMAIN);
      if (!v.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: v.reason });
      }
      const hostname = v.hostname;

      const claimed = await ctx.db.customDomain.findUnique({
        where: { hostname },
        select: { id: true },
      });
      if (claimed) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That domain is already connected to another portfolio.",
        });
      }

      let cf: CfHostname;
      try {
        cf = await cfCreateOrGetHostname(hostname);
      } catch (err) {
        if (err instanceof CloudflareDisabledError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
        }
        if (err instanceof CloudflareApiError) {
          throw new TRPCError({
            code: err.status === 409 ? "CONFLICT" : "BAD_GATEWAY",
            message: err.message,
          });
        }
        throw err;
      }

      const txt = extractTxt(cf);
      let created: CustomDomain;
      try {
        created = await ctx.db.customDomain.create({
          data: {
            portfolioId: portfolio.id,
            hostname,
            type: "custom_domain",
            cfHostnameId: cf.id,
            cnameTarget: cnameTarget(),
            verificationHost: txt?.host ?? null,
            verificationToken: txt?.value ?? null,
            status: "pending_dns",
            ownershipStatus: cf.status,
            sslStatus: cf.sslStatus,
            lastCheckedAt: new Date(),
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          try {
            await cfDeleteHostname(cf.id);
          } catch {
            /* best-effort cleanup */
          }
          throw new TRPCError({
            code: "CONFLICT",
            message: "That domain is already connected to another portfolio.",
          });
        }
        throw err;
      }

      return withInstructions(created, toDisplayStatus(created));
    }),

  /** Refresh DNS / Cloudflare / HTTP status and persist. */
  checkStatus: protectedProcedure.mutation(async ({ ctx }) => {
    const row = await ownRowOrThrow(ctx);

    if (row.type === "free_subdomain") {
      return withInstructions(row, "FREE_SUBDOMAIN_ACTIVE");
    }

    const rl = limit(`domain:recheck:${ctx.user.id}`, { window: "1m", max: 12 });
    if (!rl.ok) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Slow down — you can check again shortly.",
      });
    }

    const updated = await refreshCustomDomainRow(ctx, row);
    return withInstructions(updated, toDisplayStatus(updated));
  }),

  remove: protectedProcedure.mutation(async ({ ctx }) => {
    const row = await ownRowOrThrow(ctx);

    if (row.type === "custom_domain" && row.cfHostnameId) {
      try {
        await cfDeleteHostname(row.cfHostnameId);
      } catch (err) {
        if (!(err instanceof CloudflareApiError && err.status === 404)) {
          throw err;
        }
      }
    }

    await ctx.db.customDomain.delete({ where: { id: row.id } });
    return { ok: true };
  }),
});

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

type Ctx = {
  db: typeof DbType;
  user: { id: string };
};

async function requirePortfolio(ctx: Ctx) {
  const portfolio = await ctx.db.portfolio.findUnique({
    where: { ownerId: ctx.user.id },
    select: { id: true },
  });
  if (!portfolio) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Generate a portfolio first.",
    });
  }
  return portfolio;
}

async function ensureNoExistingDomain(ctx: Ctx, portfolioId: string) {
  const existing = await ctx.db.customDomain.findUnique({
    where: { portfolioId },
    select: { id: true },
  });
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Remove your existing domain before adding another.",
    });
  }
}

async function ownRowOrThrow(ctx: Ctx) {
  const portfolio = await requirePortfolio(ctx);
  const row = await ctx.db.customDomain.findUnique({
    where: { portfolioId: portfolio.id },
  });
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No domain on this portfolio.",
    });
  }
  return row;
}

async function refreshCustomDomainRow(
  ctx: Ctx,
  row: CustomDomain,
): Promise<CustomDomain> {
  const checked = await checkDomainStatus(row);
  return ctx.db.customDomain.update({
    where: { id: row.id },
    data: {
      ...persistCheck(row, checked),
      activatedAt:
        checked.displayStatus === "CUSTOM_DOMAIN_ACTIVE" && !row.activatedAt
          ? new Date()
          : row.activatedAt,
    },
  });
}

function cnameTarget(): string {
  return (
    env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET ?? "customers.porfilo.com"
  );
}

function extractTxt(cf: CfHostname): { host: string; value: string } | null {
  const ssl = cf.sslValidationRecords.find((r) => r.txtName && r.txtValue);
  if (ssl?.txtName && ssl.txtValue) {
    return { host: ssl.txtName, value: ssl.txtValue };
  }
  const ov = cf.ownershipVerification;
  if (ov?.type === "txt" && ov.name && ov.value) {
    return { host: ov.name, value: ov.value };
  }
  return null;
}

function persistCheck(
  row: CustomDomain,
  checked: Awaited<ReturnType<typeof checkDomainStatus>>,
) {
  return {
    status: checked.dbStatus,
    dnsVerified: checked.dnsVerified,
    httpVerified: checked.httpVerified,
    ownershipStatus: checked.ownershipStatus,
    sslStatus: checked.sslStatus,
    verificationHost: checked.verificationHost ?? row.verificationHost,
    verificationToken: checked.verificationToken ?? row.verificationToken,
    errorReason: checked.errorReason,
    lastCheckedAt: new Date(),
  };
}

export type DomainWithInstructions = CustomDomain & {
  displayStatus: DomainDisplayStatus;
  instructions: {
    cname: { name: string; value: string };
    txt: { name: string; value: string } | null;
  };
};

function withInstructions(
  row: CustomDomain,
  displayStatus: DomainDisplayStatus,
): DomainWithInstructions {
  const target = row.cnameTarget ?? cnameTarget();
  const txt =
    row.verificationHost && row.verificationToken
      ? { name: row.verificationHost, value: row.verificationToken }
      : null;

  return {
    ...row,
    displayStatus,
    instructions: {
      cname: {
        name: cnameLabel(row.hostname),
        value: target,
      },
      txt,
    },
  };
}
