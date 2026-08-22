"use client";

import { useState } from "react";
import type { RoomApi } from "@/lib/useRoom";

export function SecretSelect({ room }: { room: RoomApi }) {
  const { snap, action } = room;
  const [picked, setPicked] = useState<string | null>(null);
  if (!snap) return null;
  const confirmed = snap.me.secretCardId;

  return (
    <main className="narrow" style={{ padding: "48px 24px 90px" }}>
      <section className="panel fade-in">
        <p className="eyebrow">Round {snap.round?.number ?? 1} · secret choice</p>
        <h1 className="display" style={{ fontSize: "clamp(26px,4.5vw,36px)", marginBottom: 8 }}>
          Choose someone secretly
        </h1>
        <p className="dim small" style={{ maxWidth: "52ch", marginBottom: 24 }}>
          {snap.opponent?.name ?? "The other player"} will try to guess who you chose. They can see everyone you brought
          — but never who you picked.
        </p>

        <div className="board-grid" style={{ marginBottom: 26 }}>
          {snap.me.cards.map((c) => (
            <button
              key={c.id}
              className={`pcard ${(picked ?? confirmed) === c.id ? "chosen" : ""}`}
              onClick={() => !confirmed && setPicked(c.id)}
              aria-pressed={(picked ?? confirmed) === c.id}
              disabled={!!confirmed}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imageUrl} alt={`Photo of ${c.name}`} />
              <span className="nm">{c.name}</span>
            </button>
          ))}
        </div>

        {confirmed ? (
          <p className="pill hot" role="status">
            Locked in — waiting for {snap.opponent?.name ?? "the other player"} ({snap.round?.secretsChosen ?? 1}/2)
          </p>
        ) : (
          <button className="btn solid" disabled={!picked} onClick={() => picked && action({ type: "select_secret", cardId: picked })}>
            {picked ? `Lock in ${snap.me.cards.find((c) => c.id === picked)?.name}` : "Tap a person to choose"}
          </button>
        )}
      </section>
    </main>
  );
}
