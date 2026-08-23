import { LandingActions } from "@/components/LandingActions";
import { GameplayMock } from "@/components/GameplayMock";
import { CarbonEgg } from "@/components/CarbonEgg";

export default function Home() {
  return (
    <>
      <main className="paper" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
        <div className="paper-col" style={{ flex: 1, alignContent: "center" }}>
          <CarbonEgg />
          <h1 className="paper-title">In Good Company</h1>
          <p className="paper-sub">A game about the people in your life.</p>

          <div className="hero-mock">
            <span className="chip-madefor">Made for two</span>
            <GameplayMock />
          </div>

          <LandingActions />

          <p className="paper-meta"><strong>2 players &middot; 5&ndash;15 photos each</strong></p>
          <p className="paper-meta">About 20 minutes</p>
        </div>
        <footer className="paper-foot">
          One private link. No download. Photos delete themselves after the game &middot; <a href="/privacy">privacy</a>
        </footer>
      </main>
    </>
  );
}
