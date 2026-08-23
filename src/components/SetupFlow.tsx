"use client";

import { useRef, useState } from "react";
import type { RoomApi } from "@/lib/useRoom";
import { toCardImage } from "@/lib/client";
import { CropModal } from "./CropModal";

// The pre-game flow, party-game style:
//   Start → Invite your person → both build privately → ready lobby → host starts.
// Guided on purpose: one big photo pick, then name people one at a time with
// one large photo and one field — easier on a phone than a grid of inputs.

export function SetupFlow({ room, roomId }: { room: RoomApi; roomId: string }) {
  const { snap, action, refresh, setError } = room;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const originals = useRef(new Map<string, File>());
  const [editing, setEditing] = useState<{ cardId: string; src: string; revoke: boolean; title: string } | null>(null);
  const [bust, setBust] = useState<Record<string, number>>({});
  const [invited, setInvited] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`igc_invited_${roomId}`) === "1";
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);
  const [wizardName, setWizardName] = useState("");
  const [myName, setMyName] = useState("");

  if (!snap) return null;
  const min = snap.room.deckMin;
  const max = snap.room.deckMax;
  const cards = snap.me.cards;
  const ready = snap.me.ready;
  const isHost = snap.room.hostId === snap.me.id;
  const opp = snap.opponent;
  const needsName = !snap.me.name || snap.me.name === "Player";
  const unnamed = cards.filter((c) => !c.name.trim());
  const currentCard = unnamed[0];
  const bothReady = !!(ready && opp?.ready);

  const inviteUrl = (() => {
    try {
      const token = sessionStorage.getItem(`igc_invite_${roomId}`);
      return token ? `${location.origin}/r/${token}` : null;
    } catch {
      return null;
    }
  })();

  function doneInviting() {
    setInvited(true);
    try {
      sessionStorage.setItem(`igc_invited_${roomId}`, "1");
    } catch {}
  }

  async function share() {
    const url = inviteUrl ?? (snap!.room.joinCode ? `${location.origin}/r/${snap!.room.joinCode}` : null);
    if (!url) return;
    try {
      await navigator.share({ title: "In Good Company", text: "Play a game with me — bring photos of your people.", url });
      doneInviting();
    } catch {
      // user dismissed the sheet, or no share support — copy instead
      copy();
    }
  }
  async function copy() {
    const url = inviteUrl ?? (snap!.room.joinCode ? `${location.origin}/r/${snap!.room.joinCode}` : null);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      doneInviting();
    } catch {}
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const batch = [...files].slice(0, max - cards.length);
    setUploading(batch.length);
    for (const [i, file] of batch.entries()) {
      try {
        const blob = await toCardImage(file);
        const form = new FormData();
        form.append("file", blob, "card.jpg");
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

  async function nextWizard() {
    if (!currentCard || !wizardName.trim()) return;
    await action({ type: "rename_card", cardId: currentCard.id, name: wizardName.trim() });
    setWizardName("");
  }

  // ---- which screen of the flow are we on? ----
  let body: React.ReactNode;

  if (isHost && !opp && !invited) {
    // 1. invite comes before anything else
    body = (
      <>
        <h1 className="paper-h">Invite your person</h1>
        <p className="paper-p">This game needs exactly one other player. Send them your private link — they tap it and start building right away.</p>
        <div className="landing-actions" style={{ margin: "22px auto 8px" }}>
          <button className="btn ink" onClick={share}>Invite your person</button>
          <button className="btn paperline" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
        </div>
        {snap.room.joinCode && (
          <p className="paper-p small-note">
            Can&rsquo;t share the link? They can enter code <strong className="code">{snap.room.joinCode}</strong> under
            &ldquo;Join a game&rdquo;.
          </p>
        )}
        <button className="paper-skip" onClick={doneInviting}>I&rsquo;ll build my board first →</button>
      </>
    );
  } else if (needsName && !ready) {
    // 2. your name — one field
    body = (
      <>
        <h1 className="paper-h">First — your name</h1>
        <p className="paper-p">Just so {opp?.name ?? "the other player"} knows who they&rsquo;re playing.</p>
        <div className="wizard-box">
          <input
            className="paper-field"
            placeholder="Your first name"
            value={myName}
            maxLength={40}
            autoFocus
            onChange={(e) => setMyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && myName.trim() && action({ type: "set_display_name", name: myName.trim() })}
          />
          <button className="btn ink" disabled={!myName.trim()} onClick={() => action({ type: "set_display_name", name: myName.trim() })}>
            Next
          </button>
        </div>
      </>
    );
  } else if (cards.length === 0 && !ready) {
    // 3. pick all the photos at once
    body = (
      <>
        <h1 className="paper-h">Bring your people</h1>
        <p className="paper-p">Pick 5 to 15 photos from your camera roll — tap several at once in the picker. You&rsquo;ll name each person next.</p>
        <button className="bigpick onpaper" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
          <span className="bigpick-plus" aria-hidden>+</span>
          <strong>{uploading > 0 ? `Uploading ${uploading}…` : "Pick your photos"}</strong>
        </button>
        <p className="paper-p small-note">Only adults whose photos you have permission to share. Photos are cropped on your phone and deleted after the game.</p>
      </>
    );
  } else if (currentCard && !ready) {
    // 4. name them one at a time: one large photo, one field, Next
    const done = cards.length - unnamed.length;
    body = (
      <>
        <p className="paper-count">{done + 1} of {cards.length}</p>
        <h1 className="paper-h">Who&rsquo;s this?</h1>
        <div className="wizard-photo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="wizard-photo"
            src={bust[currentCard.id] ? `${currentCard.imageUrl}?v=${bust[currentCard.id]}` : currentCard.imageUrl}
            alt="Person to name"
          />
          <button className="paper-skip" onClick={() => openCrop(currentCard)}>Adjust crop</button>
        </div>
        <div className="wizard-box">
          <input
            key={currentCard.id}
            className="paper-field"
            placeholder="First name"
            value={wizardName}
            maxLength={30}
            autoFocus
            onChange={(e) => setWizardName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nextWizard()}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn ink" disabled={!wizardName.trim()} onClick={nextWizard}>Next</button>
            <button className="btn paperline sm" onClick={() => action({ type: "remove_card", cardId: currentCard.id })}>Remove photo</button>
          </div>
        </div>
      </>
    );
  } else {
    // 5. lobby: review board, ready up, host starts
    body = (
      <LobbyView
        room={room}
        roomId={roomId}
        openCrop={openCrop}
        bust={bust}
        onAddMore={() => fileInput.current?.click()}
        onInvite={share}
        uploading={uploading}
      />
    );
  }

  return (
    <main className="paper paper-page">
      <div className="paper-panel">
        <p className="paper-brand">In Good Company</p>
        {body}
      </div>
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
      {editing && <CropModal src={editing.src} title={editing.title} onSave={saveCrop} onClose={closeCrop} />}
      {isHost && !opp && invited && cards.length > 0 && !bothReady && (
        <p className="paper-float-invite">
          Waiting for your person — <button onClick={share}>invite again</button>
          {snap.room.joinCode && <> or code <strong className="code">{snap.room.joinCode}</strong></>}
        </p>
      )}
    </main>
  );
}

function LobbyView({
  room,
  roomId,
  openCrop,
  bust,
  onAddMore,
  onInvite,
  uploading,
}: {
  room: RoomApi;
  roomId: string;
  openCrop: (c: { id: string; name: string; imageUrl: string }) => void;
  bust: Record<string, number>;
  onAddMore: () => void;
  onInvite: () => void;
  uploading: number;
}) {
  const { snap, action } = room;
  const [consent, setConsent] = useState(false);
  if (!snap) return null;
  const min = snap.room.deckMin;
  const max = snap.room.deckMax;
  const cards = snap.me.cards;
  const ready = snap.me.ready;
  const isHost = snap.room.hostId === snap.me.id;
  const opp = snap.opponent;
  const enough = cards.length >= min;
  const bothReady = !!(ready && opp?.ready);

  const oppStatus = !opp
    ? "Waiting for them to tap your invite"
    : opp.ready
      ? "Ready"
      : opp.deckCount === 0
        ? "Just joined"
        : opp.deckCount < min
          ? `Adding people, ${opp.deckCount} of ${min}`
          : `Adding people, ${opp.deckCount} added`;

  return (
    <>
      <h1 className="paper-h">{ready ? "Ready to play" : "Your board"}</h1>

      <div className="lobby-list">
        <div className="lobby-row">
          <span className="who">You</span>
          <span className={`state ${ready ? "on" : ""}`}>
            {ready ? "Ready" : enough ? `${cards.length} people` : `Adding people, ${cards.length} of ${min}`}
          </span>
        </div>
        <div className="lobby-row">
          <span className="who">{opp?.name ?? "Your person"}</span>
          <span className={`state ${opp?.ready ? "on" : ""}`}>{oppStatus}</span>
        </div>
      </div>

      {!ready && (
        <>
          <div className="paper-grid">
            {cards.map((c) => (
              <figure key={c.id} className="pcard">
                <button type="button" className="imgbtn" onClick={() => openCrop(c)} aria-label={`Adjust ${c.name}'s photo`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bust[c.id] ? `${c.imageUrl}?v=${bust[c.id]}` : c.imageUrl} alt={`Photo of ${c.name}`} />
                </button>
                <figcaption className="nm">{c.name}</figcaption>
                <div className="deck-tools">
                  <button aria-label={`Remove ${c.name}`} onClick={() => action({ type: "remove_card", cardId: c.id })}>✕</button>
                </div>
              </figure>
            ))}
            {cards.length < max && (
              <button className="slot onpaper" onClick={onAddMore} aria-label="Add more people" disabled={uploading > 0}>
                +
              </button>
            )}
          </div>
          <label className="paper-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I have permission to share these photos in this private game, and everyone shown is an adult. They&rsquo;re
              deleted 24 hours after the game.
            </span>
          </label>
          <button
            className="btn ink"
            style={{ width: "100%" }}
            disabled={!consent || !enough}
            onClick={() => action({ type: "mark_ready", consent })}
          >
            {enough ? `I'm ready (${cards.length} people)` : `Add ${min - cards.length} more to play`}
          </button>
        </>
      )}

      {ready &&
        (isHost ? (
          <button className="btn ink" style={{ width: "100%" }} disabled={!bothReady} onClick={() => action({ type: "start_game" })}>
            {bothReady ? "Start game" : `Waiting for ${opp?.name ?? "your person"}…`}
          </button>
        ) : (
          <p className="paper-p" style={{ textAlign: "center" }}>
            {bothReady ? `Waiting for ${opp?.name ?? "the host"} to start the game…` : `Waiting for ${opp?.name ?? "your person"} to finish…`}
          </p>
        ))}
      {!opp && ready && (
        <button className="btn paperline" style={{ width: "100%", marginTop: 10 }} onClick={onInvite}>
          Invite your person
        </button>
      )}
    </>
  );
}
