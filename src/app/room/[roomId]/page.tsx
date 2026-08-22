import type { Metadata } from "next";
import { RoomShell } from "@/components/RoomShell";

export const metadata: Metadata = {
  title: "Your game · In Good Company",
  robots: { index: false, follow: false },
};

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomShell roomId={roomId} />;
}
