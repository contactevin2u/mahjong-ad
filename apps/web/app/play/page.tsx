"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import {
  startSingle,
  sendAction,
  GameResponse,
  Action,
  ClaimOption,
} from "../../lib/gameApi";
import { Tile, tileId } from "../../lib/tiles";
import { MahjongTile, TileBack } from "../../components/MahjongTile";
import { WinCelebration } from "../../components/WinCelebration";
import { LoseEffect } from "../../components/LoseEffect";

const STAKES = [100, 500, 1000];
const WIND_LABEL: Record<string, string> = {
  east: "East",
  south: "South",
  west: "West",
  north: "North",
};

export default function PlayPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [game, setGame] = useState<GameResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effect, setEffect] = useState<null | "win" | "lose">(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) refreshBalance();
  }, [user]);

  function refreshBalance() {
    api<{ balance: number }>("/wallet")
      .then((r) => setBalance(r.balance))
      .catch(() => {});
  }

  function handle(g: GameResponse) {
    setGame(g);
    if (g.result?.ended) {
      setEffect(g.result.youWon ? "win" : "lose");
      if (g.result.balance != null) setBalance(g.result.balance);
    }
  }

  async function start(stake: number) {
    setBusy(true);
    setError(null);
    try {
      handle(await startSingle(stake));
    } catch (e: any) {
      setError(e?.message ?? "Could not start game");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: Action) {
    if (!game) return;
    setBusy(true);
    setError(null);
    try {
      handle(await sendAction(game.gameId, action));
    } catch (e: any) {
      setError(e?.message ?? "Illegal move");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  // ---- Start screen ----
  if (!game || (game.result?.ended && effect === null)) {
    const ended = game?.result?.ended;
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 text-2xl font-bold">Play vs 3 Bots</h1>
        <p className="mb-6 text-sm text-white/60">
          💰 Balance: {balance ?? "…"} coins. Win the hand to take 4× your stake.
        </p>

        {ended && game && (
          <div className="mb-6 rounded-lg border border-white/10 p-4">
            <p className="text-lg font-semibold">
              {game.result!.youWon
                ? `🎉 You won ${game.result!.payout} coins!`
                : game.result!.winner === null
                ? "Draw — stake refunded."
                : "You lost this hand."}
            </p>
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

        <div className="space-y-3">
          <p className="text-sm text-white/70">Choose your stake:</p>
          <div className="flex justify-center gap-3">
            {STAKES.map((s) => (
              <button
                key={s}
                onClick={() => start(s)}
                disabled={busy || (balance !== null && balance < s)}
                className="rounded-lg bg-gold px-5 py-3 font-bold text-felt-dark disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
          {balance !== null && balance < STAKES[0] && (
            <p className="text-sm text-yellow-200">
              Not enough coins.{" "}
              <Link href="/shop" className="underline">
                Top up
              </Link>
            </p>
          )}
        </div>
        <Link href="/" className="mt-8 inline-block text-sm text-white/50">
          ← Back to lobby
        </Link>
      </div>
    );
  }

  // ---- Game board ----
  const v = game.view;
  const opponents = v.players.filter((p) => p.seat !== v.you.seat);
  const yourTurn = v.phase === "action" && v.currentTurn === v.you.seat;

  return (
    <div className="space-y-6">
      {/* Opponents */}
      <div className="grid grid-cols-3 gap-3">
        {opponents.map((p) => (
          <div
            key={p.seat}
            className={[
              "rounded-lg border p-3 text-center text-sm",
              v.currentTurn === p.seat ? "border-gold bg-gold/10" : "border-white/10",
            ].join(" ")}
          >
            <div className="font-semibold">
              🤖 Bot · {WIND_LABEL[p.seatWind]}
              {v.dealer === p.seat ? " (Dealer)" : ""}
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-0.5">
              {Array.from({ length: p.handCount }).map((_, i) => (
                <TileBack key={i} small />
              ))}
            </div>
            {p.melds.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {p.melds.flatMap((m, mi) =>
                  m.tiles.map((t, ti) => <MahjongTile key={`${mi}-${ti}`} tile={t} small />)
                )}
              </div>
            )}
            {p.bonus.length > 0 && (
              <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                {p.bonus.map((t, i) => (
                  <MahjongTile key={i} tile={t} small />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Center: table info + discards */}
      <div className="rounded-xl bg-felt p-4">
        <div className="mb-2 flex items-center justify-between text-sm text-white/70">
          <span>Wall: {v.wallRemaining} tiles</span>
          <span>
            {v.phase === "ended"
              ? "Hand over"
              : yourTurn
              ? "🟢 Your turn"
              : v.phase === "claims"
              ? "Claim window"
              : `Bot ${WIND_LABEL[v.players[v.currentTurn].seatWind]} thinking…`}
          </span>
        </div>
        <div className="flex min-h-[3rem] flex-wrap gap-1">
          {v.discards.map((d, i) => (
            <MahjongTile
              key={i}
              tile={d.tile}
              small
              highlight={
                v.lastDiscard != null &&
                i === v.discards.length - 1 &&
                d.seat === v.lastDiscard.seat
              }
            />
          ))}
          {v.discards.length === 0 && (
            <span className="text-sm text-white/40">No discards yet</span>
          )}
        </div>
      </div>

      {/* Your melds + bonus */}
      {(v.you.melds.length > 0 || v.you.bonus.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {v.you.melds.map((m, mi) => (
            <div key={mi} className="flex gap-0.5 rounded bg-black/20 p-1">
              {m.tiles.map((t, ti) => (
                <MahjongTile key={ti} tile={t} small />
              ))}
            </div>
          ))}
          {v.you.bonus.map((t, i) => (
            <MahjongTile key={`b${i}`} tile={t} small />
          ))}
        </div>
      )}

      {/* Your hand */}
      <div>
        <div className="mb-2 text-sm text-white/70">
          Your hand · {WIND_LABEL[v.players[v.you.seat].seatWind]}
          {v.dealer === v.you.seat ? " (Dealer)" : ""}
        </div>
        <div className="flex flex-wrap gap-1">
          {v.you.hand.map((t, i) => (
            <MahjongTile
              key={i}
              tile={t}
              onClick={yourTurn ? () => act({ type: "discard", tile: t }) : undefined}
              disabled={busy || !yourTurn}
            />
          ))}
        </div>
      </div>

      {/* Action bar */}
      <ActionBar game={game} busy={busy} onAct={act} />

      {error && <p className="text-sm text-red-300">{error}</p>}

      {/* End-of-hand effects */}
      <WinCelebration
        show={effect === "win"}
        title="MAHJONG!"
        winnerName="You"
        coinsWon={game.result?.payout ?? 0}
        onDone={() => setEffect(null)}
      />
      <LoseEffect
        show={effect === "lose"}
        title="AIYOH!"
        coinsLost={game.stake}
        onDone={() => setEffect(null)}
      />
    </div>
  );
}

function ActionBar({
  game,
  busy,
  onAct,
}: {
  game: GameResponse;
  busy: boolean;
  onAct: (a: Action) => void;
}) {
  const o = game.options;

  if (o.kind === "action") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-black/20 p-3">
        <span className="text-sm text-white/70">
          Your turn — click a tile to discard.
        </span>
        {o.canSelfWin && (
          <button
            onClick={() => onAct({ type: "selfWin" })}
            disabled={busy}
            className="rounded bg-gold px-4 py-2 font-bold text-felt-dark"
          >
            🀄 Declare WIN
          </button>
        )}
        {o.concealedKongs.map((group, i) => (
          <button
            key={i}
            onClick={() => onAct({ type: "concealedKong", tile: group[0] })}
            disabled={busy}
            className="rounded bg-white/20 px-4 py-2 font-semibold"
          >
            Kong
          </button>
        ))}
      </div>
    );
  }

  if (o.kind === "claims") {
    const label: Record<ClaimOption["type"], string> = {
      win: "🀄 WIN",
      kong: "Kong",
      pong: "Pong",
      chow: "Chow",
    };
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-black/20 p-3">
        <span className="text-sm text-white/70">A tile was discarded — claim it?</span>
        {o.claims.map((c, i) => (
          <button
            key={i}
            onClick={() => onAct({ type: "claim", claim: c })}
            disabled={busy}
            className="rounded bg-gold px-4 py-2 font-bold text-felt-dark"
          >
            {label[c.type]}
          </button>
        ))}
        <button
          onClick={() => onAct({ type: "claim", claim: "pass" })}
          disabled={busy}
          className="rounded bg-white/20 px-4 py-2 font-semibold"
        >
          Pass
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-black/20 p-3 text-sm text-white/60">
      Waiting…
    </div>
  );
}
