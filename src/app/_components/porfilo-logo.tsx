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
  textClassName = "text-[12px] font-black tracking-[-0.05em] text-white uppercase",
}: {
  size?: number;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <PorfiloLogoMark size={size} />
      <span className={textClassName}>PORFILO</span>
    </span>
  );
}
