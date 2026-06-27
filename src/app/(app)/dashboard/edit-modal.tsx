"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ZodIssue } from "zod";
import {
  profileDataSchema,
  type Ability,
  type Credential,
  type ProfileData,
  type Project,
  type Stat,
} from "~/server/profile/model";
import {
  ISSUERS,
  ISSUER_BY_KEY,
  resolveCredentialIssuerKey,
  type IssuerMeta,
} from "~/lib/issuers";
import { api } from "~/trpc/react";

/**
 * Edit modal — a liquid-glass overlay that lives on top of the dashboard.
 *
 *   ● Section nav (Identity · Focus & Stack · Stats · Projects) on the left
 *   ● Scrollable form on the right
 *   ● Sticky footer: status + Save
 *   ● Closing with unsaved changes prompts: Save · Discard · Cancel
 *   ● Saving closes the modal and refreshes the preview behind it.
 *
 * `githubUsername` is read-only during beta — changing it would invalidate
 * the LLM-curated facts without a re-scrape, which the beta cap forbids.
 */
export function EditModal({
  initial,
  githubUsername,
  onClose,
  onSaved,
}: {
  initial: ProfileData;
  githubUsername: string;
  onClose: () => void;
  /** Called after a successful save with the freshly-persisted payload. */
  onSaved: (saved: ProfileData) => void;
}) {
  const [data, setData] = useState<ProfileData>(() =>
    hydrateEditableProfileData(initial),
  );
  const [baseline, setBaseline] = useState<ProfileData>(() =>
    hydrateEditableProfileData(initial),
  );
  const [tab, setTab] = useState<TabId>("identity");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const savedTimer = useRef<number | undefined>(undefined);

  // Dirty = current form != last-saved baseline.
  const dirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(baseline),
    [data, baseline],
  );

  const update = api.portfolio.updateProfileData.useMutation({
    onError: () =>
      setError(
        "That did not save. Please check your connection and try again.",
      ),
  });

  // Centralized "save succeeded" handler. Takes the validated ProfileData
  // (output of zod parse, defaults applied) so callers don't pay the cost
  // of re-narrowing the input-shape variables.
  const handleSaveSuccess = (next: ProfileData) => {
    setBaseline(structuredClone(next));
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 2400);
    setConfirmClose(false);
    onSaved(next);
    onClose();
  };

  const save = (): void => {
    setError(null);

    // Coerce optional blanks and common URL shorthand before validating.
    const blankToUndef = (s: string | null | undefined): string | undefined => {
      const t = s?.trim();
      if (!t) return undefined;
      return t;
    };
    const optionalUrl = (s: string | null | undefined): string | undefined => {
      const t = blankToUndef(s);
      if (!t) return undefined;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
      return `https://${t}`;
    };

    const focus = parseCommaList(data.focus.join(", "), 8);
    const stack = parseCommaList(data.stack.join(", "), 18);

    const payload: ProfileData = {
      ...data,
      focus,
      stack,
      abilities: abilitiesFromStack(stack),
      identity: {
        ...data.identity,
        location: blankToUndef(data.identity.location),
        links: {
          ...data.identity.links,
          // GitHub link is derived from the (locked) username on save.
          github: `https://github.com/${githubUsername}`,
          site: optionalUrl(data.identity.links.site),
          x: optionalUrl(data.identity.links.x),
          linkedin: optionalUrl(data.identity.links.linkedin),
          email: blankToUndef(data.identity.links.email),
        },
      },
      projects: data.projects.map((p) => ({
        ...p,
        tech: p.tech.map((t) => t.trim()).filter(Boolean),
        demoUrl: optionalUrl(p.demoUrl),
        repoUrl: optionalUrl(p.repoUrl) ?? "",
      })),
      credentials: (data.credentials ?? []).map((c) => {
        const issuerKey = blankToUndef(c.issuerKey);
        const resolvedIssuerKey = resolveCredentialIssuerKey({
          issuerKey,
          issuer: c.issuer,
        });

        return {
          ...c,
          issuerKey: resolvedIssuerKey,
          credentialId: blankToUndef(c.credentialId),
          url: optionalUrl(c.url),
          skills: c.skills?.length
            ? c.skills.map((s) => s.trim()).filter(Boolean)
            : undefined,
        };
      }),
    };

    const parsed = profileDataSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(friendlyValidationMessage(first));
      return;
    }

    const next = parsed.data;
    update.mutate(
      { profileData: next },
      { onSuccess: () => handleSaveSuccess(next) },
    );
  };

  // ✕ click: clean → close immediately; dirty → ask first.
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  // Esc key mirrors the ✕ behavior.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  // Lock body scroll while the modal is mounted.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:px-6 sm:py-8"
    >
      {/* Scrim — clicking it follows the same dirty-prompt path as ✕. */}
      <button
        type="button"
        aria-label="Close editor"
        onClick={requestClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />

      {/* The card */}
      <div
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-white/[0.04] backdrop-blur-2xl sm:h-[min(720px,90vh)]"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.14), 0 50px 80px -25px rgba(0,0,0,0.75)",
        }}
      >
        {/* Top hairline highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
        {/* Soft inner glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-10 -top-10 h-40 opacity-70"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 0%, rgba(140,150,255,0.18), transparent 70%)",
          }}
        />

        {/* Header --------------------------------------------------------- */}
        <header className="relative flex flex-none items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.18em] text-indigo-200/70 uppercase">
              Editor
            </p>
            <h2
              id="edit-modal-title"
              className="text-[15px] font-medium tracking-tight text-white"
            >
              {confirmClose ? "Unsaved changes" : "Edit your portfolio"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {dirty && !confirmClose && (
              <span className="text-[11px] text-amber-300/80">● Unsaved</span>
            )}
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/[0.06] hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        {/* Body ----------------------------------------------------------- */}
        <div className="relative grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[160px_1fr]">
          {/* Section nav */}
          <nav className="flex flex-none gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-3 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-r sm:border-b-0 sm:py-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-left text-[12.5px] transition sm:py-2 ${
                  tab === t.id
                    ? "bg-white/[0.08] text-white"
                    : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Section content */}
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            {tab === "identity" && (
              <IdentitySection
                data={data.identity}
                onChange={(identity) => setData({ ...data, identity })}
                githubUsername={githubUsername}
              />
            )}
            {tab === "focusStack" && (
              <FocusStackSection
                focus={data.focus}
                stack={data.stack}
                onChange={({ focus, stack }) =>
                  setData({
                    ...data,
                    focus,
                    stack,
                    abilities: abilitiesFromStack(stack),
                  })
                }
              />
            )}
            {tab === "stats" && (
              <StatsSection
                items={data.stats}
                onChange={(stats) => setData({ ...data, stats })}
              />
            )}
            {tab === "projects" && (
              <ProjectsSection
                items={data.projects}
                onChange={(projects) => setData({ ...data, projects })}
              />
            )}
            {tab === "credentials" && (
              <CredentialsSection
                items={data.credentials ?? []}
                onChange={(credentials) => setData({ ...data, credentials })}
              />
            )}
          </div>
        </div>

        {/* Footer --------------------------------------------------------- */}
        <footer className="relative flex flex-none items-center justify-between gap-3 border-t border-white/[0.06] bg-black/20 px-5 py-3 backdrop-blur-xl">
          {confirmClose ? (
            <>
              <p
                role={error ? "alert" : undefined}
                className={`text-[12.5px] ${
                  error ? "text-red-300/90" : "text-amber-200/85"
                }`}
              >
                {error ?? "Save your changes before closing?"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClose(false)}
                  disabled={update.isPending}
                  className="inline-flex h-9 items-center rounded-lg px-3 text-[12.5px] text-white/65 transition hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setData(structuredClone(baseline));
                    setConfirmClose(false);
                    onClose();
                  }}
                  disabled={update.isPending}
                  className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12.5px] text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={update.isPending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {update.isPending ? (
                    <>
                      <Spinner dark />
                      Saving
                    </>
                  ) : (
                    "Save and close"
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0 text-[12px]">
                {error ? (
                  <span role="alert" className="text-red-300/90">
                    {error}
                  </span>
                ) : saved ? (
                  <span className="text-emerald-300/90">
                    Saved · your live site is updated.
                  </span>
                ) : dirty ? (
                  <span className="text-white/55">Changes ready to save.</span>
                ) : (
                  <span className="text-white/35">
                    Tweak anything — saves are instant, no regeneration.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setData(structuredClone(baseline))}
                  disabled={!dirty || update.isPending}
                  className="inline-flex h-9 items-center rounded-lg px-3 text-[12.5px] text-white/65 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || update.isPending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-[12.5px] font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {update.isPending ? (
                    <>
                      <Spinner dark />
                      Saving
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Tabs
// ───────────────────────────────────────────────────────────────────────────

type TabId = "identity" | "focusStack" | "stats" | "projects" | "credentials";
const TABS: Array<{ id: TabId; label: string }> = [
  { id: "identity", label: "Identity" },
  { id: "focusStack", label: "Focus & Stack" },
  { id: "stats", label: "Stats" },
  { id: "projects", label: "Projects" },
  { id: "credentials", label: "Credentials" },
];

function hydrateEditableProfileData(input: ProfileData): ProfileData {
  const next = structuredClone(input);
  const focus = next.focus.length ? next.focus : deriveFocus(next);
  const stack = next.stack.length ? next.stack : deriveStack(next);

  return {
    ...next,
    focus,
    stack,
    abilities: next.abilities.length
      ? next.abilities
      : abilitiesFromStack(stack),
  };
}

function deriveFocus(data: ProfileData): string[] {
  const role = data.identity.role.toLowerCase();
  if (/ai|ml|machine|agent|llm|model/.test(role)) {
    return ["LLMs", "agents", "developer tooling"];
  }
  if (/full.?stack|backend|frontend|web/.test(role)) {
    return ["Systems", "interfaces", "tooling"];
  }
  return ["Systems", "tooling", "interfaces"];
}

function deriveStack(data: ProfileData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (label: string | undefined) => {
    const trimmed = label?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  data.languages.forEach((language) => add(language.label));
  data.projects.forEach((project) => project.tech.forEach(add));
  return out.slice(0, 18);
}

function abilitiesFromStack(stack: string[]): Ability[] {
  return stack.slice(0, 24).map((label) => ({ label }));
}

// ───────────────────────────────────────────────────────────────────────────
// Sections
// ───────────────────────────────────────────────────────────────────────────

function IdentitySection({
  data,
  onChange,
  githubUsername,
}: {
  data: ProfileData["identity"];
  onChange: (next: ProfileData["identity"]) => void;
  githubUsername: string;
}) {
  return (
    <SectionShell title="Identity" subtitle="How you read across the site">
      <Row>
        <Field label="Name">
          <TextInput
            value={data.name}
            onChange={(v) => onChange({ ...data, name: v })}
            maxLength={60}
          />
        </Field>
        <Field label="Role">
          <TextInput
            value={data.role}
            onChange={(v) => onChange({ ...data, role: v })}
            maxLength={60}
            placeholder="Software engineer"
          />
        </Field>
      </Row>

      <Field label="Headline">
        <TextArea
          value={data.headline}
          onChange={(v) => onChange({ ...data, headline: v })}
          maxLength={200}
          rows={2}
        />
      </Field>

      <Row>
        <Field label="Location">
          <TextInput
            value={data.location ?? ""}
            onChange={(v) => onChange({ ...data, location: v })}
            maxLength={60}
            placeholder="Auckland, NZ"
          />
        </Field>
        <Field label="GitHub username" hint="Locked during beta">
          <TextInput
            value={githubUsername}
            onChange={() => undefined}
            disabled
          />
        </Field>
      </Row>

      <Row>
        <Field label="Public email">
          <TextInput
            value={data.links.email ?? ""}
            onChange={(v) =>
              onChange({ ...data, links: { ...data.links, email: v } })
            }
            inputType="email"
            placeholder="you@domain.com"
          />
        </Field>
        <Field label="Website">
          <TextInput
            value={data.links.site ?? ""}
            onChange={(v) =>
              onChange({ ...data, links: { ...data.links, site: v } })
            }
            inputType="url"
            placeholder="https://your.site"
          />
        </Field>
      </Row>

      <Row>
        <Field label="X / Twitter URL">
          <TextInput
            value={data.links.x ?? ""}
            onChange={(v) =>
              onChange({ ...data, links: { ...data.links, x: v } })
            }
            inputType="url"
            placeholder="https://x.com/you"
          />
        </Field>
        <Field label="LinkedIn URL">
          <TextInput
            value={data.links.linkedin ?? ""}
            onChange={(v) =>
              onChange({ ...data, links: { ...data.links, linkedin: v } })
            }
            inputType="url"
            placeholder="https://linkedin.com/in/you"
          />
        </Field>
      </Row>
    </SectionShell>
  );
}

function FocusStackSection({
  focus,
  stack,
  onChange,
}: {
  focus: string[];
  stack: string[];
  onChange: (next: { focus: string[]; stack: string[] }) => void;
}) {
  return (
    <SectionShell
      title="Focus & Stack"
      subtitle="Edits the focus and stack lines in the terminal hero"
    >
      <Field label="Focus" hint="Comma separated, max 8">
        <CommaListInput
          value={focus}
          onChange={(nextFocus) => onChange({ focus: nextFocus, stack })}
          maxItems={8}
          placeholder="LLMs, agents, developer tooling"
        />
      </Field>

      <Field label="Stack" hint="Comma separated, max 18">
        <CommaListInput
          value={stack}
          onChange={(nextStack) => onChange({ focus, stack: nextStack })}
          maxItems={18}
          placeholder="TypeScript, JavaScript, CSS, HTML, Python"
        />
      </Field>
    </SectionShell>
  );
}

function StatsSection({
  items,
  onChange,
}: {
  items: Stat[];
  onChange: (next: Stat[]) => void;
}) {
  return (
    <SectionShell title="Stats" subtitle="Three to six punchy numbers">
      <ul className="space-y-2">
        {items.map((s, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_1fr_2fr_auto] items-center gap-1 rounded-xl bg-black/25 p-1 ring-1 ring-white/[0.04]"
          >
            <ReorderControls
              index={i}
              total={items.length}
              onMove={(dir) => onChange(move(items, i, dir))}
            />
            <input
              value={s.value}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...s, value: e.target.value };
                onChange(next);
              }}
              maxLength={12}
              placeholder="1.2k"
              className="h-9 bg-transparent px-2 font-mono text-[13.5px] outline-none placeholder:text-white/25"
            />
            <input
              value={s.label}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...s, label: e.target.value };
                onChange(next);
              }}
              maxLength={24}
              placeholder="GitHub stars"
              className="h-9 bg-transparent px-2 text-[13.5px] outline-none placeholder:text-white/25"
            />
            <RemoveButton
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            />
          </li>
        ))}
      </ul>
      <AddButton
        onClick={() => onChange([...items, { value: "", label: "" }])}
        disabled={items.length >= 8}
      >
        + Add stat
      </AddButton>
    </SectionShell>
  );
}

