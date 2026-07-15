import Link from "next/link";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import styles from "./auth.module.css";

export function AuthShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.shell}>
      <div className={styles.grid} aria-hidden />
      <nav>
        <Link href="/" aria-label="Porfilo home">
          <PorfiloWordmark
            size={22}
            textClassName="text-[0.95rem] font-semibold tracking-[-0.01em] text-white"
          />
        </Link>
        <span>{label}</span>
      </nav>
      <div className={styles.layout}>
        <aside className={styles.proof} aria-hidden>
          <div className={styles.proofCopy}>
            <span>Proof of work / 01</span>
            <h2>Your work is already the credential.</h2>
            <p>One account keeps the portfolio, the facts, and the public URL under your control.</p>
          </div>
          <div className={styles.proofWall}>
            <i className={styles.proofOne} />
            <i className={styles.proofTwo} />
            <i className={styles.proofThree} />
          </div>
          <footer><span>Real repositories</span><span>Editable facts</span><span>Your domain</span></footer>
        </aside>
        <section className={styles.access}>{children}</section>
      </div>
    </main>
  );
}
