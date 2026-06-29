import { porfiloMarkSvgString } from "./porfilo-mark-string";

export { PORFILO_FAVICON_ID, porfiloMarkSvgString } from "./porfilo-mark-string";

export function PorfiloMarkSvg({
  size = 32,
  idPrefix = "porfilo-mark",
  className = "",
}: {
  size?: number;
  idPrefix?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 leading-none ${className}`.trim()}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{
        __html: porfiloMarkSvgString(idPrefix, size),
      }}
    />
  );
}
