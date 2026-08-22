import type { Metadata } from "next";
import { JoinCard } from "@/components/JoinCard";

// Invite landing: no participant names or photos in previews, not indexed (FR-07).
export const metadata: Metadata = {
  title: "You're invited · In Good Company",
  description: "A private two-player game. One link, no download.",
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24 }}>
      <JoinCard token={token} />
    </main>
  );
}
