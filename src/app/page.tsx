import { LandingActions } from "@/components/LandingActions";

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
    <>
      <main className="paper" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
        <div className="paper-col" style={{ flex: 1, alignContent: "center" }}>
          <svg className="logo-tile" viewBox="0 0 66 66" aria-hidden>
            <rect x="1.5" y="1.5" width="63" height="63" rx="10" fill="none" stroke="#22302B" strokeWidth="3" />
            {[
              ["#F3ECD7", "#F3ECD7", "#F3ECD7"],
              ["#F3ECD7", "#D9A441", "#9BB08A"],
              ["#C0704F", "#35707B", "#9BB08A"],
            ].map((row, r) =>
              row.map((fill, c) => (
                <rect key={`${r}${c}`} x={7 + c * 18} y={7 + r * 18} width={16} height={16} rx={3} fill={fill} stroke="#22302B" strokeWidth="1.6" />
              ))
            )}
          </svg>

          <h1 className="paper-title">In Good Company</h1>
          <p className="paper-sub">Get to know someone through the people who made them.</p>

          <div className="hero-mock">
            <span className="chip-madefor">Made for two</span>
            <GameplayMock />
          </div>

          <LandingActions />

          <p className="paper-meta"><strong>2 players &middot; 5&ndash;15 photos each</strong></p>
          <p className="paper-meta">About 20 minutes</p>
          <p className="paper-tag serif-q">The cards are your people.</p>
        </div>
        <footer className="paper-foot">
          One private link. No download. Photos delete themselves after the game &middot; <a href="/privacy">privacy</a>
        </footer>
      </main>
    </>
  );
}
