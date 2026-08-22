import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUserId } from "@/lib/auth";
import { addCard } from "@/lib/game";
import { sniffImage, saveCardImage, deleteCardImage, MAX_IMAGE_BYTES } from "@/lib/storage";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

// Multipart card upload. The client crops/resizes to card dimensions first
// (§11.3); the server verifies magic bytes and size, stores into the private
// upload dir, then registers the card — removing the file if validation of
// the card itself fails, so no orphaned object survives (Appendix B).

export async function POST(req: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await ctx.params;
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });
    rateLimit(`upload:${userId}`, 120, 3600_000);

    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") ?? "");
    const relationship = form.get("relationship") ? String(form.get("relationship")) : undefined;
    if (!(file instanceof Blob)) return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Image too large (2 MB max)" }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(buf);
    if (!kind) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo" }, { status: 415 });

    const cardId = randomUUID();
    const storagePath = saveCardImage(cardId, buf, kind.ext);
    try {
      const card = addCard(userId, roomId, { name, relationship, storagePath });
      return NextResponse.json({ cardId: card.id, imageUrl: `/api/images/${card.id}` });
    } catch (err) {
      deleteCardImage(storagePath);
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
