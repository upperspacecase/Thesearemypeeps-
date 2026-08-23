import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "In Good Company",
  description: "A two-player guessing game made from the real people in your lives.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
