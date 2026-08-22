import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { db, type PersonCardRow, type DeckRow, type RoomRow } from "@/lib/db";
import { readCardImage } from "@/lib/storage";

// Authorized image serving — the only path to a photo. Owners see their own
// cards any time; the opponent sees them only while both are members of the
// room AND the board is meant to be visible (active or completed round).
// There are no public or signed URLs to leak (§11.3, Appendix B).

export async function GET(_req: NextRequest, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  const card = db().prepare("SELECT * FROM person_cards WHERE id = ?").get(cardId) as PersonCardRow | undefined;
  if (!card) return new NextResponse(null, { status: 404 });
  const deck = db().prepare("SELECT * FROM decks WHERE id = ?").get(card.deck_id) as DeckRow | undefined;
  if (!deck || deck.status === "deleted") return new NextResponse(null, { status: 404 });

  let allowed = deck.owner_id === userId;
  if (!allowed) {
    const member = db()
      .prepare("SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?")
      .get(deck.room_id, userId);
    const room = db().prepare("SELECT * FROM rooms WHERE id = ?").get(deck.room_id) as RoomRow | undefined;
    allowed = !!member && !!room && ["active", "completed", "rematch"].includes(room.status);
  }
  if (!allowed) return new NextResponse(null, { status: 403 });

  const img = readCardImage(card.storage_path);
  if (!img) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(img.buf), {
    headers: {
      "content-type": img.mime,
      "cache-control": "private, max-age=300",
      "x-robots-tag": "noindex",
    },
  });
}
