import { NextResponse } from "next/server";
import { GameError } from "./game";

export function errorResponse(err: unknown) {
  if (err instanceof GameError) return NextResponse.json({ error: err.message }, { status: err.status });
  // Room-safe logging: message only, never payload content (§14 observability).
  console.error("api error", (err as Error)?.message);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
