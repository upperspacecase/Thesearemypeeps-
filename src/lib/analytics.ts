import { createHash } from "node:crypto";
import { db, now } from "./db";

// Funnel analytics (PRD §15). Payloads carry an anonymized room key, mode,
// turn number and prompt id only — never names, photos, secrets, card ids,
// or free-text question content (FR-35). Fire-and-forget: analytics must
// never block or break gameplay.

export function track(
  event: string,
  ctx: { roomId?: string; mode?: string; turnNo?: number; promptId?: string } = {}
) {
  const roomKey = ctx.roomId ? createHash("sha256").update(`igc:${ctx.roomId}`).digest("hex").slice(0, 16) : null;
  db()
    .run(
      "INSERT INTO analytics_events (event, room_key, mode, turn_no, prompt_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [event, roomKey, ctx.mode ?? null, ctx.turnNo ?? null, ctx.promptId ?? null, now()]
    )
    .catch(() => {});
}
