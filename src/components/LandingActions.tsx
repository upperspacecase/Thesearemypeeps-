"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function LandingActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [link, setLink] = useState("");
  const [showHowTo, setShowHowTo] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { roomId, inviteToken } = await api<{ roomId: string; inviteToken: string }>("/api/rooms", {
        promptPolicy: "friends",
      });
      try {
        sessionStorage.setItem(`igc_invite_${roomId}`, inviteToken);
        localStorage.setItem(`igc_invite_${roomId}`, inviteToken);
      } catch {}
      router.push(`/room/${roomId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function join() {
    const raw = link.trim();
    if (!raw) return;
    const fromLink = raw.match(/\/r\/([A-Za-z0-9_-]+)/);
    const fromRoom = raw.match(/\/room\/([0-9a-fA-F-]{36})/);
    if (fromRoom) {
      router.push(`/room/${fromRoom[1]}`);
      return;
    }
    const token = fromLink ? fromLink[1] : raw.replace(/[^A-Za-z0-9_-]/g, "");
    if (!token) {
      setError("That doesn't look like a code or a link");
      return;
    }
    // codes are read aloud, so accept them in any case
    router.push(`/r/${token.length <= 8 ? token.toUpperCase() : token}`);
  }

  return (
    <div className="landing-actions">
      <button className="btn ink" onClick={start} disabled={busy}>
        {busy ? "Setting up…" : "Start a game"}
      </button>
      {!joining ? (
        <button className="btn paperline" onClick={() => setJoining(true)}>Join a game</button>
      ) : (
        <div className="join-box">
          <label className="join-label" htmlFor="join-code">Enter their code</label>
          <div className="join-row">
            <input
              id="join-code"
              className="join-field code-input"
              placeholder="ABCD"
              value={link}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              aria-label="Room code or invite link"
            />
            <button className="btn ink sm" onClick={join} disabled={!link.trim()}>Go</button>
          </div>
          <p className="join-hint">Or paste the link they sent you.</p>
        </div>
      )}
      <button className="btn paperline" onClick={() => setShowHowTo(true)}>How to play</button>
      {error && <p className="small" style={{ color: "var(--warn)" }}>{error}</p>}

      {showHowTo && (
        <div className="zoom-backdrop" role="dialog" aria-modal="true" aria-label="How to play" onClick={() => setShowHowTo(false)}>
          <div className="zoom-card fade-in howto" onClick={(e) => e.stopPropagation()}>
            <button className="howto-close" onClick={() => setShowHowTo(false)} aria-label="Close">✕</button>
            <h2>How to play</h2>
            <p className="howto-sub">Find the person they picked. The talking is up to you.</p>
            <ul>
              <li>You each bring 5–15 photos of your people. Everyone lands on one shared board.</li>
              <li>Each of you secretly picks one person — anyone on the board.</li>
              <li>Ask yes-or-no questions <strong>out loud</strong> — nothing goes through the app.</li>
              <li><span className="mech-arrow" aria-hidden>←</span> Swipe a card left when it&rsquo;s not them. Tap anyone to look closer, and guess when you&rsquo;re sure.</li>
            </ul>
            <button className="btn solid" onClick={() => setShowHowTo(false)} style={{ marginTop: 6 }}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
