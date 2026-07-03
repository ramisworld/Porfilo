import { AuroraBackground } from "~/app/_components/aurora-background";
import { Spinner } from "~/app/_components/icons";

export default function Loading() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-bg text-fg antialiased">
      <AuroraBackground />
      <div className="relative z-10 flex items-center gap-2.5 text-[13px] text-muted">
        <Spinner tone="onDark" />
        Loading
      </div>
    </main>
  );
}
