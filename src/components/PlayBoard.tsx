"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoomApi } from "@/lib/useRoom";

// The app is the board. Questions, answers, and turns all happen out loud —
// in person or on the call — so this screen only does three things:
//   swipe left  = it's not this person (tap a removed card's zoom to undo)
//   tap         = zoom in on someone
//   zoom view   = remove / bring back / lock in your guess
// The whole board fits on one screen; your own pick sits larger in a corner.

const SWIPE_THRESHOLD = 60;
const LABEL_THRESHOLD = 24;

interface Drag {
  id: string;
  startX: number;
  dx: number;
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
    setDrag({ id, startX: e.clientX, dx: 0, moved: false });
  }
  function pointerMove(e: React.PointerEvent, id: string) {
    setDrag((d) => {
      if (!d || d.id !== id) return d;
      // Only leftward drag moves the card — swiping is for removing people.
      const dx = Math.min(0, e.clientX - d.startX);
      return { ...d, dx, moved: d.moved || Math.abs(e.clientX - d.startX) > 6 };
    });
  }
  function pointerEnd(id: string) {
    const d = dragRef.current;
    setDrag(null);
    if (!d || d.id !== id) return;
    if (d.dx <= -SWIPE_THRESHOLD) setOut(id, true); // swipe left: it's not this person
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
            const showLabel = dragging && dx < -LABEL_THRESHOLD;
            return (
              <button
                key={c.id}
                className={`pcard fit ${isOut(c.id) ? "down" : ""} ${dragging ? "dragging" : ""}`}
                style={dragging && dx !== 0 ? { transform: `translateX(${dx}px) rotate(${dx / 22}deg)`, opacity: 1 } : undefined}
                onPointerDown={(e) => pointerDown(e, c.id)}
                onPointerMove={(e) => pointerMove(e, c.id)}
                onPointerUp={() => pointerEnd(c.id)}
                onPointerCancel={() => setDrag(null)}
                onClick={(e) => {
                  if (e.detail === 0) openZoom(c.id); // keyboard activation
                }}
                aria-label={`${c.name || "Unnamed"} — ${isOut(c.id) ? "removed" : "standing"}. Tap to look closer`}
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
        <p className="mech">
          <strong style={{ color: "var(--cream)", fontWeight: 600 }}>{remaining} still standing.</strong> Ask questions
          out loud — nothing goes through the app. Swipe a card left when it&rsquo;s not them. Tap anyone to look
          closer, guess from there when you&rsquo;re sure.
        </p>
        {secretCard && (
          <button className="secret-corner" onClick={() => openZoom(secretCard.id)} aria-label={`Your pick: ${secretCard.name}. Tap to enlarge`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={secretCard.imageUrl} alt="" draggable={false} />
            <span className="who">you picked</span>
            <strong>{secretCard.name}</strong>
          </button>
        )}
      </footer>

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
            {!confirmingGuess ? (
              <div className="zoom-actions">
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setOut(zoomCard.id, !isOut(zoomCard.id));
                    closeZoom();
                  }}
                >
                  {isOut(zoomCard.id) ? "Bring them back" : "It's not this person"}
                </button>
                <button className="btn solid sm" onClick={() => setConfirmingGuess(true)}>
                  This is my guess
                </button>
                <button className="btn ghost sm" onClick={closeZoom}>Close</button>
              </div>
            ) : (
              <div className="zoom-actions">
                <p className="small" style={{ width: "100%", color: "var(--ink)", opacity: 0.75 }}>
                  A wrong guess ends the round — and loses it. Sure?
                </p>
                <button className="btn solid sm" onClick={() => action({ type: "submit_guess", cardId: zoomCard.id })}>
                  Lock in {zoomCard.name}
                </button>
                <button className="btn ghost sm" onClick={() => setConfirmingGuess(false)}>Back</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
