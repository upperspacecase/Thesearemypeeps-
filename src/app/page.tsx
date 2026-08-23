import { StartButtons } from "@/components/StartButtons";

// Wordle-style splash: what the game is, one button, and a picture of play.
// The rules live in the game itself (first-run overlay), not on this page.

const FACES: Array<[string, string, string]> = [
  ["Maya", "#F6B49B", "#A93407"], ["Sam", "#FFD9BF", "#C63E0B"], ["Priya", "#EFA07E", "#7C2504"],
  ["Jack", "#FFC3A0", "#A93407"], ["Nadia", "#F8C6AC", "#8F2C05"], ["Omar", "#FFB88E", "#7C2504"],
  ["Elif", "#F2AB8A", "#A93407"], ["Theo", "#FFD2B4", "#B53908"], ["June", "#F6B49B", "#7C2504"],
  ["Ravi", "#FFC9A6", "#A93407"], ["Kate", "#EFA985", "#8F2C05"], ["Milo", "#FFDCC4", "#C63E0B"],
  ["Ana", "#F6B49B", "#A93407"], ["Ben", "#FFD9BF", "#C63E0B"], ["Cleo", "#EFA07E", "#7C2504"],
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
        display: "grid", placeItems: "center", padding: "72px 24px 48px",
        background:
          "radial-gradient(1100px 700px at 78% 18%, #F0561A 0%, transparent 60%), radial-gradient(900px 900px at 12% 85%, #C63E0B 0%, transparent 55%), var(--ember)",
      }}
    >
      <div className="figure" aria-hidden>
        <span style={{ width: 520, height: 640, right: "8%", top: "4%", background: "radial-gradient(closest-side,rgba(246,180,155,.55),transparent 72%)" }} />
        <span style={{ width: 420, height: 560, right: "16%", top: "34%", background: "radial-gradient(closest-side,rgba(255,224,206,.5),transparent 70%)" }} />
        <span style={{ width: 640, height: 520, left: "-10%", bottom: "-14%", background: "radial-gradient(closest-side,rgba(124,37,4,.55),transparent 72%)" }} />
      </div>

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
          <p className="small dim" style={{ marginTop: 18 }}>
            One private link. No download. Photos delete themselves after the game ·{" "}
            <a href="/privacy">privacy</a>
          </p>
        </div>

        <GameplayMock />
      </div>
    </main>
  );
}
