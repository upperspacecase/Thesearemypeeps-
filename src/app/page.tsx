import { LandingActions } from "@/components/LandingActions";

// Wordle-style splash: what the game is, one button, and a picture of play.
// The rules live in the game itself (first-run overlay), not on this page.

// the four rope colours of the mark, cycling across the mock board
const FACES: Array<[string, string, string]> = [
  ["Maya", "#F6EDDC", "#EE7A18"], ["Sam", "#F2E9D6", "#DB3A3E"], ["Priya", "#F6EDDC", "#3F8A24"],
  ["Jack", "#F2E9D6", "#F0A800"], ["Nadia", "#F6EDDC", "#EE7A18"], ["Omar", "#F2E9D6", "#DB3A3E"],
  ["Elif", "#F6EDDC", "#3F8A24"], ["Theo", "#F2E9D6", "#F0A800"], ["June", "#F6EDDC", "#EE7A18"],
  ["Ravi", "#F2E9D6", "#DB3A3E"], ["Kate", "#F6EDDC", "#3F8A24"], ["Milo", "#F2E9D6", "#F0A800"],
  ["Ana", "#F6EDDC", "#EE7A18"], ["Ben", "#F2E9D6", "#DB3A3E"], ["Cleo", "#F6EDDC", "#3F8A24"],
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
          <div className="pm-face"><Face bg="#F6EDDC" fg="#EE7A18" /></div>
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.png" alt="In Good Company" width={900} height={821} />
          <h1 className="paper-title">In Good Company</h1>
          <p className="paper-sub">A game about the people in your life.</p>

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
