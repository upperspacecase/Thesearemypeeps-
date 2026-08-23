"use client";

import { useState } from "react";
import type { RoomApi } from "@/lib/useRoom";

export function SecretSelect({ room }: { room: RoomApi }) {
  const { snap, action } = room;
  const [picked, setPicked] = useState<string | null>(null);
  if (!snap) return null;
  const confirmed = snap.me.secretCardId;
  const board = snap.board;
  const chosen = board.find((c) => c.id === (picked ?? confirmed));

  return (
    <main className="paper paper-page">
      <section className="paper-panel fade-in">
        <p className="eyebrow">Round {snap.round?.number ?? 1} · secret choice</p>
        <h1 className="paper-h" style={{ fontSize: "clamp(26px,4.5vw,36px)", marginBottom: 8 }}>
          Choose someone secretly
        </h1>
        <p className="paper-p" style={{ marginBottom: 22 }}>
          Everyone is on one board: your people and {snap.opponent?.name ?? "theirs"}&rsquo;s. Pick anyone.{" "}
          {snap.opponent?.name ?? "The other player"} will see the whole board too, but never who you chose.
        </p>

        <div className="board-grid" style={{ marginBottom: 26 }}>
          {board.map((c) => (
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
            Locked in. Waiting for {snap.opponent?.name ?? "the other player"} ({snap.round?.secretsChosen ?? 1}/2)
          </p>
        ) : (
          <button className="btn ink" disabled={!picked} onClick={() => picked && action({ type: "select_secret", cardId: picked })}>
            {chosen ? `Lock in ${chosen.name}` : "Tap a person to choose"}
          </button>
        )}
      </section>
    </main>
  );
}
