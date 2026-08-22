import { GameError } from "./game";

// Minimal in-process rate limiting for room creation, joins, and uploads
// (PRD §14 abuse controls). Swap for a shared store when scaling out.

declare global {
  // eslint-disable-next-line no-var
  var __igcRates: Map<string, number[]> | undefined;
}

export function rateLimit(key: string, max: number, windowMs: number) {
  if (!globalThis.__igcRates) globalThis.__igcRates = new Map();
  const nowMs = Date.now();
  const hits = (globalThis.__igcRates.get(key) ?? []).filter((t) => nowMs - t < windowMs);
  if (hits.length >= max) throw new GameError("Slow down a little — try again in a bit", 429);
  hits.push(nowMs);
  globalThis.__igcRates.set(key, hits);
}
