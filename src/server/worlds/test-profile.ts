import type { ProfileData } from "~/server/profile/model";

export const WORLD_TEST_PROFILE: ProfileData = {
  identity: {
    name: "Alex Rivera",
    role: "AI systems engineer",
    headline: "Building reliable agent infrastructure.",
    location: "Auckland, New Zealand",
    links: {
      github: "https://github.com/alexrivera",
      site: "https://example.com",
      email: "alex@example.com",
      linkedin: "https://linkedin.com/in/alexrivera",
    },
  },
  languages: [
    { label: "TypeScript", share: 55 },
    { label: "Python", share: 45 },
  ],
  focus: ["AI agents", "distributed systems", "developer tooling"],
  stack: ["TypeScript", "Python", "React", "Postgres", "Docker"],
  abilities: [
    { label: "Agent architecture" },
    { label: "Reliable APIs" },
    { label: "Interface systems" },
  ],
  stats: [
    { value: "640", label: "Contributions (1y)" },
    { value: "9", label: "Featured projects" },
  ],
  projects: Array.from({ length: 9 }, (_, index) => ({
    name:
      index === 8 ? "Long Form Classification Model" : `Project ${index + 1}`,
    blurb: `A grounded project description for build ${index + 1}.`,
    tech: index % 2 ? ["TypeScript", "React"] : ["Python", "Postgres"],
    stars: index === 0 ? 120 : undefined,
    year: 2026 - Math.floor(index / 3),
    repoUrl: `https://github.com/alexrivera/project-${index + 1}`,
  })),
  experience: [
    {
      role: "Senior AI Engineer",
      company: "Northstar Labs",
      startDate: "2024",
      endDate: "Present",
      location: "Remote",
      summary: "Built production agent infrastructure and evaluation systems.",
      highlights: ["Agent orchestration", "Evaluation pipelines"],
      url: "https://example.com",
    },
  ],
  credentials: [
    {
      title: "Cloud AI Engineer",
      issuer: "Example Institute",
      credentialId: "AI-2048",
      skills: ["AI systems", "Cloud architecture"],
    },
  ],
  github: {
    contributionsPastYear: 640,
    publicRepos: 24,
    memberSinceYear: 2019,
  },
};
