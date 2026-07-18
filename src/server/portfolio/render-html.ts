import "server-only";
import { renderPortfolioPage } from "~/engine/render";
import { DEFAULT_SPEC, designSpecSchema } from "~/engine/spec";
import { ENGINE_VERSION } from "~/engine/version";
import { profileDataSchema } from "~/server/profile/model";
import { renderStoredWorld } from "~/server/worlds/render";

export type RenderablePortfolio = {
  designSpec: unknown;
  profileData: unknown;
  engineVersion: string | null;
  code: string | null;
  template: string;
  githubUsername: string;
};

export function buildPortfolioHtml(
  portfolio: RenderablePortfolio,
): string | null {
  const parsedProfile = profileDataSchema.safeParse(portfolio.profileData);
  let html = parsedProfile.success ? renderStoredWorld(portfolio) : null;
  if (!html && parsedProfile.success && portfolio.designSpec) {
    const parsed = designSpecSchema.safeParse(portfolio.designSpec);
    const spec = parsed.success ? parsed.data : DEFAULT_SPEC;
    const version = portfolio.engineVersion ?? ENGINE_VERSION;
    html = renderPortfolioPage(spec, parsedProfile.data, version);
  } else if (!html && portfolio.code) {
    html = portfolio.code;
  }
  return html;
}
