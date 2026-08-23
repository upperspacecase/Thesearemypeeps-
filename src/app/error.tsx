"use client";

import { useEffect, useState } from "react";

// Route-level error boundary. Two jobs:
//  1. A deploy while someone is playing can leave the browser holding chunks
//     from the previous build ("ChunkLoadError") — recover by reloading once.
//  2. Any real crash shows its actual message instead of a blank screen, so
//     it can be reported and fixed.

const CHUNK_RE = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported|Importing a module script failed|error loading dynamically imported/i;

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    if (!CHUNK_RE.test(String(error?.message ?? ""))) return;
    try {
      const last = Number(sessionStorage.getItem("igc_skew_reload") ?? 0);
      if (Date.now() - last > 20_000) {
        sessionStorage.setItem("igc_skew_reload", String(Date.now()));
        setAutoReloading(true);
        location.reload();
      }
    } catch {}
  }, [error]);

  if (autoReloading) {
    return (
      <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24 }}>
        <p className="dim">Getting the latest version…</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="panel" style={{ width: "min(520px,100%)", textAlign: "center" }}>
        <p className="eyebrow">In Good Company</p>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 12 }}>Something hiccuped</h1>
        <p className="dim small" style={{ marginBottom: 6 }}>
          Your game is safe on the server. Reloading almost always picks it right back up.
        </p>
        <p className="small" style={{ color: "var(--good)", wordBreak: "break-word", marginBottom: 20 }}>
          {String(error?.message ?? "Unknown error").slice(0, 300)}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn solid" onClick={() => location.reload()}>Reload</button>
          <button className="btn ghost" onClick={() => reset()}>Try again</button>
          <a className="btn ghost" href="/">Go home</a>
        </div>
      </div>
    </main>
  );
}
