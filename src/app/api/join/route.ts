import { NextRequest, NextResponse } from "next/server";
import { ensureUser } from "@/lib/auth";
import { joinByToken, peekInvite } from "@/lib/game";
import { errorResponse } from "@/lib/api";
import { sweepExpired } from "@/lib/retention";
import { rateLimit } from "@/lib/ratelimit";
import { track } from "@/lib/analytics";

// GET /api/join?token=… — invite preview (no membership created)
export async function GET(req: NextRequest) {
  try {
    await sweepExpired();
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const info = await peekInvite(token);
    track("invite_opened", { roomId: info.roomId });
    return NextResponse.json(info);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/join {token, displayName} — exchange token for membership
export async function POST(req: NextRequest) {
  try {
    const userId = await ensureUser();
    rateLimit(`join:${userId}`, 30, 3600_000);
    const body = await req.json().catch(() => ({}));
    if (typeof body.token !== "string") return NextResponse.json({ error: "Missing token" }, { status: 400 });
    track("join_started", {});
    const { roomId } = await joinByToken(
      userId,
      body.token,
      typeof body.displayName === "string" ? body.displayName : undefined
    );
    return NextResponse.json({ roomId });
  } catch (err) {
    return errorResponse(err);
  }
}
