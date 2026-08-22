import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, now } from "./db";

// Anonymous identity: a server-issued UUID in a signed, HTTP-only cookie.
// No sign-up, no client-readable identity, no third-party auth service.

const COOKIE = "igc_uid";
const SECRET = process.env.IGC_SECRET ?? "dev-secret-change-in-production";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

function verify(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const value = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(value);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

/** Read the current user id without creating one. */
export async function getUserId(): Promise<string | null> {
  const jar = await cookies();
  const uid = verify(jar.get(COOKIE)?.value);
  if (!uid) return null;
  const row = db().prepare("SELECT id FROM profiles WHERE id = ?").get(uid);
  return row ? uid : null;
}

/**
 * Get or create the anonymous user. Only call from Route Handlers or Server
 * Actions — those are the places Next.js allows cookie writes.
 */
export async function ensureUser(): Promise<string> {
  const jar = await cookies();
  const existing = verify(jar.get(COOKIE)?.value);
  if (existing) {
    const row = db().prepare("SELECT id FROM profiles WHERE id = ?").get(existing);
    if (row) return existing;
  }
  const id = randomUUID();
  db()
    .prepare("INSERT INTO profiles (id, display_name, is_anonymous, created_at, updated_at) VALUES (?, '', 1, ?, ?)")
    .run(id, now(), now());
  jar.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return id;
}
