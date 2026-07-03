"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileData } from "~/server/profile/model";
import { PorfiloButton, PorfiloButtonLink } from "~/app/_components/porfilo-button";
import { Arrow, ExternalArrow, Spinner } from "~/app/_components/icons";
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
  const [profileData, setProfileData] = useState<ProfileData>(props.profileData);

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
    <div className="flex h-full w-full flex-col gap-4 py-3 md:gap-5 md:py-4">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex flex-none flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.025] px-2.5 py-0.5 text-[9.5px] font-medium tracking-[0.18em] text-muted uppercase backdrop-blur-md">
            <span className="h-1 w-1 rounded-full bg-warn shadow-[0_0_8px_#fbbf24]" />
            Beta · 1 per account
          </div>
          <h1 className="text-balance text-2xl font-medium leading-[1.05] tracking-tight md:text-3xl">
            <span className="text-fg">Your portfolio,</span>{" "}
            <span className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">
              live.
            </span>
          </h1>
          <p className="mt-1 text-[11.5px] text-muted-3">
            <span className="font-mono text-muted-2">
              @{props.githubUsername}
            </span>
            {" · "}
            {created}
            {" · "}
            {props.views} view{props.views === 1 ? "" : "s"}
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

      {/* ── Preview ───────────────────────────────────────────────────── */}
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
      className="relative flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-black/40 backdrop-blur-xl shadow-glass"
      style={{ minHeight: "280px" }}
    >
      {/* Browser chrome */}
      <div className="relative flex flex-none items-center gap-3 border-b border-border-subtle bg-black/40 px-4 py-2.5">
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
            className="!h-7 !w-7 !p-0 !text-[12px]"
          >
            ↻
          </PorfiloButton>
          <PorfiloButtonLink
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            variant="ghost"
            aria-label="Open in new tab"
            className="!h-7 !w-7 !p-0 !text-[12px]"
          >
            ↗
          </PorfiloButtonLink>
        </div>
      </div>

      {/* Viewport */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated">
            <div className="flex items-center gap-2 text-[12px] text-muted-2">
              <Spinner tone="onDark" />
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
          className={`absolute inset-0 h-full w-full bg-bg-elevated transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </div>
  );
}
