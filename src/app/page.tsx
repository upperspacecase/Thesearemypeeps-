import { StartButtons, CtaButton } from "@/components/StartButtons";

const FACES = [
  ["#F6B49B", "#A93407"], ["#FFD9BF", "#C63E0B"], ["#EFA07E", "#7C2504"], ["#FFC3A0", "#A93407"],
  ["#F8C6AC", "#8F2C05"], ["#FFB88E", "#7C2504"], ["#F2AB8A", "#A93407"], ["#FFD2B4", "#B53908"],
  ["#F6B49B", "#7C2504"], ["#FFC9A6", "#A93407"], ["#EFA985", "#8F2C05"], ["#FFDCC4", "#C63E0B"],
];

function Face({ bg, fg }: { bg: string; fg: string }) {
  return (
    <svg viewBox="0 0 60 80" preserveAspectRatio="xMidYMid slice" style={{ display: "block", width: "100%", height: "100%" }}>
      <rect width="60" height="80" fill={bg} />
      <circle cx="30" cy="30" r="13" fill={fg} />
      <path d="M8 80 C8 58 22 50 30 50 C38 50 52 58 52 80 Z" fill={fg} />
    </svg>
  );
}

function MiniBoard({ down = [], secret }: { down?: number[]; secret?: number }) {
  return (
    <div aria-hidden style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, width: "min(400px,100%)" }}>
      {FACES.map(([bg, fg], i) => {
        const isDown = down.includes(i);
        return (
          <div
            key={i}
            style={{
              aspectRatio: "3/4", borderRadius: 12, background: "var(--cream)", padding: 7, position: "relative",
              boxShadow: "0 10px 24px -14px rgba(70,20,2,.55)",
              opacity: isDown ? 0.38 : 1,
              transform: isDown ? "rotate(-1.5deg) scale(.96)" : undefined,
              outline: secret === i ? "3px solid var(--glow)" : undefined,
              outlineOffset: secret === i ? 3 : undefined,
            }}
          >
            <div style={{ position: "absolute", inset: 7, borderRadius: 7, overflow: "hidden", background: isDown ? "var(--ember-shadow)" : undefined }}>
              {!isDown && <Face bg={bg} fg={fg} />}
              {isDown && (
                <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--serif)", fontSize: 26, color: "rgba(255,246,239,.55)" }}>?</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STEPS: Array<{ title: string; body: string; qs?: string[]; visual: React.ReactNode }> = [
  { title: "Make your board", body: "Upload 12 people from your life. Add a photo and first name for each one.", visual: <MiniBoard /> },
  {
    title: "Choose someone secretly",
    body: "Pick one person from your board. The other player can see everyone you brought—but not who you chose.",
    visual: <MiniBoard secret={2} />,
  },
  {
    title: "Start asking",
    body: "Ask one yes-or-no question at a time.",
    qs: ["Are they wearing glasses?", "Have you known them since school?", "Are they the funniest person you know?", "Would you trust them to get you out of trouble?"],
    visual: <MiniBoard down={[1, 3, 6, 9]} />,
  },
  {
    title: "Remove people and make your guess",
    body: "Use each answer to eliminate people from the board. Guess when you think you know who remains.",
    visual: <MiniBoard down={[0, 1, 3, 4, 5, 6, 8, 9, 10, 11]} />,
  },
  {
    title: "Meet the person",
    body: "At the reveal, tell the story: who are they, how did you meet, and what should the other player know about them?",
    visual: (
      <div
        aria-hidden
        style={{
          width: "min(280px,100%)", borderRadius: 28, padding: "12px 12px 22px", background: "var(--cream)",
          color: "var(--ink)", textAlign: "center", boxShadow: "0 30px 60px -24px rgba(70,20,2,.6)", transform: "rotate(2deg)",
        }}
      >
        <div style={{ borderRadius: 20, overflow: "hidden", aspectRatio: "1/1", marginBottom: 16 }}>
          <svg viewBox="0 0 60 60" preserveAspectRatio="xMidYMid slice" style={{ display: "block", width: "100%", height: "100%" }}>
            <rect width="60" height="60" fill="#EFA07E" />
            <circle cx="30" cy="24" r="12" fill="#7C2504" />
            <path d="M8 60 C8 44 22 38 30 38 C38 38 52 44 52 60 Z" fill="#7C2504" />
          </svg>
        </div>
        <p style={{ fontWeight: 600, fontSize: 20, letterSpacing: "-0.01em" }}>Maya</p>
        <p className="serif-q" style={{ fontSize: 17, color: "#8A4A2C", marginTop: 2 }}>knew me before the job title</p>
      </div>
    ),
  },
];

export default function Home() {
  return (
    <main>
      <header
        style={{
          position: "relative", minHeight: "100svh", display: "grid", placeItems: "center",
          padding: "96px 24px 120px", overflow: "hidden",
          background:
            "radial-gradient(1100px 700px at 78% 18%, #F0561A 0%, transparent 60%), radial-gradient(900px 900px at 12% 85%, #C63E0B 0%, transparent 55%), var(--ember)",
        }}
      >
        <div className="figure" aria-hidden>
          <span style={{ width: 520, height: 640, right: "8%", top: "4%", background: "radial-gradient(closest-side,rgba(246,180,155,.55),transparent 72%)" }} />
          <span style={{ width: 420, height: 560, right: "16%", top: "34%", background: "radial-gradient(closest-side,rgba(255,224,206,.5),transparent 70%)" }} />
          <span style={{ width: 640, height: 520, left: "-10%", bottom: "-14%", background: "radial-gradient(closest-side,rgba(124,37,4,.55),transparent 72%)" }} />
        </div>

        <div className="panel" style={{ width: "min(620px,100%)", borderRadius: 40 }}>
          <p className="eyebrow" style={{ color: "var(--cream-dim)", marginBottom: 30 }}>In Good Company</p>
          <h1 className="display" style={{ marginBottom: 24 }}>Meet the people behind the person.</h1>
          <p className="dim" style={{ maxWidth: "44ch", marginBottom: 14 }}>
            <strong style={{ color: "var(--cream)", fontWeight: 500 }}>In Good Company</strong> is a two-player guessing
            game made from the real people in your lives.
          </p>
          <p className="dim" style={{ maxWidth: "44ch" }}>
            Each of you brings 12 people. Choose one in secret. Ask yes-or-no questions, remove faces from the board and
            try to guess who the other player chose.
          </p>

          <div style={{ display: "grid", gap: 12, margin: "28px 0 6px" }}>
            <p className="eyebrow" style={{ marginBottom: 0, color: "var(--cream-dim)", fontSize: 12 }}>You might begin with</p>
            <p className="serif-q" style={{ fontSize: "clamp(20px,3vw,26px)", lineHeight: 1.25 }}>&ldquo;Are they wearing a hat?&rdquo;</p>
            <p className="eyebrow" style={{ marginBottom: 0, color: "var(--cream-dim)", fontSize: 12 }}>Five minutes later, you&rsquo;re asking</p>
            <p className="serif-q" style={{ fontSize: "clamp(20px,3vw,26px)", lineHeight: 1.25, color: "var(--good)" }}>
              &ldquo;Is this the person you would call when everything went wrong?&rdquo;
            </p>
          </div>

          <p className="dim" style={{ maxWidth: "44ch", margin: "20px 0 26px" }}>
            You are trying to find one person. Along the way, you discover an entire world.
          </p>

          <StartButtons />
          <p className="small dim" style={{ marginTop: 20 }}>One private link. No download.</p>
        </div>
      </header>

      <section style={{ background: "linear-gradient(180deg,var(--ember) 0%,var(--ember-deep) 12%,var(--ember-deep) 88%,var(--ember) 100%)", padding: "100px 0" }}>
        <div className="wrap">
          <p className="eyebrow">Before you play</p>
          <h2 className="display" style={{ marginBottom: 20 }}>Twelve people. One secret each.</h2>
          <dl className="specs" style={{ margin: "38px 0" }}>
            <div className="spec"><dt>Players</dt><dd>2</dd></div>
            <div className="spec"><dt>Bring</dt><dd>12 photos each</dd></div>
            <div className="spec"><dt>Setup</dt><dd>About 10 minutes the first time</dd></div>
            <div className="spec"><dt>Playing time</dt><dd>10–20 minutes per round</dd></div>
            <div className="spec"><dt>You&rsquo;ll need</dt><dd>One phone or laptop per player</dd></div>
            <div className="spec"><dt>Play from</dt><dd>The same room or alongside any call</dd></div>
          </dl>
          <p className="dim" style={{ maxWidth: "58ch" }}>
            Choose people from different parts of your life: the friend who knew you before the job title, the cousin who
            knows the family stories, the former flatmate with evidence, or the person you would call first.
          </p>
          <p className="notice" style={{ marginTop: 22 }}>
            Only include adults whose photos you have permission to share in your private game.
          </p>
        </div>
      </section>

      <section style={{ padding: "100px 0" }}>
        <div className="wrap">
          <p className="eyebrow">One question at a time</p>
          <h2 className="display">How to play</h2>
          <div style={{ display: "grid", gap: 80, marginTop: 60 }}>
            {STEPS.map((s, i) => (
              <div key={s.title} className="step-row">
                <div>
                  <p className="serif-q" style={{ fontSize: 19, color: "var(--blush)", marginBottom: 8 }}>
                    Step {["one", "two", "three", "four", "five"][i]}
                  </p>
                  <h3 style={{ fontWeight: 500, fontSize: "clamp(22px,3vw,28px)", lineHeight: 1.2, marginBottom: 10, letterSpacing: "-0.01em" }}>{s.title}</h3>
                  <p className="dim" style={{ maxWidth: "48ch" }}>{s.body}</p>
                  {s.qs && (
                    <ul style={{ marginTop: 14, display: "grid", gap: 6, listStyle: "none" }}>
                      {s.qs.map((q) => (
                        <li key={q} className="serif-q" style={{ fontSize: 19, color: "var(--good)" }}>
                          <span style={{ color: "var(--blush)" }}>— </span>{q}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ display: "grid", justifyItems: "center" }}>{s.visual}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "120px 24px 130px", textAlign: "center",
          background: "radial-gradient(800px 500px at 50% 0%, #F0561A 0%, transparent 65%), var(--ember)",
        }}
      >
        <p className="serif-q" style={{ fontSize: "clamp(19px,2.6vw,24px)", color: "var(--good)", marginBottom: 18 }}>
          The board gets smaller. Your picture of each other gets bigger.
        </p>
        <h2 className="display" style={{ marginBottom: 32 }}>Bring your people. Meet theirs.</h2>
        <CtaButton />
      </section>

      <footer style={{ padding: "36px 24px 48px", textAlign: "center", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--cream-dim)" }}>
        In Good Company · <a href="/privacy" style={{ textTransform: "none", letterSpacing: 0 }}>Privacy</a>
      </footer>
    </main>
  );
}
