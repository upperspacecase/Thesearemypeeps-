import fs from "node:fs";
import path from "node:path";

// Private image store. Files live outside any public/static directory and
// are served only through the authorized /api/images/[cardId] route.
// Swapping this module for S3 presigned puts/gets is the production path.

const UPLOAD_DIR =
  process.env.IGC_UPLOAD_DIR ?? path.join(process.env.IGC_DATA_DIR ?? path.join(process.cwd(), "data"), "uploads");

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // client resizes to card size first

const MAGIC: Array<{ ext: string; mime: string; test: (b: Buffer) => boolean }> = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    mime: "image/png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) => b.length > 11 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
];

export function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12 || buf.length > MAX_IMAGE_BYTES) return null;
  const hit = MAGIC.find((m) => m.test(buf));
  return hit ? { ext: hit.ext, mime: hit.mime } : null;
}

export function saveCardImage(cardId: string, buf: Buffer, ext: string): string {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const rel = `${cardId}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, rel), buf);
  return rel;
}

export function readCardImage(storagePath: string): { buf: Buffer; mime: string } | null {
  // storagePath is server-generated (`${uuid}.${ext}`); reject anything else.
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storagePath)) return null;
  const file = path.join(UPLOAD_DIR, storagePath);
  if (!fs.existsSync(file)) return null;
  const ext = storagePath.split(".").pop()!;
  const mime = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";
  return { buf: fs.readFileSync(file), mime };
}

export function deleteCardImage(storagePath: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storagePath)) return;
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, storagePath));
  } catch {
    // Idempotent: already gone is success. Real storage backends log + retry.
  }
}
