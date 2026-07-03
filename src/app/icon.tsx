import { portHubIconResponse, ICON_SIZE } from "~/lib/brand-icons";

export const size = ICON_SIZE;
export const contentType = "image/png";

export default function Icon() {
  return portHubIconResponse(ICON_SIZE.width);
}
