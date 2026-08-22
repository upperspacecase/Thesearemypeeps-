// In-process realtime bus: one private channel per room, delivered to
// clients over Server-Sent Events. Postgres/SQLite stays the canonical
// state (PRD §10.2) — every event a client reacts to is persisted first,
// and reconnecting clients refetch the snapshot before subscribing.
// For multi-instance deployment, swap this module for a shared pub/sub
// (Redis, Ably, Pusher) behind the same publish/subscribe interface.

export interface RoomEvent {
  type: string;
  // Payloads are ids and enums only — never card names, photos, or secrets.
  [key: string]: unknown;
}

type Subscriber = {
  userId: string;
  send: (event: RoomEvent) => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __igcBus: Map<string, Set<Subscriber>> | undefined;
}

function channels(): Map<string, Set<Subscriber>> {
  if (!globalThis.__igcBus) globalThis.__igcBus = new Map();
  return globalThis.__igcBus;
}

export function subscribe(roomId: string, sub: Subscriber): () => void {
  const map = channels();
  let set = map.get(roomId);
  if (!set) {
    set = new Set();
    map.set(roomId, set);
  }
  set.add(sub);
  publishPresence(roomId);
  return () => {
    set!.delete(sub);
    if (set!.size === 0) map.delete(roomId);
    publishPresence(roomId);
  };
}

/**
 * Publish to everyone in the room, or — when `only` is set — to that user's
 * connections alone (used for actor-private events like cards.eliminated).
 */
export function publish(roomId: string, event: RoomEvent, only?: string) {
  const set = channels().get(roomId);
  if (!set) return;
  for (const sub of set) {
    if (only && sub.userId !== only) continue;
    try {
      sub.send(event);
    } catch {
      set.delete(sub);
    }
  }
}

export function onlineUsers(roomId: string): string[] {
  const set = channels().get(roomId);
  if (!set) return [];
  return [...new Set([...set].map((s) => s.userId))];
}

function publishPresence(roomId: string) {
  publish(roomId, { type: "player.presence", online: onlineUsers(roomId) });
}
