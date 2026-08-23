import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { replaceCardImage } from "@/lib/game";
import { sniffImage, MAX_IMAGE_BYTES } from "@/lib/storage";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

// Replace one card's photo with a re-cropped version (owner only, while the
// deck is still being built). Same validation as the original upload.

export async function POST(req: NextRequest, ctx: { params: Promise<{ roomId: string; cardId: string }> }) {
  try {
    const { roomId, cardId } = await ctx.params;
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });
    rateLimit(`upload:${userId}`, 120, 3600_000);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Image too large (2 MB max)" }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo" }, { status: 415 });

    await replaceCardImage(userId, roomId, cardId, { bytes, mime: kind.mime });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
