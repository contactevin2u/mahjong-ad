"use client";
// Preview page for the win/lose celebration effects. Visit /demo/win and click
// a button. These same components fire on a real result once the game table is
// built (Phase 3/4).
import { useState } from "react";
import { WinCelebration } from "../../../components/WinCelebration";
import { LoseEffect } from "../../../components/LoseEffect";

export default function EffectsDemoPage() {
  const [win, setWin] = useState(false);
  const [lose, setLose] = useState(false);
  const [coins, setCoins] = useState(240);

  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="mb-2 text-2xl font-bold">Win / Lose effect preview</h1>
      <p className="mb-6 text-sm text-white/60">
        These play when a hand ends. Turn your sound on 🔊
      </p>

      <label className="mb-6 block text-sm text-white/70">
        Coins:{" "}
        <input
          type="number"
          value={coins}
          onChange={(e) => setCoins(Number(e.target.value))}
          className="ml-2 w-24 rounded bg-black/30 px-2 py-1 text-center"
        />
      </label>

      <div className="flex justify-center gap-3">
        <button
          onClick={() => setWin(true)}
          disabled={win || lose}
          className="rounded bg-gold px-5 py-3 font-bold text-felt-dark disabled:opacity-60"
        >
          🀄 Win!
        </button>
        <button
          onClick={() => setLose(true)}
          disabled={win || lose}
          className="rounded bg-slate-600 px-5 py-3 font-bold text-white disabled:opacity-60"
        >
          😭 Lose…
        </button>
      </div>

      <WinCelebration
        show={win}
        title="MAHJONG!"
        winnerName="You"
        coinsWon={coins}
        onDone={() => setWin(false)}
      />
      <LoseEffect
        show={lose}
        title="AIYOH!"
        winnerName="Ah Beng"
        coinsLost={coins}
        onDone={() => setLose(false)}
      />
    </div>
  );
}
