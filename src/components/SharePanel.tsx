"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { RoomApi } from "@/lib/useRoom";

export function SharePanel({ room, roomId }: { room: RoomApi; roomId: string }) {
  const { snap, oppOnline } = room;
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const token = sessionStorage.getItem(`igc_invite_${roomId}`);
      if (token) setInviteUrl(`${location.origin}/r/${token}`);
    } catch {}
  }, [roomId]);

  useEffect(() => {
    if (inviteUrl) QRCode.toDataURL(inviteUrl, { margin: 1, width: 220 }).then(setQr).catch(() => {});
  }, [inviteUrl]);

  if (!snap) return null;
  const isHost = snap.room.hostId === snap.me.id;
  const hasOpponent = !!snap.opponent;

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function share() {
    if (!inviteUrl) return;
    try {
      await navigator.share({ title: "In Good Company", text: "One private link. No download. Bring 12 people.", url: inviteUrl });
    } catch {}
  }

  return (
    <section className="panel fade-in" style={{ marginBottom: 28 }}>
      <p className="eyebrow">Your room</p>
      {hasOpponent ? (
        <p>
          <span className="pill">
            <span className={`dot ${oppOnline ? "on" : ""}`} aria-hidden />
            {snap.opponent!.name} {oppOnline ? "is here" : "stepped away"} ·{" "}
            {snap.opponent!.ready ? "deck ready" : `building their deck (${snap.opponent!.deckCount} so far)`}
          </span>
        </p>
      ) : isHost ? (
        <>
          <h2 className="display" style={{ fontSize: 26, marginBottom: 10 }}>Send one link</h2>
          <p className="dim small" style={{ maxWidth: "48ch", marginBottom: 16 }}>
            Keep your call open — this game works in another tab or on your phone. Your opponent joins from this link and
            builds their own deck.
          </p>
          {inviteUrl ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <button className="btn solid sm" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
              {"share" in navigator && (
                <button className="btn ghost sm" onClick={share}>Share…</button>
              )}
              {qr && (
                <details>
                  <summary className="btn ghost sm" style={{ listStyle: "none", cursor: "pointer" }}>QR code</summary>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR code for your invite link" style={{ marginTop: 12, borderRadius: 12 }} />
                </details>
              )}
            </div>
          ) : (
            <p className="notice">
              The invite link lives in the browser that created this room. Create a new room if you no longer have it.
            </p>
          )}
        </>
      ) : (
        <p className="dim">Waiting for the host…</p>
      )}
    </section>
  );
}
