import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · In Good Company",
  description: "Plain-language privacy and retention for In Good Company.",
};

export default function PrivacyPage() {
  return (
    <main className="narrow" style={{ padding: "72px 24px 100px" }}>
      <p className="eyebrow">In Good Company</p>
      <h1 className="display" style={{ marginBottom: 20 }}>Privacy, in plain language</h1>
      <div style={{ display: "grid", gap: 22, maxWidth: "62ch" }} className="dim">
        <p>
          This game is made from photos of real people, so privacy is part of how it works — not a page you skim past.
        </p>
        <h2 className="display" style={{ fontSize: 24, color: "var(--cream)" }}>Who sees what</h2>
        <p>
          Your deck is visible to exactly one person: the other player in your private room, and only once the round
          starts. There are no public profiles, no directories, no shareable card links, and room pages are excluded
          from search engines. We can&rsquo;t stop the other player taking a screenshot — bring people you&rsquo;re
          comfortable sharing with them.
        </p>
        <h2 className="display" style={{ fontSize: 24, color: "var(--cream)" }}>Consent first</h2>
        <p>
          Before your board goes live you confirm that you have permission to share the photos in this private game and
          that everyone shown is an adult. Decks with minors aren&rsquo;t allowed.
        </p>
        <h2 className="display" style={{ fontSize: 24, color: "var(--cream)" }}>How long things live</h2>
        <p>
          One-time rooms — the photos, names, questions, and answers — are deleted 24 hours after the game ends or the
          room expires. Either player can delete their own deck immediately from the result screen, which also closes
          the room. Photos are cropped to card size on your device before upload; the original file never leaves it.
        </p>
        <h2 className="display" style={{ fontSize: 24, color: "var(--cream)" }}>What we measure</h2>
        <p>
          We count steps of the game — a room was made, a deck finished, a round completed — with anonymous identifiers.
          We never store names, photos, secret choices, or the text of custom questions in analytics or logs.
        </p>
        <h2 className="display" style={{ fontSize: 24, color: "var(--cream)" }}>Your stories</h2>
        <p>
          The best part of the game — why you&rsquo;d call this person first, how you met — happens out loud, on your
          call or across the table. The app never records it.
        </p>
      </div>
      <a className="btn ghost" href="/" style={{ marginTop: 36 }}>Back to the game</a>
    </main>
  );
}
