import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { addCard } from "@/lib/game";
import { sniffImage, MAX_IMAGE_BYTES } from "@/lib/storage";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

// Multipart card upload. The client crops/resizes to card dimensions first
// (§11.3); the server verifies magic bytes and size, then stores the card
// row and image bytes in one transaction — no orphaned object can survive.

export async function POST(req: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await ctx.params;
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });
    rateLimit(`upload:${userId}`, 120, 3600_000);

    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") ?? "");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Image too large (2 MB max)" }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo" }, { status: 415 });

    const card = await addCard(userId, roomId, { name, image: { bytes, mime: kind.mime } });
    return NextResponse.json({ cardId: card.id, imageUrl: `/api/images/${card.id}` });
  } catch (err) {
    return errorResponse(err);
  }
}
