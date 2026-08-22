import { NextRequest } from "next/server";
import { getUserId } from "@/lib/auth";
import { getRoom, getMembership } from "@/lib/game";
import { subscribe, type RoomEvent } from "@/lib/bus";

// Private per-room realtime channel over Server-Sent Events. Membership is
// authorized before the stream opens; events carry ids and enums only —
// clients refetch the authorized snapshot to get actual content (§10.2).

export async function GET(req: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return new Response("No session", { status: 401 });
  try {
    await getRoom(roomId);
    await getMembership(roomId, userId);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RoomEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const unsubscribe = subscribe(roomId, { userId, send });
      send({ type: "connected" });
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 25_000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-robots-tag": "noindex",
    },
  });
}
