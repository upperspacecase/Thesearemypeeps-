import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { buildSnapshot } from "@/lib/snapshot";
import { errorResponse } from "@/lib/api";
import { sweepExpired } from "@/lib/retention";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    sweepExpired();
    const { roomId } = await ctx.params;
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });
    return NextResponse.json(buildSnapshot(roomId, userId), {
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
