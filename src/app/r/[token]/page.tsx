import type { Metadata } from "next";
import { JoinCard } from "@/components/JoinCard";

// Invite landing: no participant names or photos in previews, not indexed (FR-07).
const INVITE_DESC =
  "Bring 5–15 photos of people in your life and guess who the other picked. About 20 minutes, together on a call or in person.";

export const metadata: Metadata = {
  title: "You're invited · In Good Company",
  description: INVITE_DESC,
  robots: { index: false, follow: false },
  openGraph: {
    title: "You're invited · In Good Company",
    description: INVITE_DESC,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="paper" style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24 }}>
      <JoinCard token={token} />
    </main>
  );
}
