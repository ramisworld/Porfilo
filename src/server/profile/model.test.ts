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
    expect(parsed.experience).toEqual([]);
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

  it("enforces the fixed nine-project product limit", () => {
    const projects = Array.from({ length: 10 }, (_, index) => ({
      name: `Project ${index + 1}`,
      blurb: "A grounded project description.",
      tech: ["TypeScript"],
      repoUrl: `https://github.com/rami/project-${index + 1}`,
    }));

    expect(
      profileDataSchema.safeParse({ ...legacyProfile, projects }).success,
    ).toBe(false);
    expect(
      profileDataSchema.safeParse({
        ...legacyProfile,
        projects: projects.slice(0, 9),
      }).success,
    ).toBe(true);
  });

  it("accepts optional experience and credential dates", () => {
    const parsed = profileDataSchema.parse({
      ...legacyProfile,
      experience: [
        {
          role: "AI engineer",
          company: "Example Labs",
          startDate: "2024",
          endDate: "Present",
          summary: "Built grounded agent systems.",
        },
      ],
      credentials: [{ title: "Cloud Engineer", issuer: "Example", year: 2025 }],
    });

    expect(parsed.experience[0]?.company).toBe("Example Labs");
    expect(parsed.credentials[0]?.year).toBe(2025);
  });

  it("rejects blank identity and project content", () => {
    expect(
      profileDataSchema.safeParse({
        ...legacyProfile,
        identity: { ...legacyProfile.identity, name: "   " },
      }).success,
    ).toBe(false);
    expect(
      profileDataSchema.safeParse({
        ...legacyProfile,
        projects: [
          {
            ...legacyProfile.projects[0],
            name: "",
            blurb: " ",
            tech: [""],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
