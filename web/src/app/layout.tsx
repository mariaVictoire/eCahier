import type { Metadata, Viewport } from "next";
import { Literata, DM_Sans } from "next/font/google";
import "./globals.css";

const display = Literata({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "eCahier",
    template: "%s · eCahier",
  },
  description:
    "Cahier de textes numérique pour les établissements scolaires du Gabon.",
  applicationName: "eCahier",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#006B3F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        <div className="ga-stripe" aria-hidden />
        {children}
      </body>
    </html>
  );
}
