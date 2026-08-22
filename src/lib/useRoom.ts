"use client";

import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "./snapshot";
import { api, actionKey } from "./client";

// Live room state: authorized snapshot + SSE channel + polling fallback.
// SSE gives low latency when both players hit the same server process;
// polling keeps the game moving on serverless hosts, where instances don't
// share the in-memory bus. Either way the client always converges on the
// canonical server snapshot (§10.2). Presence comes from the snapshot
// (last-seen stamps), so it works everywhere.

const POLL_MS = 3500;

export function useRoom(roomId: string) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/snapshot`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setDenied(true);
        return;
      }
      if (!res.ok) return; // transient server hiccup; next poll retries
      const data = (await res.json()) as Snapshot;
      setSnap(data);
    } catch {
      // transient network error; next poll retries
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
        const ev = JSON.parse(e.data) as { type: string };
        if (ev.type !== "connected" && ev.type !== "player.presence") refresh();
      } catch {}
    };

    const poll = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      es.close();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
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

  const oppOnline = snap?.opponent?.online ?? false;

  return { snap, error, setError, denied, oppOnline, refresh, action };
}

export type RoomApi = ReturnType<typeof useRoom>;
