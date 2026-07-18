"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import {
  displayStatusHint,
  isPendingDisplayStatus,
} from "~/server/domains/types";
import { DOMAIN_REFRESH_INTERVAL_MS } from "~/server/domains/row-state";
import type { DomainWithInstructions } from "~/server/api/routers/domain";
import { useToast } from "~/app/_components/toast";
import { DomainModal } from "./domain-modal";
import styles from "./domain-tile.module.css";

/** Poll slightly after the server refresh interval so each tick can persist. */
const PENDING_POLL_MS = DOMAIN_REFRESH_INTERVAL_MS + 1_000;

export function DomainTile() {
  const utils = api.useUtils();
  const { toast } = useToast();
  const mine = api.domain.mine.useQuery(undefined, {
    refetchInterval: (query) => {
      const row = query.state.data;
      if (row?.type !== "custom_domain") return false;
      if (!isPendingDisplayStatus(row.displayStatus)) return false;
      return PENDING_POLL_MS;
    },
  });
  const [open, setOpen] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState(false);
  const confirmCheckout = api.billing.confirmPremiumCheckout.useMutation({
    onSuccess: async ({ unlocked }) => {
      await utils.billing.premiumAccess.invalidate();
      const intent = window.sessionStorage.getItem("porfilo:premium-intent");
      if (unlocked && intent === "regenerate") {
        window.sessionStorage.removeItem("porfilo:premium-intent");
        setPendingUnlock(false);
        setOpen(false);
        window.setTimeout(
          () =>
            window.dispatchEvent(new CustomEvent("porfilo:premium-unlocked")),
          0,
        );
        toast("Porfilo Premium unlocked.");
        return;
      }
      if (!unlocked) {
        setPendingUnlock(false);
        toast("We couldn't verify that payment. No access was granted.");
      }
    },
    onError: () => {
      setPendingUnlock(false);
      toast(
        "Payment verification is delayed. Your card won't be charged twice.",
      );
    },
  });

  // Handle the return from Stripe Checkout. On success we reopen the modal in
  // its "unlocking" state and poll access until the webhook lands; on cancel we
  // land safely on the dashboard, still locked, with a calm toast. The query is
  // stripped so a refresh can't replay it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");
    if (!checkout) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState(null, "", url.toString());

    if (checkout === "success") {
      if (!sessionId) {
        toast("Payment could not be verified.");
        return;
      }
      const intent = window.sessionStorage.getItem("porfilo:premium-intent");
      setPendingUnlock(true);
      setOpen(intent !== "regenerate");
      confirmCheckout.mutate({ sessionId });
    } else if (checkout === "cancelled") {
      window.sessionStorage.removeItem("porfilo:premium-intent");
      toast("Checkout cancelled — no charge.");
    }
    // Mutation + toast references are stable; process this URL only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const row = mine.data;

  return (
    <>
      {!row ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={styles.trigger}
        >
          <span className={styles.icon} aria-hidden>
            <PlusIcon />
          </span>
          <span className={styles.copy}>
            <strong>Add custom domain</strong>
            <small>Free subdomain or yours</small>
          </span>
          <ChevronIcon />
        </button>
      ) : (
        <DomainStatusButton row={row} onClick={() => setOpen(true)} />
      )}

      {open && (
        <DomainModal
          pendingUnlock={pendingUnlock}
          onClose={() => {
            setOpen(false);
            setPendingUnlock(false);
          }}
        />
      )}
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

  let tone = "pending";

  if (
    row.displayStatus === "FREE_SUBDOMAIN_ACTIVE" ||
    row.displayStatus === "CUSTOM_DOMAIN_ACTIVE"
  ) {
    tone = "live";
  } else if (row.displayStatus === "CUSTOM_DOMAIN_FAILED") {
    tone = "warning";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.statusTrigger}
      data-tone={tone}
    >
      <span className={styles.dot} aria-hidden />
      <span className={styles.copy}>
        <strong>{label}</strong>
        <small>{hint}</small>
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
      className={styles.chevron}
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
