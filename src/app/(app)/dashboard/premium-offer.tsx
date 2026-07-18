"use client";

import { useState, type ReactNode } from "react";
import { api } from "~/trpc/react";
import styles from "./domain-modal.module.css";

/** Shared $9 lifetime Premium offer used by domain and regeneration flows. */
export function PremiumOffer({
  onClose,
  intent,
  onUnlocked,
}: {
  onClose: () => void;
  intent: "domain" | "regenerate";
  onUnlocked?: () => void;
}) {
  const utils = api.useUtils();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = api.billing.createPremiumCheckoutSession.useMutation({
    onSuccess: async (res) => {
      if ("alreadyUnlocked" in res) {
        await utils.billing.premiumAccess.invalidate();
        window.sessionStorage.removeItem("porfilo:premium-intent");
        onUnlocked?.();
        return;
      }
      setRedirecting(true);
      window.location.assign(res.url);
    },
    onError: (checkoutError) => {
      window.sessionStorage.removeItem("porfilo:premium-intent");
      setError(checkoutError.message);
    },
  });

  const busy = checkout.isPending || redirecting;
  const cta = redirecting
    ? "Redirecting to Stripe…"
    : checkout.isPending
      ? "Creating secure checkout…"
      : "Get Porfilo Premium — $9 USD";

  return (
    <div className={styles.upgrade}>
      <div className={styles.upgradeHero}>
        <div>
          <p className={styles.upgradeKicker}>
            Porfilo Premium · lifetime access
          </p>
          <h3 className={styles.upgradeTitle}>Keep evolving the work.</h3>
          <p className={styles.upgradeLead}>
            Regenerate your portfolio whenever your direction changes and put
            every version on a domain that is unmistakably yours.
          </p>
        </div>
        <div className={styles.price} aria-label="Nine US dollars, paid once">
          <strong>$9</strong>
          <span>
            USD · paid once
            <br />
            No subscription
          </span>
        </div>
      </div>

      <div className={styles.urlProof} aria-label="Example portfolio evolution">
        <div className={styles.urlCell}>
          <small>Today</small>
          <code>Your current portfolio</code>
        </div>
        <div className={styles.urlArrow} aria-hidden>
          →
        </div>
        <div className={styles.urlCell}>
          <small>Whenever you want</small>
          <code>A new direction, same URL</code>
        </div>
      </div>

      <ul className={styles.valueGrid}>
        <FeatureRow index="01" title="Your own domain">
          Connect a root domain or subdomain you already own.
        </FeatureRow>
        <FeatureRow index="02" title="Regenerate your portfolio">
          Choose a new GitHub account or vibe without losing your live URL.
        </FeatureRow>
        <FeatureRow index="03" title="Pay once, keep access">
          No subscription and no second charge when you regenerate.
        </FeatureRow>
      </ul>

      {error && (
        <p role="alert" className={styles.error}>
          {error} Please try again.
        </p>
      )}

      <div className={styles.checkout}>
        <p className={styles.checkoutNote}>
          Stripe-hosted secure checkout
          <br />
          Instant access after payment
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            window.sessionStorage.setItem("porfilo:premium-intent", intent);
            checkout.mutate();
          }}
          disabled={busy}
          className={styles.cta}
        >
          {busy && <Spinner />}
          {cta}
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className={styles.later}
      >
        Not now
      </button>
    </div>
  );
}

function FeatureRow({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={styles.feature}>
      <span className={styles.featureIndex}>{index} / INCLUDED</span>
      <strong>{title}</strong>
      <p>{children}</p>
    </li>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
    />
  );
}
