import { NextRequest, NextResponse } from "next/server";
import { ensureUser } from "@/lib/auth";
import { createRoom } from "@/lib/game";
import { sweepExpired } from "@/lib/retention";
import { rateLimit } from "@/lib/ratelimit";
import { errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    sweepExpired();
    const userId = await ensureUser();
    rateLimit(`create:${userId}`, 10, 3600_000); // 10 rooms/hour/user
    const body = await req.json().catch(() => ({}));
    const { roomId, inviteToken } = createRoom(userId, {
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      promptPolicy: typeof body.promptPolicy === "string" ? body.promptPolicy : undefined,
    });
    return NextResponse.json({ roomId, inviteToken });
  } catch (err) {
    return errorResponse(err);
  }
}
