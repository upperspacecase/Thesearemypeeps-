import { createHash, randomBytes } from "node:crypto";

// Invite links carry a high-entropy token; only its hash is stored, so a
// database read never yields a joinable link (PRD §11.2, FR-02/FR-05).

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
