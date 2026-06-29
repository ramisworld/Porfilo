"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileData } from "~/server/profile/model";
import { PorfiloButton, PorfiloButtonLink } from "~/app/_components/porfilo-button";
import { EditModal } from "./edit-modal";
import { DomainTile } from "./domain-tile";

export function DashboardView(props: {
  id: string;
  slug: string;
  githubUsername: string;
  isPublic: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
  publicUrl: string;
  embedUrl: string;
  profileData: ProfileData;
}) {
  const router = useRouter();

  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>(
    props.profileData,
  );

  useEffect(() => {
    if (!editorOpen) setProfileData(props.profileData);
  }, [props.profileData, editorOpen]);

  const created = (() => {
    const d = new Date(props.createdAt);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  })();

  const iframeSrc = `${props.embedUrl}?v=${reloadKey}`;
  const previewLabel = props.publicUrl.replace(/^https?:\/\//, "");

  const refreshPreview = () => {
    setPreviewLoaded(false);
    setReloadKey((k) => k + 1);
    router.refresh();
  };

  const handleSaved = (saved: ProfileData) => {
    setProfileData(saved);
    refreshPreview();
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-3 py-3 md:gap-4 md:py-4">
      <header className="flex flex-none flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-0.5 text-[9.5px] font-medium tracking-[0.18em] text-white/55 uppercase backdrop-blur-md">
            <span className="h-1 w-1 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
            Beta · 1 per account
          </div>
          <h1 className="text-balance text-2xl font-medium leading-[1.05] tracking-tight md:text-3xl">
            <span className="text-white">Your portfolio,</span>{" "}
            <span className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">
              live.
            </span>
          </h1>
          <p className="mt-0.5 text-[11.5px] text-white/40">
            <span className="font-mono text-white/65">
              @{props.githubUsername}
            </span>{" "}
            · {created} · {props.views} view{props.views === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DomainTile />
          <PorfiloButtonLink
            href={props.publicUrl}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
          >
            Preview
            <ExternalArrow />
          </PorfiloButtonLink>
          <PorfiloButton type="button" onClick={() => setEditorOpen(true)}>
            Edit
            <Arrow />
          </PorfiloButton>
        </div>
      </header>

      <PreviewFrame
        src={iframeSrc}
        loaded={previewLoaded}
        onLoad={() => setPreviewLoaded(true)}
        onReload={refreshPreview}
        publicUrl={previewLabel}
        openUrl={props.publicUrl}
      />

      {editorOpen && (
        <EditModal
          initial={profileData}
          githubUsername={props.githubUsername}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function PreviewFrame({
  src,
  loaded,
  onLoad,
  onReload,
  publicUrl,
  openUrl,
}: {
  src: string;
  loaded: boolean;
  onLoad: () => void;
  onReload: () => void;
  publicUrl: string;
  openUrl: string;
}) {
  return (
    <div
      className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-xl"
      style={{
        aspectRatio: "16 / 9",
        maxHeight: "min(72vh, 820px)",
        minHeight: "280px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 60px -20px rgba(0,0,0,0.65)",
      }}
    >
      <div className="relative flex flex-none items-center gap-3 border-b border-white/[0.06] bg-black/40 px-4 py-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        </span>
        <span className="flex-1 truncate text-center font-mono text-[11px] text-white/45">
          {publicUrl}
        </span>
        <div className="flex items-center gap-1">
          <PorfiloButton
            type="button"
            variant="ghost"
            aria-label="Reload preview"
            onClick={onReload}
            className="!h-7 !w-7 !p-0 !text-[11px]"
          >
            ↻
          </PorfiloButton>
          <PorfiloButtonLink
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            variant="ghost"
            aria-label="Open in new tab"
            className="!h-7 !w-7 !p-0 !text-[11px]"
          >
            ↗
          </PorfiloButtonLink>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#05060a]">
            <div className="flex items-center gap-2 text-[12px] text-white/45">
              <Spinner />
              Rendering preview…
            </div>
          </div>
        )}
        <iframe
          key={src}
          src={src}
          title="Portfolio preview"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            try {
              e.currentTarget.contentWindow?.scrollTo(0, 0);
            } catch {
              /* noop */
            }
            onLoad();
          }}
          className={`absolute inset-0 h-full w-full bg-[#05060a] transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 7h9m0 0L7 3m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalArrow() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M5 3h6v6M11 3L4 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-white/70"
    />
  );
}
