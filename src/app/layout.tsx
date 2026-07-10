import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { ToastProvider } from "~/app/_components/toast";
import { appOrigin } from "~/lib/root-domain";

const siteOrigin = process.env.BETTER_AUTH_URL ?? appOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Porfilo — your GitHub, as a portfolio",
  description:
    "Type your GitHub username and get a unique, interactive portfolio built from your real work — in seconds.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Porfilo — your GitHub, as a portfolio",
    description:
      "Type your GitHub username and get a unique, interactive portfolio built from your real work — in seconds.",
    type: "website",
    url: siteOrigin,
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Porfilo — Your GitHub, as a portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Porfilo — your GitHub, as a portfolio",
    description:
      "Type your GitHub username and get a unique, interactive portfolio built from your real work — in seconds.",
    images: ["/api/og"],
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="bg-bg text-fg antialiased">
        <TRPCReactProvider>
          <ToastProvider>{children}</ToastProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
