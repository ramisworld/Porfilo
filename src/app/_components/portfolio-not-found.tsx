import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { appOrigin } from "~/lib/root-domain";

export function PortfolioNotFound({ host }: { host: string }) {
  const home = appOrigin();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#05060a] px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative max-w-md">
        <div className="flex justify-center">
          <PorfiloWordmark size={22} textClassName="text-[11px] font-medium tracking-[0.18em] text-indigo-200/70 uppercase" />
        </div>
        <h1 className="mt-3 text-2xl font-medium tracking-tight text-white">
          Portfolio not found
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/50">
          We couldn&apos;t find a portfolio at{" "}
          <span className="font-mono text-white/75">{host}</span>. It may have
          been removed or the URL might be incorrect.
        </p>
        <a
          href={home}
          className="porfilo-btn porfilo-btn-primary mt-8 inline-flex h-10 items-center px-5 text-[13px]"
        >
          Go to Porfilo
        </a>
      </div>
    </div>
  );
}
