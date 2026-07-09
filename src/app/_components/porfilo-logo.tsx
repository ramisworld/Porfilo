import { PorfiloMarkSvg } from "~/lib/porfilo-mark";

export function PorfiloLogoMark({
  size = 24,
  className = "",
  markId = "porfilo-mark",
}: {
  size?: number;
  className?: string;
  /** Unique per page when multiple marks render (SVG gradient ids are document-global). */
  markId?: string;
}) {
  return (
    <PorfiloMarkSvg
      size={size}
      idPrefix={markId}
      className={`shrink-0 ${className}`.trim()}
    />
  );
}

export function PorfiloWordmark({
  size = 24,
  className = "",
  textClassName = "bg-gradient-to-b from-white to-white/75 bg-clip-text text-[17px] font-semibold tracking-[-0.015em] text-transparent",
}: {
  size?: number;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <PorfiloLogoMark size={size} />
      <span className={textClassName}>Porfilo</span>
    </span>
  );
}
