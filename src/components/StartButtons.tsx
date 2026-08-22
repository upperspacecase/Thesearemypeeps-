"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

function useCreateRoom() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(promptPolicy: "friends" | "team_safe") {
    setBusy(promptPolicy);
    setError(null);
    try {
      const { roomId, inviteToken } = await api<{ roomId: string; inviteToken: string }>("/api/rooms", { promptPolicy });
      // The invite token exists only in the creator's browser (its hash is
      // what the server stores), so keep it client-side for the share panel.
      try {
        sessionStorage.setItem(`igc_invite_${roomId}`, inviteToken);
      } catch {}
      router.push(`/room/${roomId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }
  return { create, busy, error };
}

export function StartButtons() {
  const { create, busy, error } = useCreateRoom();
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
        <button className="btn solid" onClick={() => create("friends")} disabled={busy !== null}>
          <span aria-hidden style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "6px 0 6px 10px", borderColor: "transparent transparent transparent var(--ink)" }} />
          {busy === "friends" ? "Setting up…" : "Start a game"}
        </button>
        <button className="btn ghost" onClick={() => create("team_safe")} disabled={busy !== null}>
          {busy === "team_safe" ? "Setting up…" : "Play with your team"}
        </button>
      </div>
      {error && <p className="small" style={{ marginTop: 12, color: "var(--good)" }}>{error}</p>}
    </div>
  );
}

export function CtaButton() {
  const { create, busy, error } = useCreateRoom();
  return (
    <div>
      <button className="btn solid" onClick={() => create("friends")} disabled={busy !== null}>
        <span aria-hidden style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "6px 0 6px 10px", borderColor: "transparent transparent transparent var(--ink)" }} />
        {busy ? "Setting up…" : "Create a private game"}
      </button>
      {error && <p className="small" style={{ marginTop: 12, color: "var(--good)" }}>{error}</p>}
    </div>
  );
}
