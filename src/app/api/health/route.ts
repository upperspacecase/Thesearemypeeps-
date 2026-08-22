import { NextResponse } from "next/server";
import { db, storageDriver } from "@/lib/db";
import { redact } from "@/lib/api";

// Deployment diagnostics. Visit /api/health to see whether the app can reach
// its database and which driver it picked. Reports presence of configuration,
// never its values — no connection strings, no secrets.

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    databaseUrlPresent: !!(
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.DATABASE_POSTGRES_URL ??
      process.env.POSTGRES_URL_NON_POOLING
    ),
    sessionSecretSet: !!process.env.IGC_SECRET,
    serverless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
    nodeVersion: process.version,
  };

  let database: { ok: boolean; driver: string; error?: string; profiles?: number };
  try {
    const row = await db().get<{ n: unknown }>("SELECT CAST(COUNT(*) AS INT) AS n FROM profiles");
    database = {
      ok: true,
      driver: storageDriver(),
      profiles: typeof row?.n === "string" ? parseInt(row.n, 10) : ((row?.n as number) ?? 0),
    };
  } catch (err) {
    database = {
      ok: false,
      driver: storageDriver(),
      error: redact((err as Error)?.message ?? "unknown error").slice(0, 300),
    };
  }

  // A missing session secret only matters once deployed; local dev has a default.
  const ok = database.ok && (env.sessionSecretSet || !env.serverless);
  const todo = [
    !env.databaseUrlPresent && env.serverless && "Connect a Postgres database so DATABASE_URL is set",
    !env.sessionSecretSet && env.serverless && "Set IGC_SECRET to a long random string",
  ].filter(Boolean);

  return NextResponse.json(
    { ok, env, database, ...(todo.length ? { todo } : {}) },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
