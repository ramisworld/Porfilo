import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  fetchRawProfile: vi.fn(),
  buildFacts: vi.fn(),
  chooseWorld: vi.fn(),
  renderWorld: vi.fn(),
  logRunTotal: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("~/server/github/fetch", () => ({
  fetchRawProfile: h.fetchRawProfile,
}));
vi.mock("~/server/llm/facts", () => ({ buildFacts: h.buildFacts }));
vi.mock("~/server/worlds/choose", () => ({ chooseWorld: h.chooseWorld }));
vi.mock("~/server/worlds/render", () => ({ renderWorld: h.renderWorld }));
vi.mock("~/server/llm/cost", () => ({ logRunTotal: h.logRunTotal }));
vi.mock("../../../generated/prisma", () => ({
  Prisma: {
    JsonNull: "JSON_NULL",
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));
vi.mock("~/server/db", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        portfolio: {
          findFirst: h.findFirst,
          update: h.update,
          count: h.count,
          create: h.create,
        },
      }),
  },
}));

import { runGeneration } from "./generate";

const profileData = {
  identity: {
    name: "New Name",
    headline: "AI systems engineer",
    role: "Engineer",
    links: {},
  },
  languages: [],
  focus: [],
  stack: [],
  abilities: [],
  stats: [],
  projects: [],
  experience: [],
  credentials: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.fetchRawProfile.mockResolvedValue({ user: { login: "new-handle" } });
  h.buildFacts.mockResolvedValue({ data: profileData, usage: null });
  h.chooseWorld.mockResolvedValue({
    choice: { worldId: "terminalNexus" },
    usage: null,
  });
  h.renderWorld.mockReturnValue("<!doctype html><title>new</title>");
  h.findFirst.mockResolvedValue({ publicSubdomainSlug: "stable-public-slug" });
  h.update.mockResolvedValue({});
});

describe("runGeneration replace-in-place", () => {
  it("replaces generated fields while preserving the public URL and domain relation", async () => {
    const events = [];
    for await (const event of runGeneration(
      "new-handle",
      "dark editorial systems with tactile motion",
      { ownerId: "user-1", replacePortfolioId: "portfolio-1" },
    )) {
      events.push(event);
    }

    expect(h.findFirst).toHaveBeenCalledWith({
      where: { id: "portfolio-1", ownerId: "user-1" },
      select: { publicSubdomainSlug: true },
    });
    const updateCalls = h.update.mock.calls as unknown as Array<
      [{ where: { id: string }; data: Record<string, unknown> }]
    >;
    const updateCall = updateCalls[0]?.[0];
    expect(updateCall?.where).toEqual({ id: "portfolio-1" });
    expect(updateCall?.data).toMatchObject({
      githubUsername: "new-handle",
      vibe: "dark editorial systems with tactile motion",
      template: "terminalNexus",
      code: "<!doctype html><title>new</title>",
      claimNonce: null,
      ogImage: null,
      ogImageFingerprint: null,
    });

    const updateData = updateCall?.data ?? {};
    expect(updateData).not.toHaveProperty("id");
    expect(updateData).not.toHaveProperty("slug");
    expect(updateData).not.toHaveProperty("publicSubdomainSlug");
    expect(updateData).not.toHaveProperty("isPublic");
    expect(h.create).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({
      stage: "done",
      slug: "stable-public-slug",
      ownerless: false,
    });
  });

  it("never updates a portfolio not owned by the requesting user", async () => {
    h.findFirst.mockResolvedValue(null);
    const events = [];

    for await (const event of runGeneration("new-handle", "premium dark UI", {
      ownerId: "user-1",
      replacePortfolioId: "someone-elses-portfolio",
    })) {
      events.push(event);
    }

    expect(h.update).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({
      stage: "error",
      code: "internal",
    });
  });
});
