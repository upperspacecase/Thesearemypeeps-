"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

interface InviteInfo {
  roomId: string;
  hostName: string;
  promptPolicy: "friends" | "team_safe";
  status: string;
  joinable: boolean;
  expiresAt: string;
}

export function JoinCard({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<InviteInfo>(`/api/join?token=${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch((err) => setError((err as Error).message));
  }, [token]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { roomId } = await api<{ roomId: string }>("/api/join", { token, displayName: name });
      router.push(`/room/${roomId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (error && !info) {
    return (
      <div className="panel fade-in" style={{ width: "min(480px,100%)", textAlign: "center" }}>
        <p className="eyebrow">In Good Company</p>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 12 }}>This link isn&rsquo;t working</h1>
        <p className="dim">{error}</p>
        <a className="btn ghost" href="/" style={{ marginTop: 24 }}>Start your own game</a>
      </div>
    );
  }
  if (!info) {
    return <p className="dim">Opening your invite…</p>;
  }

  return (
    <div className="panel fade-in" style={{ width: "min(520px,100%)" }}>
      <p className="eyebrow">In Good Company</p>
      <h1 className="display" style={{ fontSize: "clamp(28px,5vw,38px)", marginBottom: 14 }}>
        {info.hostName} wants to play.
      </h1>
      <p className="dim" style={{ marginBottom: 8 }}>
        A private two-player guessing game made from the real people in your lives. Expect 10–20 minutes, played beside
        your call or in the same room.
      </p>
      <p className="notice" style={{ margin: "18px 0 26px" }}>
        You&rsquo;ll each upload 12 photos. Only the two of you can see them, and everything is deleted 24 hours after
        the game — or sooner if you delete it yourself.
      </p>

      <label className="lbl" htmlFor="join-name">Your first name</label>
      <input
        id="join-name"
        className="field"
        placeholder="How should they see you?"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && join()}
      />
      {error && <p className="small" style={{ marginTop: 10, color: "var(--good)" }}>{error}</p>}
      <button className="btn solid" style={{ marginTop: 18, width: "100%" }} onClick={join} disabled={busy || !name.trim()}>
        {busy ? "Joining…" : "Join the game"}
      </button>
    </div>
  );
}
