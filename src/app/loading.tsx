import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import styles from "./loading.module.css";

export default function Loading() {
  return (
    <main className={styles.screen} aria-label="Loading Porfilo">
      <div className={styles.grid} aria-hidden />
      <header>
        <PorfiloWordmark
          size={22}
          textClassName="text-[0.95rem] font-semibold tracking-[-0.01em] text-white"
        />
        <span>Preparing workspace</span>
      </header>
      <section>
        <span className={styles.index}>01</span>
        <div>
          <p>Assembling your proof room.</p>
          <i><b /></i>
          <small>Loading portfolio systems</small>
        </div>
      </section>
    </main>
  );
}
