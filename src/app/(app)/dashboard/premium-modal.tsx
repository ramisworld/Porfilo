"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { PremiumOffer } from "./premium-offer";
import styles from "./domain-modal.module.css";

export function PremiumModal({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  onUnlocked: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-modal-title"
      className={styles.overlay}
    >
      <button
        type="button"
        aria-label="Close Premium offer"
        onClick={onClose}
        className={styles.scrim}
      />
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.index} aria-hidden>
            PR/01
          </div>
          <div className={styles.headCopy}>
            <p className={styles.eyebrow}>One payment · lifetime access</p>
            <h2 id="premium-modal-title" className={styles.title}>
              Porfilo Premium
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={styles.close}
          >
            <CloseIcon />
          </button>
        </header>
        <div className={styles.content}>
          <PremiumOffer
            intent="regenerate"
            onClose={onClose}
            onUnlocked={onUnlocked}
          />
        </div>
      </div>
    </div>,
    document.body,
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
