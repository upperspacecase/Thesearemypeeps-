import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { db, type PersonCardRow, type DeckRow, type RoomRow } from "@/lib/db";

// Authorized image serving — the only path to a photo. Owners see their own
// cards any time; the opponent sees them only while both are members of the
// room AND the board is meant to be visible (active or completed round).
// There are no public or signed URLs to leak (§11.3, Appendix B).

export async function GET(_req: NextRequest, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  const card = await db().get<PersonCardRow>("SELECT * FROM person_cards WHERE id = ?", [cardId]);
  if (!card) return new NextResponse(null, { status: 404 });
  const deck = await db().get<DeckRow>("SELECT * FROM decks WHERE id = ?", [card.deck_id]);
  if (!deck || deck.status === "deleted") return new NextResponse(null, { status: 404 });

  let allowed = deck.owner_id === userId;
  if (!allowed) {
    const member = await db().get("SELECT 1 AS x FROM room_players WHERE room_id = ? AND user_id = ?", [
      deck.room_id,
      userId,
    ]);
    const room = await db().get<RoomRow>("SELECT * FROM rooms WHERE id = ?", [deck.room_id]);
    // The shared board (both decks) is visible from secret selection onward.
    allowed = !!member && !!room && ["secret_selection", "active", "completed", "rematch"].includes(room.status);
  }
  if (!allowed) return new NextResponse(null, { status: 403 });

  const img = await db().get<{ mime: string; bytes: Buffer | Uint8Array }>(
    "SELECT mime, bytes FROM card_images WHERE card_id = ?",
    [cardId]
  );
  if (!img) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(img.bytes), {
    headers: {
      "content-type": img.mime,
      "cache-control": "private, max-age=300",
      "x-robots-tag": "noindex",
    },
  });
}
