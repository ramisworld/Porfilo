import { execFileSync } from "node:child_process";

const tree = JSON.parse(
  execFileSync("pnpm", ["list", "--prod", "--json", "--depth", "Infinity"], {
    encoding: "utf8",
  }),
);
const packages = new Map();

function collect(node) {
  for (const [name, dependency] of Object.entries(node?.dependencies ?? {})) {
    if (dependency.version) {
      const versions = packages.get(name) ?? new Set();
      versions.add(dependency.version);
      packages.set(name, versions);
    }
    collect(dependency);
  }
}

for (const root of tree) collect(root);

const body = Object.fromEntries(
  [...packages].map(([name, versions]) => [name, [...versions]]),
);
const response = await fetch(
  "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
  {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  },
);

if (!response.ok) {
  throw new Error(`npm advisory service returned ${response.status}`);
}

const advisories = await response.json();
const findings = Object.entries(advisories).flatMap(([name, entries]) =>
  entries.map((entry) => ({ name, ...entry })),
);

if (findings.length === 0) {
  console.log(`No known production vulnerabilities across ${packages.size} packages.`);
  process.exit(0);
}

for (const finding of findings) {
  console.error(
    `[${finding.severity ?? "unknown"}] ${finding.name}: ${finding.title ?? finding.id}`,
  );
  if (finding.url) console.error(`  ${finding.url}`);
}
console.error(`${findings.length} production advisory finding(s).`);
process.exit(1);
