# Fill contract — the `DATA` object every world consumes

Every world is a **self-contained HTML template** whose only variable part is a single
`DATA` object near the top of its `<script>`, wrapped in a clearly-marked fill boundary:

```js
/* ===== FILL CONTRACT — the director replaces ONLY the DATA object below ===== */
const DATA = { … };
/* ===== END DATA — template logic below (not per-user) ===== */
```

The Haiku **world chooser** reads the user's written vibe and selects one approved world ID.
Deterministic server code maps the validated GitHub profile into `DATA`, swaps that object into the
chosen template, and persists `Portfolio.code` for a sandboxed iframe. **Every world reads 100% of
its portfolio content from `DATA` — nothing about the person is hardcoded in markup.** The canonical,
working examples are `brutalist.html` and `terminal-nexus.html`; copy the `DATA` block from either
verbatim.

## Schema

```js
const DATA = {
  identity: {
    name:      "Rami",                       // display name
    handle:    "ramisworld",                 // github handle (no @)
    role:      "Full-stack developer",
    headline:  "Building AI apps.",          // punchy hero line (a world may render huge)
    location:  "Auckland, New Zealand",      // "City, Region"
    timezone:  "Pacific/Auckland",           // IANA tz for a live clock (optional)
    tzLabel:   "NZST",                        // short clock label (optional)
    available: true,                          // shows an "available for work" signal
  },
  tagline: "Full-stack systems … until it *disappears*.",  // manifesto; *word* = accent
  email:   "rami.vicilah@gmail.com",
  links:   { github:"https://…", site:"https://…", x:"", linkedin:"" },  // any may be ""/absent
  stats:   { contributionsPastYear:268, publicRepos:8, featuredBuilds:6, buildingSince:2024 },
  stack:   ["TypeScript","JavaScript","Python", …],   // unranked; NO percentages
  primaryStack: "TypeScript",                          // the one to emphasise
  disciplines:  [ ["Systems","Back-end · APIs"], … ],  // [label, detail] pairs
  projects: [
    { name:"Porfilo", year:2026, tech:["TypeScript","Next"], stars:0,
      repoUrl:"https://…", demoUrl:"",           // demoUrl optional
      blurb:"A portfolio generator — …" },
    …
  ], // maximum 9
  credentials: [ /* { title, issuer, year, url? } — OPTIONAL; often empty */ ],
};
```

Experience is stored in validated `ProfileData` and injected by the server renderer as a themed,
optional section. It is omitted completely when the user has not added any experience entries.

## Rules every template must follow

1. **Render only from `DATA`.** No hardcoded name, project, stat, or copy in the markup. Build
   nodes in JS by mapping over `DATA` (see the two reference templates).
2. **Escape everything injected.** `DATA` holds user-derived strings — always pass them through an
   `esc()` helper before `innerHTML`, and through `esc()` in `href`s. (Both references include one.)
3. **Honest-data rules (enforced in render logic):**
   - **Never render a language percentage.** `stack` is an unranked set — tags/list, no numbers, no
     proportion bars.
   - **Show `stars` only when `stars >= 50`** (`const STAR_MIN = 50`). Otherwise omit.
   - Omit any metric that would undersell the person.
4. **Optional fields degrade gracefully.** Empty `credentials` → the credentials section does not
   render (and any section numbering closes up). Missing `links.x` / `demoUrl` / `tzLabel` → just skip.
5. **Keep the fill boundary intact** — the `DATA` object stays a single top-of-script literal so the
   renderer can replace it by string-substitution without parsing the template.
6. **`palette` may be added later** — a world may read an optional `DATA.palette` key to theme itself;
   until then, each world ships one considered palette.

The renderer fills this same shape regardless of which world Haiku picks — that's what makes the
worlds interchangeable.
