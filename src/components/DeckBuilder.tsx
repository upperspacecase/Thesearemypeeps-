"use client";

import { useRef, useState } from "react";
import type { RoomApi } from "@/lib/useRoom";
import { toCardImage } from "@/lib/client";
import { CropModal } from "./CropModal";

/** Name box under one photo: local while typing, saved on blur or Enter. */
function NameInput({
  cardId,
  name,
  onSave,
}: {
  cardId: string;
  name: string;
  onSave: (cardId: string, name: string) => void;
}) {
  const [value, setValue] = useState(name);
  const save = () => {
    if (value.trim() && value.trim() !== name) onSave(cardId, value.trim());
  };
  return (
    <input
      className={`nm-input ${value.trim() ? "" : "missing"}`}
      placeholder="Name"
      aria-label="This person's first name"
      value={value}
      maxLength={30}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function DeckBuilder({ room, roomId }: { room: RoomApi; roomId: string }) {
  const { snap, action, refresh, setError } = room;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [queue, setQueue] = useState<File[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [consent, setConsent] = useState(false);
  const [myName, setMyName] = useState<string | null>(null);

  if (!snap) return null;
  const min = snap.room.deckMin;
  const max = snap.room.deckMax;
  const cards = snap.me.cards;
  const enough = cards.length >= min;
  const full = cards.length >= max;
  const ready = snap.me.ready;
  const unnamed = cards.filter((c) => !c.name.trim()).length;

  function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = max - (snap?.me.cards.length ?? 0);
    const batch = [...files].slice(0, remaining);
    // Each photo goes through the framing step (drag / pinch-zoom) first.
    setQueue(batch);
    setQueueTotal(batch.length);
  }

  async function uploadBlob(blob: Blob) {
    try {
      const form = new FormData();
      form.append("file", blob, "card.jpg");
      // No name yet — each photo gets its own name box below it.
      form.append("name", "");
      const res = await fetch(`/api/rooms/${roomId}/cards`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Upload failed");
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function croppedDone(blob: Blob) {
    setUploading(1);
    await uploadBlob(blob);
    setUploading(0);
    setQueue((q) => q.slice(1));
    await refresh();
  }

  async function currentAsIs() {
    const file = queue[0];
    if (!file) return;
    setUploading(1);
    try {
      await uploadBlob(await toCardImage(file));
    } catch (err) {
      setError((err as Error).message);
    }
    setUploading(0);
    setQueue((q) => q.slice(1));
    await refresh();
  }

  async function restAsIs() {
    const rest = [...queue];
    setQueue([]);
    setUploading(rest.length);
    for (const [i, file] of rest.entries()) {
      try {
        await uploadBlob(await toCardImage(file));
      } catch (err) {
        setError((err as Error).message);
      }
      setUploading(rest.length - i - 1);
    }
    setUploading(0);
    await refresh();
  }

  async function saveName() {
    if (myName !== null && myName.trim()) await action({ type: "set_display_name", name: myName });
  }

  const saveCardName = (cardId: string, name: string) => action({ type: "rename_card", cardId, name });

  return (
    <section className="panel fade-in">
      <p className="eyebrow">Your board</p>
      <h1 className="display" style={{ fontSize: "clamp(26px,4.5vw,36px)", marginBottom: 8 }}>
        Bring 5 to 15 people from your life
      </h1>
      <p className="dim small" style={{ maxWidth: "52ch", marginBottom: 20 }}>
        Select all your photos in one go — the picker lets you tap several at once — then type each person&rsquo;s
        first name under their picture. Five gets you playing; more people make the guessing harder. Your opponent
        sees them only once the round starts.
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

      <div
        className="progress-ticks"
        style={{ marginBottom: 20 }}
        aria-label={`${cards.length} people added — at least ${min} needed, up to ${max}`}
      >
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={`${i < cards.length ? "on" : ""} ${i === min - 1 ? "min" : ""}`} />
        ))}
        <em>
          {cards.length} {cards.length === 1 ? "person" : "people"}
          {!enough && ` · ${min - cards.length} more to play`}
          {enough && unnamed > 0 && ` · ${unnamed} still ${unnamed === 1 ? "needs" : "need"} a name`}
          {enough && unnamed === 0 && !ready && ` · ready when you are`}
          {uploading > 0 && ` · uploading ${uploading}…`}
        </em>
      </div>

      <div className="deck-grid" style={{ marginBottom: 24 }}>
        {cards.map((c, i) => (
          <figure key={c.id} className="pcard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.imageUrl} alt={c.name ? `Photo of ${c.name}` : "Photo awaiting a name"} />
            {ready ? (
              <figcaption className="nm">{c.name}</figcaption>
            ) : (
              <NameInput cardId={c.id} name={c.name} onSave={saveCardName} />
            )}
            {!ready && (
              <div className="deck-tools">
                <button aria-label="Move this person earlier" disabled={i === 0} onClick={() => action({ type: "move_card", cardId: c.id, direction: "up" })}>←</button>
                <button aria-label="Remove this person" onClick={() => action({ type: "remove_card", cardId: c.id })}>✕</button>
                <button aria-label="Move this person later" disabled={i === cards.length - 1} onClick={() => action({ type: "move_card", cardId: c.id, direction: "down" })}>→</button>
              </div>
            )}
          </figure>
        ))}
        {!ready && !full && (
          <button className="slot" onClick={() => fileInput.current?.click()} aria-label="Add a person">
            +
          </button>
        )}
      </div>

      {!ready && !full && (
        <div style={{ display: "grid", gap: 12, maxWidth: 460, marginBottom: 8 }}>
          <button className="btn ghost" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? "Uploading…" : cards.length === 0 ? "Add photos — tap several at once" : "Add more photos"}
          </button>
          {cards.length === 0 && (
            <p className="small dim" style={{ marginTop: -4 }}>
              In your photo picker, tap every person you want — they all come in together.
            </p>
          )}
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

      {enough && !ready && (
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
          <button
            className="btn solid"
            onClick={() => action({ type: "mark_ready", consent })}
            disabled={!consent || unnamed > 0}
          >
            {unnamed > 0
              ? `Name ${unnamed === 1 ? "the last person" : `${unnamed} more people`} to continue`
              : `My board is ready (${cards.length} people)`}
          </button>
        </div>
      )}

      {ready && (
        <p className="pill hot" role="status">
          Your deck is ready — waiting for {snap.opponent ? snap.opponent.name : "your opponent"}
        </p>
      )}

      {queue.length > 0 && (
        <CropModal
          file={queue[0]}
          index={queueTotal - queue.length}
          total={queueTotal}
          onDone={croppedDone}
          onUseAsIs={currentAsIs}
          onRestAsIs={restAsIs}
          onSkip={() => setQueue((q) => q.slice(1))}
        />
      )}
    </section>
  );
}
