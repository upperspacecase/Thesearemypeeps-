// Image validation. Card photos are cropped to card size on the client, then
// stored as bytes in the database (card_images) so the app runs identically
// on a laptop, a VPS, or serverless — no filesystem or bucket required.
// Serving stays behind the authorized /api/images/[cardId] route.

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const MAGIC: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: "image/webp",
    test: (b) => b.length > 11 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
];

export function sniffImage(buf: Buffer): { mime: string } | null {
  if (buf.length < 12 || buf.length > MAX_IMAGE_BYTES) return null;
  const hit = MAGIC.find((m) => m.test(buf));
  return hit ? { mime: hit.mime } : null;
}
