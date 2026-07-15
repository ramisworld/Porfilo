import type { Metadata } from "next";
import { profileDataSchema, type ProfileData } from "~/server/profile/model";

/** Best display name — profile identity first, GitHub username as fallback. */
export function portfolioDisplayName(
  data: ProfileData | undefined,
  githubUsername: string,
): string {
  const n = data?.identity.name?.trim();
  return n?.length ? n : githubUsername;
}

export function buildPortfolioMetadata({
  profileData,
  githubUsername,
  isPublic,
  canonicalUrl,
  imageUrl = "/api/og",
}: {
  profileData: unknown;
  githubUsername: string;
  isPublic: boolean;
  canonicalUrl: string;
  imageUrl?: string;
}): Metadata {
  const parsed = profileDataSchema.safeParse(profileData);
  const data = parsed.success ? parsed.data : undefined;
  const name = portfolioDisplayName(data, githubUsername);
  const role = data?.identity.role?.trim() ?? "Developer";
  const headline = data?.identity.headline?.trim() ?? role;
  const title = `${name} — ${role}`;

  return {
    metadataBase: new URL(canonicalUrl),
    title,
    description: headline,
    icons: {
      icon: [{ url: "/icon", type: "image/png" }],
      apple: [{ url: "/apple-icon", type: "image/png" }],
    },
    openGraph: {
      title,
      description: headline,
      type: "profile",
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: headline,
      images: [imageUrl],
    },
    robots: isPublic ? undefined : { index: false, follow: false },
  };
}
