import type { Metadata } from "next";
import { GameplayMock } from "@/components/GameplayMock";

// The source of truth for the link-preview image: rendered at 1200×630 and
// captured to /public/og.png (see scripts/make-og.mjs). Kept in the app so the
// preview always matches the real design.

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OgPage() {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 72px",
        backgroundColor: "var(--paper)",
        backgroundImage: "radial-gradient(var(--ink-12) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={150} height={137} style={{ display: "block", marginBottom: 22 }} />
        <p className="paper-title" style={{ fontSize: 66, lineHeight: 1.02, margin: 0 }}>In Good Company</p>
        <p style={{ fontSize: 27, color: "var(--ink-70)", marginTop: 16 }}>A game about the people in your life.</p>
        <p style={{ fontSize: 20, color: "var(--ink-50)", marginTop: 26 }}>
          2 players · 5–15 photos each · about 20 minutes
        </p>
      </div>
      <div style={{ flexShrink: 0, transform: "rotate(3deg)" }}>
        <GameplayMock width={330} />
      </div>
    </div>
  );
}
