import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/auth";
import { Header } from "../components/Header";

export const metadata: Metadata = {
  title: "Mahjong SG — Play Singaporean Mahjong online",
  description:
    "Real-time 4-player Singaporean Mahjong. Top up coins and play. Coins have no cash value.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
