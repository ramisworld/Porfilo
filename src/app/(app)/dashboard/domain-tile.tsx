"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { displayStatusHint, isPendingDisplayStatus } from "~/server/domains/types";
import { DOMAIN_REFRESH_INTERVAL_MS } from "~/server/domains/row-state";
import type { DomainWithInstructions } from "~/server/api/routers/domain";
import { DomainModal } from "./domain-modal";

/** Poll slightly after the server refresh interval so each tick can persist. */
const PENDING_POLL_MS = DOMAIN_REFRESH_INTERVAL_MS + 1_000;

export function DomainTile() {
  const mine = api.domain.mine.useQuery(undefined, {
    refetchInterval: (query) => {
      const row = query.state.data;
      if (row?.type !== "custom_domain") return false;
      if (!isPendingDisplayStatus(row.displayStatus)) return false;
      return PENDING_POLL_MS;
    },
  });
  const [open, setOpen] = useState(false);

  const row = mine.data;

  return (
    <>
      {!row ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative inline-flex h-10 items-center gap-2.5 overflow-hidden rounded-[10px] border border-indigo-400/25 bg-gradient-to-b from-indigo-500/[0.14] to-indigo-950/[0.35] px-3.5 pl-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_0_1px_rgba(99,102,241,0.08)] backdrop-blur-md transition-[background,border-color,box-shadow,transform] duration-200 hover:border-indigo-300/35 hover:from-indigo-500/[0.22] hover:to-indigo-900/[0.4] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_24px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400/60"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(120px circle at 20% 0%, rgba(129,140,248,0.18), transparent 70%)",
            }}
          />
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.08] text-indigo-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition group-hover:border-white/15 group-hover:bg-white/[0.12] group-hover:text-white">
            <PlusIcon />
          </span>
          <span className="relative min-w-0 leading-tight">
            <span className="block text-[13px] font-medium tracking-tight text-white">
              Add custom domain
            </span>
            <span className="hidden text-[10.5px] text-indigo-200/55 sm:block">
              Free subdomain or yours
            </span>
          </span>
        </button>
      ) : (
        <DomainStatusButton row={row} onClick={() => setOpen(true)} />
      )}

      {open && <DomainModal onClose={() => setOpen(false)} />}
    </>
  );
}

function DomainStatusButton({
  row,
  onClick,
}: {
  row: DomainWithInstructions;
  onClick: () => void;
}) {
  const hint = displayStatusHint(row.displayStatus);
  const label = row.hostname;

  let dotClass = "bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-pulse";
  let ringClass = "border-white/[0.08] hover:border-white/[0.14]";

  if (
    row.displayStatus === "FREE_SUBDOMAIN_ACTIVE" ||
    row.displayStatus === "CUSTOM_DOMAIN_ACTIVE"
  ) {
    dotClass = "bg-emerald-400 shadow-[0_0_8px_#34d399]";
    ringClass = "border-emerald-400/20 hover:border-emerald-400/30";
  } else if (row.displayStatus === "CUSTOM_DOMAIN_FAILED") {
    dotClass = "bg-amber-400 shadow-[0_0_8px_#fbbf24]";
    ringClass = "border-amber-400/20 hover:border-amber-400/30";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-10 min-w-0 max-w-[240px] items-center gap-2.5 rounded-[10px] border bg-black/25 px-3 text-left backdrop-blur-md transition hover:bg-black/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400/60 ${ringClass}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-mono text-[11.5px] text-white">
          {label}
        </span>
        <span className="block truncate text-[10.5px] text-white/45">
          {hint}
        </span>
      </span>
      <ChevronIcon />
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M6 2.5v7M2.5 6h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden
      className="shrink-0 text-white/30 transition group-hover:text-white/55"
    >
      <path
        d="M3 2l4 3-4 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
