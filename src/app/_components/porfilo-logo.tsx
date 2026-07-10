import { PorfiloMarkSvg } from "~/lib/porfilo-mark";

export function PorfiloLogoMark({
  size = 18,
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
  size = 18,
  className = "",
  textClassName = "text-[11px] font-medium tracking-[0.18em] text-white/55 uppercase",
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
