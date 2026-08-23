"use client";

import type { RoomApi } from "@/lib/useRoom";

function Trophy() {
  return (
    <svg className="outcome-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h10v5a5 5 0 0 1-10 0V4Z M7 5H4.5A2.5 2.5 0 0 0 7 9.5 M17 5h2.5A2.5 2.5 0 0 1 17 9.5 M12 14v3 M8.5 20h7 M9.5 20c0-1.7 1.1-3 2.5-3s2.5 1.3 2.5 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Cross() {
  return (
    <svg className="outcome-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Reveal({ room }: { room: RoomApi }) {
  const { snap, action } = room;
  if (!snap || !snap.round || !snap.opponent) return null;
  const round = snap.round;
  const opp = snap.opponent;
  const board = snap.board;

  const mySecret = board.find((c) => c.id === snap.me.secretCardId);
  const theirSecret = board.find((c) => c.id === opp.secretCardId);
  const myGuess = round.guesses.find((g) => g.playerId === snap.me.id);
  const theirGuess = round.guesses.find((g) => g.playerId === opp.id);
  const iGotIt = !!myGuess?.correct;
  const theyGotIt = !!theirGuess?.correct;

  const headline = iGotIt
    ? theyGotIt
      ? "You both found them."
      : "You found them."
    : theyGotIt
      ? `${opp.name} found them.`
      : "Neither of you found them.";

  const nameOf = (id?: string) => board.find((c) => c.id === id)?.name ?? "someone";

  return (
    <main className="paper paper-page">
      <section className="paper-panel fade-in">
        <p className="eyebrow">Round {round.number} · the reveal</p>
        <h1 className="paper-h">{headline}</h1>

        <div className="outcomes">
          <div className={`outcome ${iGotIt ? "win" : "miss"}`}>
            {iGotIt ? <Trophy /> : <Cross />}
            <span className="outcome-who">You</span>
            <span className="outcome-what">guessed {nameOf(myGuess?.cardId)}</span>
          </div>
          <div className={`outcome ${theyGotIt ? "win" : "miss"}`}>
            {theyGotIt ? <Trophy /> : <Cross />}
            <span className="outcome-who">{opp.name}</span>
            <span className="outcome-what">guessed {nameOf(theirGuess?.cardId)}</span>
          </div>
        </div>

        <p className="reveal-label">The people you each picked</p>
        <div className="reveal-cards">
          {theirSecret && (
            <figure className="pcard" style={{ width: 150, transform: "rotate(-2deg)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={theirSecret.imageUrl} alt={`Photo of ${theirSecret.name}`} />
              <figcaption className="nm">{theirSecret.name}</figcaption>
              <p className="serif-q reveal-owner">{opp.name}&rsquo;s pick</p>
            </figure>
          )}
          {mySecret && (
            <figure className="pcard" style={{ width: 150, transform: "rotate(2deg)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mySecret.imageUrl} alt={`Photo of ${mySecret.name}`} />
              <figcaption className="nm">{mySecret.name}</figcaption>
              <p className="serif-q reveal-owner">your pick</p>
            </figure>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
          <button className="btn ink" onClick={() => action({ type: "request_rematch" })} disabled={snap.me.rematchRequested}>
            {snap.me.rematchRequested
              ? opp.rematchRequested
                ? "Starting…"
                : `Waiting for ${opp.name}…`
              : opp.rematchRequested
                ? `${opp.name} wants to go again. Yes`
                : "Again?"}
          </button>
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
        <p className="small dim" style={{ marginTop: 18 }}>
          Everything in this room deletes itself within 24 hours either way.
        </p>
      </section>
    </main>
  );
}
