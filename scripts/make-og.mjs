/* Capture /og at 1200x630 into public/og.png (the link-preview image).
   Run with the app serving: BASE_URL=http://localhost:3111 node scripts/make-og.mjs */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EXE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(`${BASE}/og`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: "public/og.png" });
await browser.close();
console.log("wrote public/og.png");
