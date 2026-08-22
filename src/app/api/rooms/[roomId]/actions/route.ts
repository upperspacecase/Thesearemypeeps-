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
    sweepExpired();
    const { roomId } = await ctx.params;
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "No session" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const type = String(body.type ?? "");

    if (typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0) {
      try {
        db()
          .prepare("INSERT INTO processed_actions (idempotency_key, room_id, created_at) VALUES (?, ?, ?)")
          .run(`${userId}:${body.idempotencyKey}`, roomId, now());
      } catch {
        // Already processed: return canonical state, apply nothing.
        return NextResponse.json({ ok: true, duplicate: true, snapshot: buildSnapshot(roomId, userId) });
      }
    }

    switch (type) {
      case "set_display_name":
        game.setDisplayName(userId, roomId, String(body.name ?? ""));
        break;
      case "remove_card":
        game.removeCard(userId, roomId, String(body.cardId ?? ""));
        break;
      case "rename_card":
        game.renameCard(userId, roomId, String(body.cardId ?? ""), String(body.name ?? ""), body.relationship);
        break;
      case "move_card":
        game.moveCard(userId, roomId, String(body.cardId ?? ""), body.direction === "up" ? "up" : "down");
        break;
      case "mark_ready":
        game.markReady(userId, roomId, body.consent === true);
        break;
      case "select_secret":
        game.selectSecret(userId, roomId, String(body.cardId ?? ""));
        break;
      case "ask_question":
        game.askQuestion(userId, roomId, String(body.text ?? ""), typeof body.promptId === "string" ? body.promptId : undefined);
        break;
      case "answer_question":
        game.answerQuestion(userId, roomId, String(body.questionId ?? ""), String(body.answer ?? ""));
        break;
      case "set_elimination":
        game.setElimination(userId, roomId, String(body.cardId ?? ""), body.eliminated !== false);
        break;
      case "submit_guess":
        game.submitGuess(userId, roomId, String(body.cardId ?? ""));
        break;
      case "request_rematch":
        game.requestRematch(userId, roomId);
        break;
      case "report_outcome":
        game.reportOutcome(userId, roomId, body.learned === true);
        break;
      case "delete_deck":
        game.deleteDeck(userId, roomId);
        break;
      case "end_room":
        game.endRoom(userId, roomId);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, snapshot: buildSnapshot(roomId, userId) });
  } catch (err) {
    return errorResponse(err);
  }
}
