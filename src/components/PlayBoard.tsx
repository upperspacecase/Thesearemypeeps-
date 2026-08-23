"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoomApi } from "@/lib/useRoom";

// The app is the board. Questions, answers, and turns all happen out loud —
// in person or on the call — so this screen only does three things:
//   swipe left  = it's not this person (tap a removed card's zoom to undo)
//   tap         = zoom in on someone
//   zoom view   = remove / bring back / lock in your guess
// The whole board fits on one screen; your own pick sits larger in a corner.

const SWIPE_THRESHOLD = 60; // distance in any direction that discards a card
const LABEL_THRESHOLD = 24;

interface Drag {
  id: string;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
}

export function PlayBoard({ room }: { room: RoomApi }) {
  const { snap, action } = room;
  // Optimistic elimination overrides, reconciled against each snapshot.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const [zoomId, setZoomId] = useState<string | null>(null);
  const [confirmingGuess, setConfirmingGuess] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  const [showHowTo, setShowHowTo] = useState(false);

  // Wordle-style: the rules appear once, the first time someone reaches the
  // board, then live behind the ? button. The board itself stays mute.
  useEffect(() => {
    try {
      if (!localStorage.getItem("igc_howto_v1")) setShowHowTo(true);
    } catch {
      setShowHowTo(true);
    }
  }, []);
  function closeHowTo() {
    setShowHowTo(false);
    try {
      localStorage.setItem("igc_howto_v1", "1");
    } catch {}
  }

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

  const boardLen = snap?.board.length ?? 0;

  // Pick the column count whose cells come closest to the 3:4 card shape,
  // given that every row must fit on screen at once.
  useEffect(() => {
    const el = boardRef.current;
    if (!el || boardLen === 0) return;
    const compute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const GAP = 8;
      const NAME = 20;
      let best = { cols: Math.min(4, boardLen), score: Infinity };
      for (let c = 2; c <= Math.min(boardLen, 8); c++) {
        const rows = Math.ceil(boardLen / c);
        const cw = (w - GAP * (c - 1)) / c;
        const ch = (h - GAP * (rows - 1)) / rows;
        const imgH = ch - NAME;
        if (imgH <= 20) continue;
        const score = Math.abs(cw / imgH - 0.75);
        if (score < best.score) best = { cols: c, score };
      }
      setCols(best.cols);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [boardLen]);

  if (!snap || !snap.round || !snap.opponent) return null;
  const board = snap.board;
  const secretCard = board.find((c) => c.id === snap.me.secretCardId);
  const iGuessed = !!snap.me.guessedCardId;
  const myGuessCard = board.find((c) => c.id === snap.me.guessedCardId);
  const zoomCard = board.find((c) => c.id === zoomId);
  const isOut = (id: string) => overrides[id] ?? eliminated.has(id);
  const remaining = board.filter((c) => !isOut(c.id)).length;

  function setOut(cardId: string, out: boolean) {
    if (isOut(cardId) === out) return;
    setOverrides((prev) => ({ ...prev, [cardId]: out }));
    action({ type: "set_elimination", cardId, eliminated: out });
  }

  function openZoom(id: string) {
    setConfirmingGuess(false);
    setZoomId(id);
  }
  function closeZoom() {
    setZoomId(null);
    setConfirmingGuess(false);
  }

  function pointerDown(e: React.PointerEvent, id: string) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ id, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false });
  }
  function pointerMove(e: React.PointerEvent, id: string) {
    setDrag((d) => {
      if (!d || d.id !== id) return d;
      // The card follows the finger whichever way it goes.
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      return { ...d, dx, dy, moved: d.moved || Math.hypot(dx, dy) > 6 };
    });
  }
  function pointerEnd(id: string) {
    const d = dragRef.current;
    setDrag(null);
    if (!d || d.id !== id) return;
    // Flick it away in any direction to discard; a second flick brings it back.
    if (Math.hypot(d.dx, d.dy) >= SWIPE_THRESHOLD) setOut(id, !isOut(id));
    else if (!d.moved) openZoom(id); // tap: look closer
  }

  return (
    <main className="playwrap">
      <div className="board-fit" ref={boardRef}>
        <div
          className="fitgrid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}
        >
          {board.map((c) => {
            const dragging = drag?.id === c.id;
            const dx = dragging ? drag!.dx : 0;
            const dy = dragging ? drag!.dy : 0;
            const showLabel = dragging && Math.hypot(dx, dy) > LABEL_THRESHOLD;
            return (
              <button
                key={c.id}
                className={`pcard fit ${isOut(c.id) ? "down" : ""} ${dragging ? "dragging" : ""}`}
                style={
                  dragging && (dx !== 0 || dy !== 0)
                    ? { transform: `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`, opacity: 1 }
                    : undefined
                }
                onPointerDown={(e) => pointerDown(e, c.id)}
                onPointerMove={(e) => pointerMove(e, c.id)}
                onPointerUp={() => pointerEnd(c.id)}
                onPointerCancel={() => setDrag(null)}
                onClick={(e) => {
                  if (e.detail === 0) openZoom(c.id); // keyboard activation
                }}
                aria-label={`${c.name || "Unnamed"}, ${isOut(c.id) ? "removed" : "standing"}. Tap to look closer`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imageUrl} alt={`Photo of ${c.name}`} draggable={false} />
                <span className="nm">{c.name}</span>
                {showLabel && <span className="swipe-label no" aria-hidden>It&rsquo;s not this person</span>}
              </button>
            );
          })}
        </div>
      </div>

      <footer className="playfoot">
        <div className="foot-left">
          <button className="howto-btn" onClick={() => setShowHowTo(true)} aria-label="How to play">?</button>
          <span className="foot-count">
            {iGuessed
              ? `You guessed ${myGuessCard?.name ?? "someone"}. Waiting for ${snap.opponent.name}…`
              : `${remaining} still standing`}
          </span>
        </div>
        {secretCard && (
          <button className="secret-corner" onClick={() => openZoom(secretCard.id)} aria-label={`Your pick: ${secretCard.name}. Tap to enlarge`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={secretCard.imageUrl} alt="" draggable={false} />
            <span className="who">you picked</span>
            <strong>{secretCard.name}</strong>
          </button>
        )}
      </footer>

      {showHowTo && (
        <div className="zoom-backdrop" role="dialog" aria-modal="true" aria-label="How to play" onClick={closeHowTo}>
          <div className="zoom-card fade-in howto" onClick={(e) => e.stopPropagation()}>
            <button className="howto-close" onClick={closeHowTo} aria-label="Close">✕</button>
            <h2>How to play</h2>
            <p className="howto-sub">Find the person they picked. The talking is up to you.</p>
            <ul>
              <li>Ask yes-or-no questions <strong>out loud</strong>. Nothing goes through the app.</li>
              <li>Flick a card away in any direction when it&rsquo;s not them. Flick it again to bring them back.</li>
              <li>Tap anyone to look closer, and guess from there when you&rsquo;re sure.</li>
              <li>A wrong guess loses the round.</li>
            </ul>
            <button className="btn ink" onClick={closeHowTo} style={{ marginTop: 6 }}>Got it</button>
          </div>
        </div>
      )}

      {zoomCard && (
        <div className="zoom-backdrop" role="dialog" aria-modal="true" aria-label={zoomCard.name} onClick={closeZoom}>
          <div className="zoom-card fade-in" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomCard.imageUrl} alt={`Photo of ${zoomCard.name}`} />
            <p className="zoom-name">
              {zoomCard.name}
              {zoomCard.id === snap.me.secretCardId && <span className="zoom-tag">your pick</span>}
              {isOut(zoomCard.id) && <span className="zoom-tag">removed</span>}
            </p>
            {iGuessed ? (
              <div className="zoom-actions">
                <button
                  className="btn paperline sm"
                  onClick={() => {
                    setOut(zoomCard.id, !isOut(zoomCard.id));
                    closeZoom();
                  }}
                >
                  {isOut(zoomCard.id) ? "Bring them back" : "It's not this person"}
                </button>
                <button className="btn paperline sm" onClick={closeZoom}>Close</button>
              </div>
            ) : !confirmingGuess ? (
              <div className="zoom-actions">
                <button
                  className="btn paperline sm"
                  onClick={() => {
                    setOut(zoomCard.id, !isOut(zoomCard.id));
                    closeZoom();
                  }}
                >
                  {isOut(zoomCard.id) ? "Bring them back" : "It's not this person"}
                </button>
                <button className="btn ink sm" onClick={() => setConfirmingGuess(true)}>
                  This is my guess
                </button>
                <button className="btn paperline sm" onClick={closeZoom}>Close</button>
              </div>
            ) : (
              <div className="zoom-actions">
                <p className="small" style={{ width: "100%", color: "var(--ink)", opacity: 0.75 }}>
                  A wrong guess loses the round. Sure?
                </p>
                <button className="btn ink sm" onClick={() => action({ type: "submit_guess", cardId: zoomCard.id })}>
                  Lock in {zoomCard.name}
                </button>
                <button className="btn paperline sm" onClick={() => setConfirmingGuess(false)}>Back</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
