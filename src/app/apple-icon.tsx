import { portHubIconResponse, APPLE_ICON_SIZE } from "~/lib/brand-icons";

export const size = APPLE_ICON_SIZE;
export const contentType = "image/png";

export default function AppleIcon() {
  return portHubIconResponse(APPLE_ICON_SIZE.width);
}
