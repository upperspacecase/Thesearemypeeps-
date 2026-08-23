import { StartButtons } from "@/components/StartButtons";

// Wordle-style splash: what the game is, one button, and a picture of play.
// The rules live in the game itself (first-run overlay), not on this page.

const FACES: Array<[string, string, string]> = [
  ["Maya", "#EAD9BB", "#B0684A"], ["Sam", "#E3D2AE", "#6e7f58"], ["Priya", "#EAD9BB", "#3F6E63"],
  ["Jack", "#E9D4B4", "#7A5B44"], ["Nadia", "#E3D2AE", "#B0684A"], ["Omar", "#EAD9BB", "#6e7f58"],
  ["Elif", "#E9D4B4", "#3F6E63"], ["Theo", "#E3D2AE", "#7A5B44"], ["June", "#EAD9BB", "#B0684A"],
  ["Ravi", "#E9D4B4", "#6e7f58"], ["Kate", "#E3D2AE", "#3F6E63"], ["Milo", "#EAD9BB", "#7A5B44"],
  ["Ana", "#E9D4B4", "#B0684A"], ["Ben", "#E3D2AE", "#6e7f58"], ["Cleo", "#EAD9BB", "#3F6E63"],
];
const DOWN = new Set([1, 4, 9, 12]);

function Face({ bg, fg }: { bg: string; fg: string }) {
  return (
    <svg viewBox="0 0 60 80" preserveAspectRatio="xMidYMid slice" style={{ display: "block", width: "100%", height: "100%" }}>
      <rect width="60" height="80" fill={bg} />
      <circle cx="30" cy="30" r="13" fill={fg} />
      <path d="M8 80 C8 58 22 50 30 50 C38 50 52 58 52 80 Z" fill={fg} />
    </svg>
  );
}

function GameplayMock() {
  return (
    <div className="phone-mock" aria-label="What a game looks like: a board of faces, some swiped away, and the person you picked in the corner">
      <div className="pm-board">
        {FACES.map(([name, bg, fg], i) => (
          <div key={name} className={`pm-card ${DOWN.has(i) ? "down" : ""}`}>
            <div className="pm-face">{DOWN.has(i) ? <span className="pm-not">not them</span> : <Face bg={bg} fg={fg} />}</div>
            <span className="pm-name">{name}</span>
          </div>
        ))}
      </div>
      <div className="pm-foot">
        <span className="pm-q">?</span>
        <span className="pm-count">11 still standing</span>
        <div className="pm-secret">
          <div className="pm-face"><Face bg="#EFA07E" fg="#7C2504" /></div>
          <span>you picked</span>
          <strong>Priya</strong>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main
      style={{
        position: "relative", minHeight: "100svh", overflow: "hidden",
        display: "flex", flexDirection: "column", padding: "56px 24px 18px",
        background:
          "radial-gradient(1100px 700px at 78% 18%, #3D7F8A 0%, transparent 60%), radial-gradient(900px 900px at 12% 85%, #27565F 0%, transparent 55%), var(--ember)",
      }}
    >
      <div className="figure" aria-hidden>
        <span style={{ width: 520, height: 640, right: "8%", top: "4%", background: "radial-gradient(closest-side,rgba(217,200,166,.3),transparent 72%)" }} />
        <span style={{ width: 420, height: 560, right: "16%", top: "34%", background: "radial-gradient(closest-side,rgba(243,236,215,.22),transparent 70%)" }} />
        <span style={{ width: 640, height: 520, left: "-10%", bottom: "-14%", background: "radial-gradient(closest-side,rgba(20,45,38,.55),transparent 72%)" }} />
      </div>

      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
      <div className="splash">
        <div className="panel" style={{ width: "min(560px,100%)", borderRadius: 40 }}>
          <h1 className="display" style={{ marginBottom: 22, fontSize: "clamp(27px,4.2vw,38px)" }}>
            <strong style={{ color: "var(--cream)", fontWeight: 500 }}>In Good Company</strong> is a two-player guessing
            game made from the real people in your lives.
          </h1>

          <div style={{ display: "grid", gap: 10, margin: "0 0 22px" }}>
            <p className="eyebrow" style={{ marginBottom: 0, color: "var(--cream-dim)", fontSize: 12 }}>You might begin with</p>
            <p className="serif-q" style={{ fontSize: "clamp(19px,2.8vw,24px)", lineHeight: 1.25 }}>&ldquo;Are they wearing a hat?&rdquo;</p>
            <p className="eyebrow" style={{ marginBottom: 0, color: "var(--cream-dim)", fontSize: 12 }}>Five minutes later, you&rsquo;re asking</p>
            <p className="serif-q" style={{ fontSize: "clamp(19px,2.8vw,24px)", lineHeight: 1.25, color: "var(--good)" }}>
              &ldquo;Is this the person you would call when everything went wrong?&rdquo;
            </p>
          </div>

          <StartButtons />
        </div>

        <GameplayMock />
      </div>
      </div>

      <footer style={{ position: "relative", textAlign: "center", fontSize: 13, color: "var(--cream-dim)", paddingTop: 20 }}>
        One private link. No download. Photos delete themselves after the game · <a href="/privacy">privacy</a>
      </footer>
    </main>
  );
}