function ProjectsSection({
  items,
  onChange,
}: {
  items: Project[];
  onChange: (next: Project[]) => void;
}) {
  return (
    <SectionShell title="Projects" subtitle="Up to 9 — reorder with the arrows">
      <ul className="space-y-3">
        {items.map((p, i) => (
          <li
            key={i}
            className="space-y-2 rounded-xl bg-black/20 p-3 ring-1 ring-white/[0.04]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">
                Project {i + 1}
              </p>
              <div className="flex items-center gap-1">
                <ReorderControls
                  index={i}
                  total={items.length}
                  onMove={(dir) => onChange(move(items, i, dir))}
                />
                <RemoveButton
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                />
              </div>
            </div>

            <Row>
              <Field label="Name">
                <TextInput
                  value={p.name}
                  onChange={(v) => {
                    const next = [...items];
                    next[i] = { ...p, name: v };
                    onChange(next);
                  }}
                  maxLength={60}
                />
              </Field>
              <Field label="Repo URL">
                <TextInput
                  value={p.repoUrl}
                  onChange={(v) => {
                    const next = [...items];
                    next[i] = { ...p, repoUrl: v };
                    onChange(next);
                  }}
                  inputType="url"
                  placeholder="https://github.com/you/repo"
                />
              </Field>
            </Row>

            <Field label="Blurb" hint="1–2 sentences">
              <TextArea
                value={p.blurb}
                onChange={(v) => {
                  const next = [...items];
                  next[i] = { ...p, blurb: v };
                  onChange(next);
                }}
                maxLength={280}
                rows={2}
              />
            </Field>

            <Row>
              <Field label="Tech" hint="Comma separated">
                <CommaListInput
                  value={p.tech}
                  onChange={(tech) => {
                    const next = [...items];
                    next[i] = { ...p, tech };
                    onChange(next);
                  }}
                  placeholder="TypeScript, Next.js"
                />
              </Field>
              <Field label="Demo URL" hint="Optional">
                <TextInput
                  value={p.demoUrl ?? ""}
                  onChange={(v) => {
                    const next = [...items];
                    next[i] = { ...p, demoUrl: v };
                    onChange(next);
                  }}
                  inputType="url"
                  placeholder="https://demo.your.site"
                />
              </Field>
            </Row>
          </li>
        ))}
      </ul>
      <AddButton
        onClick={() =>
          onChange([
            ...items,
            { name: "", blurb: "", tech: [], repoUrl: "https://github.com/" },
          ])
        }
        disabled={items.length >= 9}
      >
        + Add project ({items.length}/9)
      </AddButton>
    </SectionShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Credentials
// ───────────────────────────────────────────────────────────────────────────

function CredentialsSection({
  items,
  onChange,
}: {
  items: Credential[];
  onChange: (next: Credential[]) => void;
}) {
  return (
    <SectionShell
      title="Credentials"
      subtitle="Certifications & licenses — up to 20, newest shown first"
    >
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-[13px] text-white/65">
            No credentials yet. Add one to display it in a dedicated section on
            your portfolio.
          </p>
          <p className="mt-1 text-[11.5px] text-white/40">
            Choose a known issuer to get its logo, or pick <em>Other</em> to
            enter a custom name.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((c, i) => (
          <CredentialCardEditor
            key={i}
            value={c}
            index={i}
            total={items.length}
            onChange={(next) => {
              const arr = [...items];
              arr[i] = next;
              onChange(arr);
            }}
            onRemove={() => onChange(items.filter((_, j) => j !== i))}
            onMove={(dir) => onChange(move(items, i, dir))}
          />
        ))}
      </ul>

      <AddButton
        onClick={() =>
          onChange([
            ...items,
            {
              title: "",
              issuer: "",
              issuerKey: undefined,
              credentialId: undefined,
              url: undefined,
              skills: undefined,
            },
          ])
        }
        disabled={items.length >= 20}
      >
        + Add credential ({items.length}/20)
      </AddButton>
    </SectionShell>
  );
}

// Tri-state for the issuer field UX:
//   "unset"  – nothing chosen yet (default for new rows; placeholder shown)
//   "known"  – a registered issuer was picked (logo + locked label)
//   "other"  – user picked "Other…" and types a free-form issuer name
type IssuerMode = "unset" | "known" | "other";

function deriveIssuerMode(value: Credential): IssuerMode {
  if (
    resolveCredentialIssuerKey({
      issuerKey: value.issuerKey,
      issuer: value.issuer,
    })
  ) {
    return "known";
  }
  if (value.issuer && value.issuer.trim().length > 0) return "other";
  return "unset";
}

function CredentialCardEditor({
  value,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  value: Credential;
  index: number;
  total: number;
  onChange: (next: Credential) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  // Mode is derived from the credential, but kept in local state so picking
  // "Other…" sticks even before the user types anything (a freshly-clicked
  // "Other…" has empty issuer text, which would otherwise fall back to
  // "unset" via deriveIssuerMode).
  const [mode, setMode] = useState<IssuerMode>(() => deriveIssuerMode(value));

  // Whenever the parent reassigns this credential (e.g. after reorder) keep
  // local state in sync — but don't clobber a sticky "other" mode if the
  // user picked it before typing.
  useEffect(() => {
    setMode((current) => {
      const derived = deriveIssuerMode(value);
      // A "sticky" Other selection (no key yet, mode already other) wins so
      // the dropdown doesn't snap back to "Choose issuer…" while typing.
      if (current === "other" && !value.issuerKey) return "other";
      return derived;
    });
  }, [value]);

  const resolvedIssuerKey = resolveCredentialIssuerKey({
    issuerKey: value.issuerKey,
    issuer: value.issuer,
  });
  const meta = resolvedIssuerKey ? ISSUER_BY_KEY[resolvedIssuerKey] : undefined;

  return (
    <li className="space-y-3 rounded-xl bg-black/20 p-3 ring-1 ring-white/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {meta ? (
            <IssuerLogo issuer={meta} size={16} />
          ) : (
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-white/30"
            />
          )}
          <p className="truncate font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">
            Credential {index + 1}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ReorderControls index={index} total={total} onMove={onMove} />
          <RemoveButton onClick={onRemove} />
        </div>
      </div>

      <Field label="Title">
        <TextInput
          value={value.title}
          onChange={(v) => onChange({ ...value, title: v })}
          maxLength={140}
          placeholder="Microsoft Certified: Azure AI Engineer Associate"
        />
      </Field>

      <Field label="Issuer">
        <IssuerCombobox
          mode={mode}
          selectedKey={value.issuerKey ?? ""}
          freeformText={value.issuer}
          onPickKnown={(key, label) => {
            setMode("known");
            onChange({ ...value, issuerKey: key, issuer: label });
          }}
          onPickOther={() => {
            setMode("other");
            // Clear the bound issuerKey; keep whatever the user already typed
            // as the freeform issuer label.
            onChange({ ...value, issuerKey: undefined });
          }}
          onClear={() => {
            setMode("unset");
            onChange({ ...value, issuerKey: undefined, issuer: "" });
          }}
        />
        {mode === "other" && (
          <input
            value={value.issuer}
            onChange={(e) => onChange({ ...value, issuer: e.target.value })}
            maxLength={80}
            placeholder="Issuer name (e.g. Acme Institute)"
            autoFocus
            className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 text-[13.5px] outline-none placeholder:text-white/25 focus:border-indigo-400/40"
          />
        )}
      </Field>

      <Row>
        <Field label="Credential ID" hint="Optional">
          <TextInput
            value={value.credentialId ?? ""}
            onChange={(v) => onChange({ ...value, credentialId: v })}
            maxLength={80}
            placeholder="FA88A4F6EA27B4CD"
          />
        </Field>
        <Field label="Verify URL" hint="Optional">
          <TextInput
            value={value.url ?? ""}
            onChange={(v) => onChange({ ...value, url: v })}
            inputType="url"
            placeholder="https://learn.microsoft.com/…"
          />
        </Field>
      </Row>

      <Field label="Skills" hint="Comma separated, max 15">
        <CommaListInput
          value={value.skills ?? []}
          onChange={(skills) => {
            onChange({
              ...value,
              skills: skills.length ? skills : undefined,
            });
          }}
          maxItems={15}
          placeholder="Azure AI, Cognitive Services, Python"
        />
      </Field>
    </li>
  );
}

