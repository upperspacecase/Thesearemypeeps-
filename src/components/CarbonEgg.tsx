"use client";

import { useState } from "react";

// Easter egg. The four loops of the mark are carbon's four bonds. A periodic
// table tile for carbon hides in the dot pattern, lit so faintly you would
// only find it by looking. Tap it and the mark turns over and says why.

export function CarbonEgg() {
  const [found, setFound] = useState(false);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={`brand-logo ${found ? "spin" : ""}`} src="/logo.png" alt="In Good Company" width={900} height={821} />
      <p className={`carbon-reveal serif-q ${found ? "on" : ""}`} aria-live="polite">
        {found && (
          <>
            We are carbon-based lifeforms.
            <br />
            We do better in good company.
          </>
        )}
      </p>
      <button
        type="button"
        className={`carbon-tile ${found ? "on" : ""}`}
        onClick={() => setFound((f) => !f)}
        aria-label="Carbon, element six"
      >
        <span className="num">6</span>
        <span className="sym">C</span>
        <span className="mass">12.011</span>
      </button>
    </>
  );
}
