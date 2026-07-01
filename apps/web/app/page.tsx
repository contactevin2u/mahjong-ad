"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getSocket } from "../lib/socket";
import { api } from "../lib/api";
import { MIN_PLAY_COINS } from "../lib/config";
import { LoseEffect } from "../components/LoseEffect";
import { WinCelebration } from "../components/WinCelebration";

export default function HomePage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showNoCoins, setShowNoCoins] = useState(false);

  // Free-demo claim state
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }
    const socket = getSocket();
    const onWelcome = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("lobby:welcome", onWelcome);
    socket.on("disconnect", onDisconnect);

    api<{ balance: number }>("/wallet")
      .then((r) => setBalance(r.balance))
      .catch(() => setBalance(null));

    return () => {
      socket.off("lobby:welcome", onWelcome);
      socket.off("disconnect", onDisconnect);
    };
  }, [user]);

  const canPlay = balance !== null && balance >= MIN_PLAY_COINS;
  const freeDemoAvailable = !!user && user.freeDemoUsed === false;

  function handlePlay() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!canPlay) {
      setShowNoCoins(true);
      return;
    }
    alert("Tables open in the next update — your coins are ready to play! 🀄");
  }

  async function claimFreeDemo() {
    setClaiming(true);
    setClaimError(null);
    try {
      const r = await api<{ balance: number; granted: number }>(
        "/play/free-demo/claim",
        { method: "POST" }
      );
      setBalance(r.balance);
      setCelebrate(true); // little celebration
      await refreshUser(); // flips freeDemoUsed -> true so the banner disappears
    } catch (e: any) {
      setClaimError(e?.message ?? "Could not claim your free coins");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-2xl bg-felt p-8 shadow-xl">
        <h1 className="text-3xl font-bold">Singaporean Mahjong, online</h1>
        <p className="mt-2 max-w-2xl text-white/80">
          Real-time 4-player Singaporean Mahjong with flowers, seasons and animals.
          Try it free, then top up coins and go for that big win.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {loading ? null : user ? (
            <>
              <button
                onClick={handlePlay}
                className="rounded bg-gold px-6 py-2 font-bold text-felt-dark"
              >
                ▶ Play now
              </button>
              <span className="rounded bg-black/30 px-4 py-2 text-sm">
                Lobby: {connected ? "🟢 connected" : "🟡 connecting…"}
              </span>
              <span className="rounded bg-black/30 px-4 py-2 text-sm">
                💰 {balance ?? "…"} coins
              </span>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded bg-gold px-6 py-2 font-bold text-felt-dark"
              >
                Create account
              </Link>
              <Link href="/login" className="rounded bg-black/30 px-4 py-2">
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Free demo (one-time) — shown first while it's still available */}
      {user && !loading && freeDemoAvailable && (
        <FreeDemoBanner
          claiming={claiming}
          error={claimError}
          onClaim={claimFreeDemo}
        />
      )}

      {/* Top-up encouragement — shown once the free demo has been used */}
      {user && !loading && !freeDemoAvailable && (
        <TopUpPromo balance={balance} canPlay={canPlay} />
      )}

      {/* Tables placeholder */}
      <section className="rounded-xl border border-white/10 p-6 text-sm text-white/70">
        <h2 className="mb-2 font-semibold text-white">Tables (coming soon)</h2>
        <p>
          Matchmaking and live tables arrive in the next phase. For now, create an
          account, grab your free coins, and get ready for day one.
        </p>
      </section>

      <p className="text-center text-xs text-white/40">
        Coins are virtual credits with no cash value. They cannot be withdrawn or
        exchanged for money. No real-money gambling.
      </p>

      {/* Sad effect when trying to play with too few coins */}
      <LoseEffect
        show={showNoCoins}
        title="NO COINS!"
        coinsLost={0}
        onDone={() => {
          setShowNoCoins(false);
          router.push("/shop");
        }}
      />

      {/* Celebration when claiming the free coins */}
      <WinCelebration
        show={celebrate}
        title="FREE COINS!"
        coinsWon={MIN_PLAY_COINS}
        onDone={() => setCelebrate(false)}
      />
    </div>
  );
}

function FreeDemoBanner({
  claiming,
  error,
  onClaim,
}: {
  claiming: boolean;
  error: string | null;
  onClaim: () => void;
}) {
  return (
    <section className="rounded-2xl border-2 border-gold bg-gradient-to-br from-felt to-felt-dark p-6 shadow-xl">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-5xl">🎁</div>
        <h2 className="text-2xl font-bold text-gold">Try your first game FREE</h2>
        <p className="max-w-lg text-white/80">
          New here? Claim <strong className="text-gold">{MIN_PLAY_COINS} free coins</strong>{" "}
          — that&apos;s exactly enough for one game, on the house. One free claim per
          player.
        </p>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          onClick={onClaim}
          disabled={claiming}
          className="animate-pulse rounded-lg bg-gold px-8 py-3 text-lg font-bold text-felt-dark disabled:opacity-60"
        >
          {claiming ? "Claiming…" : `🎁 Claim ${MIN_PLAY_COINS} free coins`}
        </button>
        <p className="text-xs text-white/50">
          After your free game, top up to keep playing.
        </p>
      </div>
    </section>
  );
}

function TopUpPromo({
  balance,
  canPlay,
}: {
  balance: number | null;
  canPlay: boolean;
}) {
  if (canPlay) {
    return (
      <section className="rounded-xl border border-gold/30 bg-gold/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gold">You&apos;re ready to play 🀄</h2>
            <p className="text-sm text-white/70">
              Running low mid-game? Keep your stack topped up so you never miss a hand.
            </p>
          </div>
          <Link
            href="/shop"
            className="rounded bg-gold px-5 py-2 font-semibold text-felt-dark"
          >
            Add more coins
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-gold bg-gradient-to-br from-felt to-felt-dark p-6 shadow-xl">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-5xl">🪙</div>
        <h2 className="text-2xl font-bold text-gold">Top up to keep playing!</h2>
        <p className="max-w-lg text-white/80">
          You&apos;ve used your free game. You need at least{" "}
          <strong className="text-gold">{MIN_PLAY_COINS} coins</strong> to join a
          table — you currently have <strong>{balance ?? 0}</strong>. Grab a coin
          pack and jump back in!
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <span className="rounded-full bg-black/30 px-4 py-1 text-sm">🎁 +10% bonus on Value</span>
          <span className="rounded-full bg-black/30 px-4 py-1 text-sm">🔥 +20% bonus on Pro</span>
          <span className="rounded-full bg-black/30 px-4 py-1 text-sm">⚡ Instant top-up via Billplz</span>
        </div>
        <Link
          href="/shop"
          className="mt-2 animate-pulse rounded-lg bg-gold px-8 py-3 text-lg font-bold text-felt-dark"
        >
          💰 Top up now
        </Link>
      </div>
    </section>
  );
}
