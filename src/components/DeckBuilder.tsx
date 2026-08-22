"use client";

import { useRef, useState } from "react";
import type { RoomApi } from "@/lib/useRoom";
import { toCardImage } from "@/lib/client";

export function DeckBuilder({ room, roomId }: { room: RoomApi; roomId: string }) {
  const { snap, action, refresh, setError } = room;
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingName, setPendingName] = useState("");
  const [uploading, setUploading] = useState(0);
  const [consent, setConsent] = useState(false);
  const [myName, setMyName] = useState<string | null>(null);

  if (!snap) return null;
  const size = snap.room.deckSize;
  const cards = snap.me.cards;
  const complete = cards.length === size;
  const ready = snap.me.ready;

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room_remaining = size - (snap?.me.cards.length ?? 0);
    const batch = [...files].slice(0, room_remaining);
    setUploading(batch.length);
    for (const [i, file] of batch.entries()) {
      try {
        const blob = await toCardImage(file);
        const form = new FormData();
        form.append("file", blob, "card.jpg");
        const base = pendingName.trim();
        const fallback = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 30) || "Someone";
        form.append("name", batch.length === 1 && base ? base : fallback);
        const res = await fetch(`/api/rooms/${roomId}/cards`, { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? "Upload failed");
        }
      } catch (err) {
        setError((err as Error).message);
      }
      setUploading(batch.length - i - 1);
    }
    setPendingName("");
    setUploading(0);
    await refresh();
  }

  async function saveName() {
    if (myName !== null && myName.trim()) await action({ type: "set_display_name", name: myName });
  }

  return (
    <section className="panel fade-in">
      <p className="eyebrow">Your board</p>
      <h1 className="display" style={{ fontSize: "clamp(26px,4.5vw,36px)", marginBottom: 8 }}>
        Bring {size} people from your life
      </h1>
      <p className="dim small" style={{ maxWidth: "52ch", marginBottom: 20 }}>
        A photo and a first name each. Different parts of your life make the best boards. Your opponent sees these only
        once the round starts.
      </p>

      <div style={{ marginBottom: 22, maxWidth: 360 }}>
        <label className="lbl" htmlFor="display-name">Your first name</label>
        <input
          id="display-name"
          className="field"
          placeholder="How the other player sees you"
          defaultValue={snap.me.name === "Player" ? "" : snap.me.name}
          maxLength={40}
          onChange={(e) => setMyName(e.target.value)}
          onBlur={saveName}
        />
      </div>

      <div className="progress-ticks" style={{ marginBottom: 20 }} aria-label={`${cards.length} of ${size} people added`}>
        {Array.from({ length: size }, (_, i) => (
          <i key={i} className={i < cards.length ? "on" : ""} />
        ))}
        <em>
          {cards.length}/{size}
          {uploading > 0 && ` · uploading ${uploading}…`}
        </em>
      </div>

      <div className="deck-grid" style={{ marginBottom: 24 }}>
        {cards.map((c, i) => (
          <figure key={c.id} className="pcard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.imageUrl} alt={`Photo of ${c.name}`} />
            <figcaption className="nm">{c.name}</figcaption>
            {!ready && (
              <div className="deck-tools">
                <button aria-label={`Move ${c.name} earlier`} disabled={i === 0} onClick={() => action({ type: "move_card", cardId: c.id, direction: "up" })}>←</button>
                <button
                  aria-label={`Rename ${c.name}`}
                  onClick={() => {
                    const name = prompt("First name or nickname", c.name);
                    if (name) action({ type: "rename_card", cardId: c.id, name });
                  }}
                >
                  ✎
                </button>
                <button aria-label={`Remove ${c.name}`} onClick={() => action({ type: "remove_card", cardId: c.id })}>✕</button>
                <button aria-label={`Move ${c.name} later`} disabled={i === cards.length - 1} onClick={() => action({ type: "move_card", cardId: c.id, direction: "down" })}>→</button>
              </div>
            )}
          </figure>
        ))}
        {!ready &&
          Array.from({ length: size - cards.length }, (_, i) => (
            <button key={`slot-${i}`} className="slot" onClick={() => fileInput.current?.click()} aria-label="Add a person">
              +
            </button>
          ))}
      </div>

      {!ready && !complete && (
        <div style={{ display: "grid", gap: 12, maxWidth: 460, marginBottom: 8 }}>
          <div>
            <label className="lbl" htmlFor="person-name">Next person&rsquo;s name (optional before choosing a photo)</label>
            <input
              id="person-name"
              className="field"
              placeholder="e.g. Maya"
              value={pendingName}
              maxLength={30}
              onChange={(e) => setPendingName(e.target.value)}
            />
          </div>
          <button className="btn ghost" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? "Uploading…" : "Add photos"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="notice">
            Only include adults whose photos you have permission to share in your private game. Photos are cropped to
            card size on your device — the original file never leaves it.
          </p>
        </div>
      )}

      {complete && !ready && (
        <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
          <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 5, width: 18, height: 18, accentColor: "#fff6ef" }}
            />
            <span className="small dim">
              I have permission to share these photos in this private game, and everyone shown is an adult. Only the two
              of us will see them, and they&rsquo;re deleted 24 hours after the game — or sooner if I delete them.
            </span>
          </label>
          <button className="btn solid" onClick={() => action({ type: "mark_ready", consent })} disabled={!consent}>
            My board is ready
          </button>
        </div>
      )}

      {ready && (
        <p className="pill hot" role="status">
          Your deck is ready — waiting for {snap.opponent ? snap.opponent.name : "your opponent"}
        </p>
      )}
    </section>
  );
}
