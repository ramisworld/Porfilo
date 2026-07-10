import { porfiloIconResponse, ICON_SIZE } from "~/lib/brand-icons";

export const size = ICON_SIZE;
export const contentType = "image/png";

export default function Icon() {
  return porfiloIconResponse(ICON_SIZE.width);
}
