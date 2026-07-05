import {
  createCallerFactory,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { portfolioRouter } from "~/server/api/routers/portfolio";
import { domainRouter } from "~/server/api/routers/domain";
import { billingRouter } from "~/server/api/routers/billing";

/**
 * The primary tRPC router. Generation still runs through the streaming
 * /api/generate Route Handler (SSE); everything else (dashboard reads,
 * portfolio edits, public toggle, custom domains) goes through this.
 */
export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ ok: true })),
  portfolio: portfolioRouter,
  domain: domainRouter,
  billing: billingRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