/** Renders a local issuer logo asset from the credential logo manifest. */
function IssuerLogo({
  issuer,
  size = 18,
}: {
  issuer: IssuerMeta;
  size?: number;
}) {
  const imageSize =
    issuer.mark === "wide"
      ? { width: Math.round(size * 0.95), height: Math.round(size * 0.62) }
      : issuer.mark === "tall"
        ? { width: Math.round(size * 0.62), height: Math.round(size * 0.95) }
        : { width: Math.round(size * 0.74), height: Math.round(size * 0.74) };

  return (
    <span
      aria-hidden
      data-logo-kind={issuer.logoKind}
      data-tile={issuer.tile}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-white/[0.04] ring-1 ring-white/[0.06] data-[tile=light]:bg-white data-[tile=light]:ring-white/60"
      style={{ width: size, height: size }}
    >
      <Image
        src={issuer.src}
        alt=""
        width={imageSize.width}
        height={imageSize.height}
        unoptimized
        className="object-contain"
      />
    </span>
  );
}

/**
 * IssuerCombobox — searchable dropdown of known issuers.
 *
 * • Default state shows "Choose issuer…" — no implicit "Other" selection.
 * • Each row renders the issuer's local logo asset or explicit generic fallback.
 * • A divider + "Other (custom issuer)" row at the bottom switches the
 *   parent into freeform-text mode; the text input is rendered by the
 *   caller right below this control.
 * • A small ✕ on the trigger lets the user clear the picked issuer.
 */
