import type { Metadata } from "next";
import "./globals.css";

const DESCRIPTION =
  "Bring 5–15 photos of people in your life, guess who the other player picked. Two players, about 20 minutes, together on a call or in person.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://thesearemypeeps.vercel.app"),
  title: "In Good Company",
  description: DESCRIPTION,
  icons: { icon: "/icon.png", shortcut: "/favicon.ico", apple: "/icon.png" },
  openGraph: {
    title: "In Good Company",
    description: DESCRIPTION,
    siteName: "In Good Company",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "A board of people, some already ruled out" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "In Good Company",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Poppins:wght@300;400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
