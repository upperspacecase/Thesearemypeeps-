import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import * as game from "@/lib/game";
import { buildSnapshot } from "@/lib/snapshot";
import { errorResponse } from "@/lib/api";
import { sweepExpired } from "@/lib/retention";

// Single mutation dispatcher. Every action names its type, may carry an
// idempotency key (duplicates return the current snapshot unchanged, §10.2),
// and is validated server-side in src/lib/game.ts before any write.

export async function POST(req: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  try {
    await sweepExpired();
    const { roomId } = await ctx.params;
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const type = String(body.type ?? "");

    if (typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0) {
      try {
        await db().run("INSERT INTO processed_actions (idempotency_key, room_id, created_at) VALUES (?, ?, ?)", [
          `${userId}:${body.idempotencyKey}`,
          roomId,
          now(),
        ]);
      } catch {
        // Already processed: return canonical state, apply nothing.
        return NextResponse.json({ ok: true, duplicate: true, snapshot: await buildSnapshot(roomId, userId) });
      }
    }

    switch (type) {
      case "set_display_name":
        await game.setDisplayName(userId, roomId, String(body.name ?? ""));
        break;
      case "remove_card":
        await game.removeCard(userId, roomId, String(body.cardId ?? ""));
        break;
      case "rename_card":
        await game.renameCard(userId, roomId, String(body.cardId ?? ""), String(body.name ?? ""), body.relationship);
        break;
      case "move_card":
        await game.moveCard(userId, roomId, String(body.cardId ?? ""), body.direction === "up" ? "up" : "down");
        break;
      case "mark_ready":
        await game.markReady(userId, roomId, body.consent === true);
        break;
      case "select_secret":
        await game.selectSecret(userId, roomId, String(body.cardId ?? ""));
        break;
      case "ask_question":
        await game.askQuestion(
          userId,
          roomId,
          String(body.text ?? ""),
          typeof body.promptId === "string" ? body.promptId : undefined
        );
        break;
      case "answer_question":
        await game.answerQuestion(userId, roomId, String(body.questionId ?? ""), String(body.answer ?? ""));
        break;
      case "set_elimination":
        await game.setElimination(userId, roomId, String(body.cardId ?? ""), body.eliminated !== false);
        break;
      case "submit_guess":
        await game.submitGuess(userId, roomId, String(body.cardId ?? ""));
        break;
      case "request_rematch":
        await game.requestRematch(userId, roomId);
        break;
      case "report_outcome":
        await game.reportOutcome(userId, roomId, body.learned === true);
        break;
      case "delete_deck":
        await game.deleteDeck(userId, roomId);
        break;
      case "end_room":
        await game.endRoom(userId, roomId);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(roomId, userId) });
  } catch (err) {
    return errorResponse(err);
  }
}
