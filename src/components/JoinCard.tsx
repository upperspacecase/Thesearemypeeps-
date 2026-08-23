"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

// Tapping an invite link joins immediately — no account, no name gate, no
// manual code. Your name is the first step of setup instead.

export function JoinCard({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { roomId } = await api<{ roomId: string }>("/api/join", { token });
        router.replace(`/room/${roomId}`);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [token, router]);

  return (
    <div className="paper-panel" style={{ textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-mark" src="/logo.png" alt="" width={900} height={821} />
      <p className="paper-brand">In Good Company</p>
      {error ? (
        <>
          <h1 className="paper-h">This invite isn&rsquo;t working</h1>
          <p className="paper-p">{error}</p>
          <a className="btn ink" href="/" style={{ marginTop: 18 }}>Start your own game</a>
        </>
      ) : (
        <>
          <h1 className="paper-h">Joining the game…</h1>
          <p className="paper-p">A private two-player game. You&rsquo;ll bring 5&ndash;15 photos of your people.</p>
        </>
      )}
    </div>
  );
}
