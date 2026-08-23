"use client";

import { useState } from "react";
import type { RoomApi } from "@/lib/useRoom";

export function Reveal({ room }: { room: RoomApi }) {
  const { snap, action } = room;
  const [outcomeSent, setOutcomeSent] = useState(false);
  if (!snap || !snap.round || !snap.opponent) return null;
  const round = snap.round;
  const opp = snap.opponent;
  const iWon = round.winnerId === snap.me.id;
  const board = snap.board;
  const mySecret = board.find((c) => c.id === snap.me.secretCardId);
  const theirSecret = board.find((c) => c.id === opp.secretCardId);
  const finalGuess = round.guesses[round.guesses.length - 1];
  const guessedCard = finalGuess && board.find((c) => c.id === finalGuess.cardId);

  return (
    <main className="paper paper-page">
      <section className="paper-panel fade-in">
        <p className="eyebrow">Round {round.number} · the reveal</p>
        <h1 className="paper-h" style={{ fontSize: "clamp(30px,5vw,42px)", marginBottom: 6 }}>
          {iWon ? "You found them." : `${opp.name} found yours first.`}
        </h1>
        {finalGuess && guessedCard && (
          <p className="paper-p small" style={{ marginBottom: 26 }}>
            {finalGuess.playerId === snap.me.id ? "You" : opp.name} guessed {guessedCard.name} —{" "}
            {finalGuess.correct ? "right" : "wrong, which ends the round"}.
          </p>
        )}

        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", margin: "10px 0 8px" }}>
          {theirSecret && (
            <figure className="pcard win" style={{ width: 180, transform: "rotate(-2deg)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={theirSecret.imageUrl} alt={`Photo of ${theirSecret.name}`} />
              <figcaption className="nm">{theirSecret.name}</figcaption>
              <p className="serif-q" style={{ color: "var(--orange)", fontSize: 14, padding: "0 4px 6px" }}>
                {opp.name}&rsquo;s pick
              </p>
            </figure>
          )}
          {mySecret && (
            <figure className="pcard" style={{ width: 180, transform: "rotate(2deg)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mySecret.imageUrl} alt={`Photo of ${mySecret.name}`} />
              <figcaption className="nm">{mySecret.name}</figcaption>
              <p className="serif-q" style={{ color: "var(--orange)", fontSize: 14, padding: "0 4px 6px" }}>
                your pick
              </p>
            </figure>
          )}
        </div>

        <p className="serif-q" style={{ fontSize: "clamp(19px,3vw,24px)", margin: "22px auto 4px", maxWidth: "30ch" }}>
          &ldquo;What should I know about this person?&rdquo;
        </p>
        <p className="small dim" style={{ marginBottom: 28 }}>Ask each other — out loud. That part stays between you.</p>

        {!outcomeSent ? (
          <div style={{ marginBottom: 26 }}>
            <p className="small dim" style={{ marginBottom: 10 }}>Did you learn something you didn&rsquo;t know?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn paperline sm" onClick={() => { action({ type: "report_outcome", learned: true }); setOutcomeSent(true); }}>Yes, I did</button>
              <button className="btn paperline sm" onClick={() => { action({ type: "report_outcome", learned: false }); setOutcomeSent(true); }}>Not this time</button>
            </div>
          </div>
        ) : (
          <p className="small dim" style={{ marginBottom: 26 }}>Thanks — that helps us make the game better.</p>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn ink" onClick={() => action({ type: "request_rematch" })} disabled={snap.me.rematchRequested}>
            {snap.me.rematchRequested
              ? opp.rematchRequested
                ? "Starting…"
                : `Waiting for ${opp.name}…`
              : opp.rematchRequested
                ? `${opp.name} wants a rematch — accept`
                : "Rematch"}
          </button>
          <a className="btn paperline" href="/">Share a new room</a>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm("Delete your photos and close this room now? This can't be undone.")) {
                action({ type: "delete_deck" });
              }
            }}
          >
            Delete my deck now
          </button>
        </div>
        <p className="small dim" style={{ marginTop: 20 }}>
          Everything in this room deletes itself within 24 hours either way.
        </p>

      </section>
    </main>
  );
}
