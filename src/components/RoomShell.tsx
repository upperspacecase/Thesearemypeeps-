"use client";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/lib/useRoom";
import { api } from "@/lib/client";
import { SetupFlow } from "./SetupFlow";
import { SecretSelect } from "./SecretSelect";
import { PlayBoard } from "./PlayBoard";
import { Reveal } from "./Reveal";

export function RoomShell({ roomId }: { roomId: string }) {
  const room = useRoom(roomId);
  const { snap, denied, error, setError, refresh } = room;
  const [joinFailed, setJoinFailed] = useState(false);
  const tried = useRef(false);

  // Landing on a shared room link without a seat yet: take the open seat
  // rather than showing a locked door.
  useEffect(() => {
    if (!denied || tried.current) return;
    tried.current = true;
    api<{ roomId: string }>("/api/join", { roomId })
      .then(() => refresh())
      .catch(() => setJoinFailed(true));
  }, [denied, roomId, refresh]);

  if (denied && !joinFailed) {
    return (
      <main className="paper">
        <p className="dim">Joining the game…</p>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="paper">
        <div className="paper-panel">
          <p className="eyebrow">In Good Company</p>
          <h1 className="display" style={{ fontSize: 30, marginBottom: 12 }}>This room isn&rsquo;t yours to see</h1>
          <p className="dim">
            Rooms are private to their two players. If someone invited you, open their invite link. It&rsquo;s the only
            door in.
          </p>
          <a className="btn ink" href="/" style={{ marginTop: 24 }}>Go home</a>
        </div>
      </main>
    );
  }

  if (!snap) {
    return (
      <main className="paper">
        <p className="dim">Setting the table…</p>
      </main>
    );
  }

  const status = snap.room.status;
  let screen: React.ReactNode;
  if (status === "ended" || status === "expired") {
    screen = (
      <main className="paper">
        <div className="paper-panel">
          <p className="eyebrow">In Good Company</p>
          <h1 className="display" style={{ fontSize: 32, marginBottom: 12 }}>
            {status === "expired" ? "This room has expired" : "This room has closed"}
          </h1>
          <p className="dim">
            One-time rooms and their photos are deleted after the game. Thanks for bringing your people.
          </p>
          <a className="btn ink" href="/" style={{ marginTop: 26 }}>Start a new game</a>
        </div>
      </main>
    );
  } else if (status === "waiting_for_player" || status === "deck_setup") {
    screen = <SetupFlow room={room} roomId={roomId} />;
  } else if (status === "secret_selection") {
    screen = <SecretSelect room={room} />;
  } else if (status === "active") {
    screen = <PlayBoard room={room} />;
  } else {
    // completed | rematch
    screen = <Reveal room={room} />;
  }

  return (
    <>
      {screen}
      {error && (
        <div className="toast" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </>
  );
}
