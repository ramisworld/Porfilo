import { describe, expect, it } from "vitest";
import { profileDataSchema } from "./model";

const legacyProfile = {
  identity: {
    name: "Rami",
    headline: "Building developer tools.",
    role: "AI engineer",
    links: { github: "https://github.com/rami" },
  },
  languages: [{ label: "TypeScript", share: 80 }],
  abilities: [{ label: "React interfaces" }],
  stats: [{ value: "12", label: "projects" }],
  projects: [
    {
      name: "PortHub",
      blurb: "A portfolio builder.",
      tech: ["TypeScript", "Next.js"],
      repoUrl: "https://github.com/rami/porthub",
    },
  ],
  credentials: [],
};

describe("profile data schema", () => {
  it("keeps older profiles valid when focus and stack are missing", () => {
    const parsed = profileDataSchema.parse(legacyProfile);

    expect(parsed.focus).toEqual([]);
    expect(parsed.stack).toEqual([]);
  });

  it("persists editable focus and stack labels", () => {
    const parsed = profileDataSchema.parse({
      ...legacyProfile,
      focus: [" LLMs ", "agents"],
      stack: [" TypeScript ", "Next.js"],
    });

    expect(parsed.focus).toEqual(["LLMs", "agents"]);
    expect(parsed.stack).toEqual(["TypeScript", "Next.js"]);
  });
});
