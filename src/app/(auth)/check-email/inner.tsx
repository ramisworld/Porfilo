"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../auth.module.css";

export function CheckEmailInner() {
  const email = useSearchParams().get("email") ?? "";

  return (
    <div className={styles.accessInner}>
      <div className={styles.mailIcon}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 7l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <span className={styles.kicker}>Magic link sent / 02</span>
      <h1>Check your email.</h1>
      <p className={styles.lede}>
        We sent a sign-in link to{" "}
        <span>{email || "your inbox"}</span>. Click it to
        finish signing in.
      </p>

      <div className={styles.mailNote}>
        <strong>Didn&apos;t get it?</strong>
        <ul>
          <li>Check spam or promotions.</li>
          <li>The link expires after 10 minutes.</li>
          <li>You can request another from the sign-in page.</li>
        </ul>
      </div>

      <Link
        href="/sign-in"
        className={styles.backLink}
      >
        ← Use a different email
      </Link>
    </div>
  );
}
