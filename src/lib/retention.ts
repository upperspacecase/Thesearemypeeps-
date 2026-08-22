import { db, now } from "./db";

// Retention (PRD §13.2): one-time rooms and decks are removed 24h after
// completion or expiry. Photos live in the database, so deleting the room
// row cascades players → decks → cards → images in one transaction — the
// sweep is idempotent by construction. Runs opportunistically on API
// traffic (no separate worker), at most once per minute per process.

let lastSweep = 0;

export async function sweepExpired() {
  const t = Date.now();
  if (t - lastSweep < 60_000) return;
  lastSweep = t;
  try {
    const doomed = await db().all<{ id: string }>("SELECT id FROM rooms WHERE expires_at < ?", [
      new Date(t).toISOString(),
    ]);
    for (const { id } of doomed) {
      await db().tx(async (x) => {
        await x.run("DELETE FROM processed_actions WHERE room_id = ?", [id]);
        await x.run("DELETE FROM rooms WHERE id = ?", [id]);
      });
    }
  } catch (err) {
    // Room-safe logging only; the next sweep retries anything left behind.
    console.error("retention sweep failed", { error: (err as Error).message, at: now() });
  }
}
