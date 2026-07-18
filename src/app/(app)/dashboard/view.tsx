"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileData } from "~/server/profile/model";
import { EditModal } from "./edit-modal";
import { DomainTile } from "./domain-tile";
import { PremiumModal } from "./premium-modal";
import { RegenerationModal } from "./regeneration-modal";
import { api } from "~/trpc/react";
import styles from "./dashboard.module.css";

export function DashboardView(props: {
  id: string;
  slug: string;
  githubUsername: string;
  vibe: string;
  isPublic: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
  publicUrl: string;
  embedUrl: string;
  profileData: ProfileData;
}) {
  const router = useRouter();
  const premium = api.billing.premiumAccess.useQuery();

  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [regenerationOpen, setRegenerationOpen] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>(
    props.profileData,
  );

  useEffect(() => {
    if (!editorOpen) setProfileData(props.profileData);
  }, [props.profileData, editorOpen]);

  useEffect(() => {
    const openRegeneration = () => {
      setPremiumOpen(false);
      setRegenerationOpen(true);
    };
    window.addEventListener("porfilo:premium-unlocked", openRegeneration);
    return () =>
      window.removeEventListener("porfilo:premium-unlocked", openRegeneration);
  }, []);

  const created = (() => {
    const d = new Date(props.createdAt);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
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

  const updated = new Date(props.updatedAt).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
  });
  const experienceCount = profileData.experience?.length ?? 0;
  const credentialCount = profileData.credentials?.length ?? 0;
  const buildId = props.id.slice(-6).toUpperCase();

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerIndex} aria-hidden>
          <span>Control room</span>
          <strong>DB/01</strong>
        </div>
        <div className={styles.heading}>
          <span className={styles.kicker}>
            <i /> Portfolio online
          </span>
          <h1>Your work, live.</h1>
          <p className={styles.meta}>
            <b>@{props.githubUsername}</b> / created {created} / updated{" "}
            {updated}
          </p>
        </div>
        <div className={styles.headerStatus}>
          <span>System status</span>
          <strong>
            <i /> Operational
          </strong>
          <small>BUILD {buildId}</small>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.rail}>
          <div className={styles.railIntro}>
            <span className={styles.railLabel}>01 / Current portfolio</span>
            <strong>{props.slug}</strong>
            <p>@{props.githubUsername}</p>
            <span
              className={styles.status}
              data-public={props.isPublic ? "true" : "false"}
            >
              <i /> {props.isPublic ? "Public / live" : "Private / draft"}
            </span>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span>Views</span>
              <b>{props.views.toLocaleString("en-NZ")}</b>
              <small>All time</small>
            </div>
            <div className={styles.stat}>
              <span>Projects</span>
              <b>{String(profileData.projects.length).padStart(2, "0")}</b>
              <small>09 max</small>
            </div>
            <div className={styles.stat}>
              <span>Experience</span>
              <b>{String(experienceCount).padStart(2, "0")}</b>
              <small>Entries</small>
            </div>
            <div className={styles.stat}>
              <span>Credentials</span>
              <b>{String(credentialCount).padStart(2, "0")}</b>
              <small>Verified proof</small>
            </div>
          </div>
          <div className={styles.direction}>
            <span>02 / Creative direction</span>
            <p>{props.vibe}</p>
          </div>
          <div className={styles.domain}>
            <span className={styles.railLabel}>03 / Published at</span>
            <a href={props.publicUrl} target="_blank" rel="noreferrer">
              {previewLabel} <span>↗</span>
            </a>
          </div>
        </aside>

        <PreviewFrame
          src={iframeSrc}
          loaded={previewLoaded}
          onLoad={() => setPreviewLoaded(true)}
          onReload={refreshPreview}
          publicUrl={previewLabel}
          openUrl={props.publicUrl}
        />

        <aside className={styles.operations}>
          <div className={styles.operationsHead}>
            <span>Operations / 04</span>
            <strong>Make it move.</strong>
            <p>Update the proof, inspect the live build, or claim your URL.</p>
          </div>

          <div className={styles.operationList}>
            <button
              type="button"
              className={`${styles.operation} ${styles.operationPrimary}`}
              onClick={() => setEditorOpen(true)}
            >
              <span className={styles.operationNumber}>01</span>
              <span>
                <b>Edit portfolio</b>
                <small>Content, projects, experience</small>
              </span>
              <i aria-hidden>→</i>
            </button>

            <button
              type="button"
              className={styles.operation}
              disabled={premium.isLoading}
              onClick={() => {
                if (premium.data?.unlocked) setRegenerationOpen(true);
                else setPremiumOpen(true);
              }}
            >
              <span className={styles.operationNumber}>02</span>
              <span>
                <b>Regenerate portfolio</b>
                <small>New GitHub, new vibe, same URL</small>
              </span>
              <i aria-hidden>{premium.data?.unlocked ? "↻" : "◆"}</i>
            </button>

            <a
              href={props.publicUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.operation}
            >
              <span className={styles.operationNumber}>03</span>
              <span>
                <b>Open live site</b>
                <small>View the public build</small>
              </span>
              <i aria-hidden>↗</i>
            </a>

            <div className={styles.domainOperation}>
              <span className={styles.operationNumber}>04</span>
              <div>
                <b>Publishing URL</b>
                <small>Free subdomain or your own</small>
              </div>
              <DomainTile />
            </div>
          </div>

          <div className={styles.releaseNote}>
            <span>Release channel</span>
            <strong>LIVE / PRODUCTION</strong>
            <p>Saved edits publish directly to the portfolio above.</p>
          </div>
        </aside>
      </div>

      {editorOpen && (
        <EditModal
          initial={profileData}
          githubUsername={props.githubUsername}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
        />
      )}
      {premiumOpen && (
        <PremiumModal
          onClose={() => setPremiumOpen(false)}
          onUnlocked={() => {
            setPremiumOpen(false);
            setRegenerationOpen(true);
          }}
        />
      )}
      {regenerationOpen && (
        <RegenerationModal
          initialUsername={props.githubUsername}
          initialVibe={props.vibe}
          onClose={() => setRegenerationOpen(false)}
          onDone={refreshPreview}
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
    <div className={styles.preview}>
      <div className={styles.browserBar}>
        <span className={styles.previewTag}>Live viewport / 01</span>
        <span className={styles.browserUrl}>{publicUrl}</span>
        <div className={styles.browserActions}>
          <button type="button" aria-label="Reload preview" onClick={onReload}>
            ↻
          </button>
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in new tab"
          >
            ↗
          </a>
        </div>
      </div>

      <div className={styles.viewport}>
        {!loaded && (
          <div className={styles.previewLoading}>
            <div>
              <b>LIVE</b>
              <p>Rendering your proof.</p>
              <i />
              <span>Compiling portfolio viewport</span>
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
          data-loaded={loaded ? "true" : "false"}
        />
      </div>
    </div>
  );
}