function IssuerCombobox({
  mode,
  selectedKey,
  freeformText,
  onPickKnown,
  onPickOther,
  onClear,
}: {
  mode: IssuerMode;
  selectedKey: string;
  freeformText: string;
  onPickKnown: (key: string, label: string) => void;
  onPickOther: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedSlug = resolveCredentialIssuerKey({ issuerKey: selectedKey });
  const selected = selectedSlug ? ISSUER_BY_KEY[selectedSlug] : undefined;

  // Display logic for the trigger.
  let triggerLabel: string;
  let triggerLogo: React.ReactNode;
  let labelTone = "text-white/85";
  if (mode === "known" && selected) {
    triggerLabel = selected.label;
    triggerLogo = <IssuerLogo issuer={selected} size={18} />;
  } else if (mode === "other") {
    triggerLabel = freeformText.trim() || "Other…";
    triggerLogo = (
      <span
        aria-hidden
        className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-dashed border-white/25 text-[10px] text-white/55"
      >
        +
      </span>
    );
  } else {
    triggerLabel = "Choose issuer…";
    labelTone = "text-white/40";
    triggerLogo = (
      <span
        aria-hidden
        className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-white/[0.03] text-[10px] text-white/30 ring-1 ring-white/[0.05]"
      >
        ?
      </span>
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ISSUERS;
    return ISSUERS.filter((i) => i.label.toLowerCase().includes(q));
  }, [query]);

  // Outside-click + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset the search query whenever the menu reopens, so the next time the
  // user opens it they see the full list instead of the last filter.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 text-left text-[13.5px] transition outline-none hover:border-white/15 focus:border-indigo-400/40"
      >
        {triggerLogo}
        <span className={`min-w-0 flex-1 truncate ${labelTone}`}>
          {triggerLabel}
        </span>
        {mode !== "unset" && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear issuer"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClear();
                setOpen(false);
              }
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-[12px] text-white/40 transition hover:bg-white/[0.06] hover:text-white"
          >
            ×
          </span>
        )}
        <span
          aria-hidden
          className={`text-[10px] text-white/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#0e1014]/95 shadow-2xl backdrop-blur-xl"
        >
          <div className="p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search issuers…"
              className="h-8 w-full rounded-md border border-white/10 bg-black/40 px-2 text-[12.5px] outline-none placeholder:text-white/30 focus:border-indigo-400/40"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto pb-1">
            {filtered.map((i) => (
              <li key={i.key}>
                <button
                  type="button"
                  onClick={() => {
                    onPickKnown(i.key, i.label);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] transition hover:bg-white/[0.06] ${
                    selectedKey === i.key
                      ? "bg-white/[0.05] text-white"
                      : "text-white/80"
                  }`}
                >
                  <IssuerLogo issuer={i} size={20} />
                  <span className="truncate">{i.label}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-white/40">
                No matches.
              </li>
            )}
            <li className="mt-1 border-t border-white/[0.05]">
              <button
                type="button"
                onClick={() => {
                  onPickOther();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] transition hover:bg-white/[0.06] ${
                  mode === "other"
                    ? "text-white"
                    : "text-white/55 hover:text-white"
                }`}
              >
                <span
                  aria-hidden
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-dashed border-white/25 text-[11px] text-white/55"
                >
                  +
                </span>
                Other (custom issuer)
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Layout primitives
// ───────────────────────────────────────────────────────────────────────────

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px] font-medium tracking-tight text-white">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] text-white/40">{subtitle}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] tracking-wide text-white/55">
        <span>{label}</span>
        {hint && <span className="text-white/30">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function CommaListInput({
  value,
  onChange,
  placeholder,
  maxItems,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  maxItems?: number;
}) {
  const [raw, setRaw] = useState(() => value.join(", "));

  useEffect(() => {
    if (!sameStringList(parseCommaList(raw, maxItems), value)) {
      setRaw(value.join(", "));
    }
  }, [maxItems, raw, value]);

  return (
    <TextInput
      value={raw}
      onChange={(nextRaw) => {
        setRaw(nextRaw);
        onChange(parseCommaList(nextRaw, maxItems));
      }}
      placeholder={placeholder}
    />
  );
}

function TextInput({
  value,
  onChange,
  maxLength,
  placeholder,
  disabled,
  inputType = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  inputType?: "text" | "email" | "url";
}) {
  return (
    <input
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      disabled={disabled}
      spellCheck={inputType === "text"}
      autoCapitalize="off"
      autoCorrect="off"
      className="h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 text-[13.5px] outline-none placeholder:text-white/25 focus:border-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function parseCommaList(value: string, maxItems?: number): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function friendlyValidationMessage(issue: ZodIssue | undefined): string {
  if (!issue) return "Please check the highlighted details and try again.";

  const path = issue.path;
  const field = friendlyPath(path);
  const message =
    issue.code === "invalid_string" && issue.validation === "url"
      ? "Enter a valid URL, or leave it blank."
      : issue.code === "invalid_string" && issue.validation === "email"
        ? "Enter a valid email address, or leave it blank."
        : issue.message;

  return field ? `${field}: ${message}` : message;
}

function friendlyPath(path: Array<string | number>): string {
  if (path[0] === "projects" && typeof path[1] === "number") {
    const field = {
      name: "name",
      blurb: "blurb",
      tech: "tech",
      demoUrl: "demo URL",
      repoUrl: "repo URL",
    }[String(path[2])];
    return `Project ${path[1] + 1}${field ? ` ${field}` : ""}`;
  }

  if (path[0] === "identity" && path[1] === "links") {
    const field = {
      site: "Website",
      x: "X / Twitter URL",
      linkedin: "LinkedIn URL",
      email: "Public email",
    }[String(path[2])];
    if (field) return field;
  }

  if (path[0] === "credentials" && typeof path[1] === "number") {
    const field = {
      title: "title",
      issuer: "issuer",
      url: "verify URL",
      skills: "skills",
    }[String(path[2])];
    return `Credential ${path[1] + 1}${field ? ` ${field}` : ""}`;
  }

  return "";
}

function TextArea({
  value,
  onChange,
  maxLength,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      rows={rows}
      className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[13.5px] leading-relaxed outline-none placeholder:text-white/25 focus:border-indigo-400/40"
    />
  );
}

function ReorderControls({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className="flex h-4 w-7 items-center justify-center rounded text-[9px] text-white/45 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        ▲
      </button>
      <button
        type="button"
        aria-label="Move down"
        disabled={index >= total - 1}
        onClick={() => onMove(1)}
        className="flex h-4 w-7 items-center justify-center rounded text-[9px] text-white/45 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        ▼
      </button>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Remove"
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-red-500/10 hover:text-red-200"
    >
      ×
    </button>
  );
}

function AddButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-3 inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12px] text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 ${
        dark
          ? "border-black/30 border-t-black"
          : "border-white/30 border-t-white"
      }`}
    />
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 3l8 8M11 3l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function move<T>(arr: T[], from: number, dir: -1 | 1): T[] {
  const to = from + dir;
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  if (item === undefined) return arr;
  next.splice(to, 0, item);
  return next;
}
