import { db, now, type PersonCardRow } from "./db";
import { deleteCardImage } from "./storage";

// Retention (PRD §13.2): one-time rooms and decks are removed 24h after
// completion or expiry. The sweep is idempotent and storage-first-safe:
// image files are deleted before rows, so a crashed sweep re-runs cleanly.
// Runs opportunistically on API traffic — no separate worker to deploy —
// and at most once per minute per process.

let lastSweep = 0;

export function sweepExpired() {
  const t = Date.now();
  if (t - lastSweep < 60_000) return;
  lastSweep = t;

  const doomed = db()
    .prepare("SELECT id FROM rooms WHERE expires_at < ?")
    .all(new Date(t - 0).toISOString()) as { id: string }[];

  for (const { id } of doomed) {
    try {
      const cards = db()
        .prepare(
          "SELECT pc.* FROM person_cards pc JOIN decks d ON d.id = pc.deck_id WHERE d.room_id = ?"
        )
        .all(id) as PersonCardRow[];
      for (const c of cards) deleteCardImage(c.storage_path);
      db().transaction(() => {
        db().prepare("DELETE FROM processed_actions WHERE room_id = ?").run(id);
        db().prepare("DELETE FROM rooms WHERE id = ?").run(id); // cascades players/decks/cards/rounds/…
      })();
    } catch (err) {
      // A failed storage deletion must not be treated as success (§14):
      // leaving the row means the next sweep retries this room.
      console.error("retention sweep failed", { roomId: id, error: (err as Error).message, at: now() });
    }
  }
}
