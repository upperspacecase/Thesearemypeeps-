import { NextResponse } from "next/server";
import { GameError } from "./game";
import { ConfigError } from "./db";

/** Never let a connection string (or its password) reach a client or a log. */
export function redact(text: string): string {
  return text
    .replace(/[a-z]+:\/\/[^\s"']*/gi, "[connection string]")
    .replace(/password[=: ]\S+/gi, "password=[redacted]");
}

export function errorResponse(err: unknown) {
  if (err instanceof GameError) return NextResponse.json({ error: err.message }, { status: err.status });

  // A misconfigured deployment: say what to fix instead of "something went wrong".
  if (err instanceof ConfigError) {
    console.error("config error", redact(err.message));
    return NextResponse.json({ error: err.message, code: "not_configured" }, { status: 503 });
  }

  // Unexpected: surface a redacted summary so the operator can act on it, and
  // point at the diagnostics endpoint. Never include payload content (§14).
  const detail = redact((err as Error)?.message ?? "unknown error").slice(0, 200);
  console.error("api error", detail);
  return NextResponse.json(
    { error: `Something went wrong: ${detail}`, code: "server_error", diagnostics: "/api/health" },
    { status: 500 }
  );
}
