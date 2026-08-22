"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "./snapshot";
import { api, actionKey } from "./client";

// Live room state: authorized snapshot + SSE channel. Events are thin
// (ids/enums only); anything content-bearing triggers a snapshot refetch,
// so the client always converges on canonical server state (§10.2).

export function useRoom(roomId: string) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [oppOnline, setOppOnline] = useState(false);
  const snapRef = useRef<Snapshot | null>(null);
  snapRef.current = snap;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/snapshot`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setDenied(true);
        return;
      }
      const data = (await res.json()) as Snapshot;
      setSnap(data);
      setError(null);
    } catch {
      // transient; SSE reconnect or next event will retry
    }
  }, [roomId]);

  useEffect(() => {
    let disposed = false;
    refresh();
    const es = new EventSource(`/api/rooms/${roomId}/events`);
    es.onopen = () => refresh();
    es.onmessage = (e) => {
      if (disposed) return;
      try {
        const ev = JSON.parse(e.data) as { type: string; online?: string[] };
        if (ev.type === "player.presence") {
          const me = snapRef.current?.me.id;
          setOppOnline((ev.online ?? []).some((id) => id !== me));
          return;
        }
        if (ev.type === "connected") return;
        refresh();
      } catch {}
    };
    return () => {
      disposed = true;
      es.close();
    };
  }, [roomId, refresh]);

  const action = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        const res = await api<{ snapshot: Snapshot }>(`/api/rooms/${roomId}/actions`, {
          ...payload,
          idempotencyKey: actionKey(),
        });
        setSnap(res.snapshot);
        setError(null);
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      }
    },
    [roomId]
  );

  return { snap, error, setError, denied, oppOnline, refresh, action };
}

export type RoomApi = ReturnType<typeof useRoom>;
