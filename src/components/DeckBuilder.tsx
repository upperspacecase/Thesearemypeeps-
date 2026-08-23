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
  // Originals stay in browser memory so tapping a photo can re-crop from the
  // full picture; after a reload the stored card image is used instead.
  const originals = useRef(new Map<string, File>());
  const [editing, setEditing] = useState<{ cardId: string; src: string; revoke: boolean; title: string } | null>(null);
  const [bust, setBust] = useState<Record<string, number>>({});
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

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = max - (snap?.me.cards.length ?? 0);
    const batch = [...files].slice(0, remaining);
    setUploading(batch.length);
    for (const [i, file] of batch.entries()) {
      try {
        const blob = await toCardImage(file);
        const form = new FormData();
        form.append("file", blob, "card.jpg");
        // No name yet — each photo gets its own name box below it.
        form.append("name", "");
        const res = await fetch(`/api/rooms/${roomId}/cards`, { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Upload failed");
        const cardId = (data as { cardId?: string }).cardId;
        if (cardId) originals.current.set(cardId, file);
      } catch (err) {
        setError((err as Error).message);
      }
      setUploading(batch.length - i - 1);
    }
    setUploading(0);
    await refresh();
  }

  function openCrop(card: { id: string; name: string; imageUrl: string }) {
    const original = originals.current.get(card.id);
    setEditing({
      cardId: card.id,
      src: original ? URL.createObjectURL(original) : card.imageUrl,
      revoke: !!original,
      title: card.name,
    });
  }

  function closeCrop() {
    if (editing?.revoke) URL.revokeObjectURL(editing.src);
    setEditing(null);
  }

  async function saveCrop(blob: Blob) {
    if (!editing) return;
    try {
      const form = new FormData();
      form.append("file", blob, "card.jpg");
      const res = await fetch(`/api/rooms/${roomId}/cards/${editing.cardId}`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Could not save the crop");
      }
      setBust((b) => ({ ...b, [editing.cardId]: Date.now() }));
      closeCrop();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
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
        A photo and a first name each — tap a photo any time to adjust its crop. Five gets you playing; more people
        make the guessing harder. Your opponent sees them only once the round starts.
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

      {cards.length === 0 && !ready ? (
        <button className="bigpick" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
          <span className="bigpick-plus" aria-hidden>+</span>
          <strong>{uploading > 0 ? "Uploading…" : `Pick your ${min}–${max} photos`}</strong>
          <span className="bigpick-sub">
            Tap every person you want in the picker — they all come in at once. Name them after, and tap any photo to
            adjust its crop.
          </span>
        </button>
      ) : (
      <div className="deck-grid" style={{ marginBottom: 24 }}>
        {cards.map((c, i) => (
          <figure key={c.id} className="pcard">
            {ready ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={c.imageUrl} alt={c.name ? `Photo of ${c.name}` : "Photo awaiting a name"} />
            ) : (
              <button
                type="button"
                className="imgbtn"
                onClick={() => openCrop(c)}
                aria-label={`Adjust the crop of ${c.name || "this photo"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bust[c.id] ? `${c.imageUrl}?v=${bust[c.id]}` : c.imageUrl}
                  alt={c.name ? `Photo of ${c.name}` : "Photo awaiting a name"}
                />
              </button>
            )}
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
      )}

      {!ready && !full && (
        <div style={{ display: "grid", gap: 12, maxWidth: 460, marginBottom: 8 }}>
          {cards.length > 0 && (
            <button className="btn ghost" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
              {uploading > 0 ? "Uploading…" : "Add more photos — tap several at once"}
            </button>
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

      {editing && <CropModal src={editing.src} title={editing.title} onSave={saveCrop} onClose={closeCrop} />}
    </section>
  );
}
