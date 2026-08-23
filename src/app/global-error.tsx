"use client";

// Last-resort boundary (errors in the root layout itself). Styled inline —
// the stylesheet may not have loaded when this renders.

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fbf4e7", color: "#211e1a", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <h1 style={{ fontWeight: 400, fontSize: 30, marginBottom: 12 }}>Something hiccuped</h1>
          <p style={{ opacity: 0.85, marginBottom: 6 }}>Your game is safe on the server.</p>
          <p style={{ fontSize: 13, opacity: 0.8, maxWidth: "50ch", wordBreak: "break-word", margin: "0 auto 20px" }}>
            {String(error?.message ?? "Unknown error").slice(0, 300)}
          </p>
          <button
            onClick={() => location.reload()}
            style={{ font: "inherit", fontWeight: 500, background: "#211e1a", color: "#fbf4e7", border: "none", borderRadius: 999, padding: "13px 26px", cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
