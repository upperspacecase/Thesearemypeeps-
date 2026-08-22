"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomApi } from "@/lib/useRoom";

export function PlayBoard({ room }: { room: RoomApi }) {
  const { snap, action, oppOnline } = room;
  const [guessMode, setGuessMode] = useState(false);
  const [guessCard, setGuessCard] = useState<string | null>(null);
  const [customQ, setCustomQ] = useState("");
  // Optimistic elimination overrides, reconciled against each snapshot (§10.2).
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const eliminated = useMemo(() => new Set(snap?.me.eliminatedCardIds ?? []), [snap]);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const [id, val] of Object.entries(next)) {
        if (eliminated.has(id) === val) delete next[id];
      }
      return next;
    });
  }, [eliminated]);

  if (!snap || !snap.round || !snap.opponent) return null;
  const round = snap.round;
  const opp = snap.opponent;
  const openQ = round.questions.find((q) => q.status === "open");
  const myTurn = round.myTurn;
  const iAmAsker = openQ?.askerId === snap.me.id;
  const mustAnswer = !!openQ && !iAmAsker;
  const canAct = myTurn && !openQ;
  const secretCard = snap.me.cards.find((c) => c.id === snap.me.secretCardId);
  const isOut = (id: string) => overrides[id] ?? eliminated.has(id);
  const remaining = opp.board.filter((c) => !isOut(c.id)).length;

  function toggle(cardId: string) {
    if (guessMode) {
      setGuessCard(cardId);
      return;
    }
    const next = !isOut(cardId);
    setOverrides((prev) => ({ ...prev, [cardId]: next }));
    action({ type: "set_elimination", cardId, eliminated: next });
  }

  async function ask(promptId?: string, text?: string) {
    const ok = await action({ type: "ask_question", promptId, text: text ?? "" });
    if (ok) setCustomQ("");
  }

  return (
    <main style={{ paddingBottom: 120 }}>
      <div className="turnbar">
        <div className="wrap turnbar-inner">
          <span className="pill" style={{ letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 11 }}>
            Round {round.number}
          </span>
          <span className={`pill ${canAct ? "hot" : ""}`} role="status">
            {mustAnswer
              ? "Answer their question"
              : canAct
                ? "Your turn — ask or guess"
                : iAmAsker
                  ? `Waiting for ${opp.name} to answer`
                  : `${opp.name} is thinking…`}
          </span>
          <span className="pill">
            <span className={`dot ${oppOnline ? "on" : ""}`} aria-hidden />
            {opp.name}
          </span>
          {secretCard && (
            <span className="pill" title="Your secret — only you can see this">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={secretCard.imageUrl} alt="" width={22} height={28} style={{ borderRadius: 4, objectFit: "cover" }} />
              your secret: {secretCard.name}
            </span>
          )}
          <span className="pill" aria-label={`${remaining} people still standing`}>{remaining} left</span>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 28 }}>
        <div className="play-cols">
          <section aria-label={`${opp.name}'s board`}>
            <p className="eyebrow" style={{ marginBottom: 10 }}>
              {opp.name}&rsquo;s people {guessMode && "— tap your guess"}
            </p>
            <div className="board-grid">
              {opp.board.map((c) => (
                <button
                  key={c.id}
                  className={`pcard ${isOut(c.id) && !guessMode ? "down" : ""} ${guessMode && guessCard === c.id ? "chosen" : ""}`}
                  onClick={() => toggle(c.id)}
                  aria-pressed={guessMode ? guessCard === c.id : isOut(c.id)}
                  aria-label={
                    guessMode
                      ? `Guess ${c.name}`
                      : `${c.name} — ${isOut(c.id) ? "eliminated, tap to restore" : "standing, tap to eliminate"}`
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.imageUrl} alt={`Photo of ${c.name}`} />
                  <span className="nm">{c.name}</span>
                </button>
              ))}
            </div>
            <p className="small dim" style={{ marginTop: 12 }}>
              Eliminations are private — {opp.name} never sees which cards you flip.
            </p>
          </section>

          <section>
            {canAct && !guessMode && (
              <div className="panel" style={{ borderRadius: 24, padding: 24, marginBottom: 24 }}>
                <p className="eyebrow" style={{ marginBottom: 12 }}>Ask one yes-or-no question</p>
                <div className="chips" style={{ marginBottom: 14 }}>
                  {snap.prompts.map((p) => (
                    <button key={p.id} className="chip" onClick={() => ask(p.id)}>
                      {p.text}
                    </button>
                  ))}
                </div>
                {snap.room.promptPolicy === "friends" ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <label className="lbl" htmlFor="custom-q">Or ask your own</label>
                    <textarea
                      id="custom-q"
                      className="field"
                      rows={2}
                      placeholder="Anything they can answer yes or no…"
                      value={customQ}
                      maxLength={200}
                      onChange={(e) => setCustomQ(e.target.value)}
                    />
                    <button className="btn solid sm" disabled={!customQ.trim()} onClick={() => ask(undefined, customQ)}>
                      Ask
                    </button>
                  </div>
                ) : (
                  <p className="small dim">This is a team-safe room: pick from the suggested questions.</p>
                )}
                <hr style={{ border: "none", borderTop: "1px solid var(--glass-edge)", margin: "18px 0" }} />
                <button className="btn ghost sm" onClick={() => setGuessMode(true)}>
                  I&rsquo;m ready to guess instead
                </button>
              </div>
            )}

            {guessMode && (
              <div className="panel" style={{ borderRadius: 24, padding: 24, marginBottom: 24 }}>
                <p className="eyebrow" style={{ marginBottom: 8 }}>Make your guess</p>
                <p className="small dim" style={{ marginBottom: 14 }}>
                  Careful — a wrong guess loses the round.
                </p>
                {guessCard && (
                  <p style={{ marginBottom: 14 }}>
                    Guessing <strong>{opp.board.find((c) => c.id === guessCard)?.name}</strong>
                  </p>
                )}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn solid sm"
                    disabled={!guessCard || !canAct}
                    onClick={() => guessCard && action({ type: "submit_guess", cardId: guessCard })}
                  >
                    Lock in my guess
                  </button>
                  <button className="btn ghost sm" onClick={() => { setGuessMode(false); setGuessCard(null); }}>
                    Keep asking
                  </button>
                </div>
              </div>
            )}

            <section aria-label="Question history">
              <p className="eyebrow" style={{ marginBottom: 10 }}>The trail so far</p>
              {round.questions.length === 0 && (
                <p className="small dim">
                  No questions yet. Start visible (&ldquo;Are they wearing a hat?&rdquo;) and get braver.
                </p>
              )}
              <div className="qhistory">
                {[...round.questions].reverse().map((q) => (
                  <div key={q.id} className="qitem">
                    <p className="who">
                      {q.askerId === snap.me.id ? "You asked" : `${opp.name} asked`} · turn {q.turnNo}
                    </p>
                    <p className="txt">&ldquo;{q.text}&rdquo;</p>
                    <span className={`ans ${q.answer ? "" : "waiting"}`}>
                      {q.answer ? { yes: "Yes", no: "No", not_sure: "Not sure", skip: "Skipped" }[q.answer] : "waiting…"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      </div>

      {mustAnswer && openQ && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Answer their question">
          <div className="panel sheet fade-in" style={{ borderRadius: 28 }}>
            <p className="eyebrow">{opp.name} asks</p>
            <p className="serif-q" style={{ fontSize: "clamp(24px,4vw,32px)", lineHeight: 1.2, margin: "8px 0 4px" }}>
              &ldquo;{openQ.text}&rdquo;
            </p>
            <p className="small dim">Answer from your own view of them. Skipping is always fine.</p>
            <div className="answer-row">
              {(
                [
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["not_sure", "Not sure"],
                  ["skip", "Skip"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  className={val === "yes" || val === "no" ? "btn solid" : "btn ghost"}
                  onClick={() => action({ type: "answer_question", questionId: openQ.id, answer: val })}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="small dim" style={{ marginTop: 16 }}>
              If there&rsquo;s a story behind it — tell them why, out loud. The app never records it.
            </p>
          </div>
        </div>
      )}

    </main>
  );
}
