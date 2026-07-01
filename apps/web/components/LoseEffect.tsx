"use client";
// Reusable "funny sad" lose overlay: a wobbling crying tile, an "AIYOH!" banner,
// falling teardrops, coins lost, and a sad-trombone "wah-wah-waaah".
// Self-contained (no external libs/assets).
//
// Usage:
//   <LoseEffect
//     show={didLose}
//     winnerName="Ah Beng"
//     coinsLost={80}
//     onDone={() => setDidLose(false)}
//   />
import { useEffect, useRef } from "react";

interface LoseEffectProps {
  show: boolean;
  title?: string;
  /** Who won instead (optional). */
  winnerName?: string;
  coinsLost?: number;
  onDone?: () => void;
  sound?: boolean;
}

interface Drop {
  x: number;
  y: number;
  vy: number;
  size: number;
  opacity: number;
}

// A few rotating cheeky messages so it feels playful, not punishing.
const QUIPS = [
  "Aiyoh… so close!",
  "Next round confirm win!",
  "Your tiles paiseh liao 😅",
  "Shuffle away the bad luck!",
  "Don't angry, just play again!",
];

export function LoseEffect({
  show,
  title = "AIYOH!",
  winnerName,
  coinsLost,
  onDone,
  sound = true,
}: LoseEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const quipRef = useRef<string>(QUIPS[0]);

  useEffect(() => {
    if (!show) return;

    quipRef.current = QUIPS[(Math.random() * QUIPS.length) | 0];
    if (sound) playSadTrombone();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const drops: Drop[] = [];
    let frame = 0;
    const maxFrames = 240; // ~4s

    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, W(), H());

      // Slow drizzle of blue teardrops.
      if (frame % 4 === 0) {
        for (let i = 0; i < 3; i++) {
          drops.push({
            x: Math.random() * W(),
            y: -10,
            vy: 2 + Math.random() * 2.5,
            size: 6 + Math.random() * 6,
            opacity: 0.5 + Math.random() * 0.4,
          });
        }
      }

      const fade = frame > maxFrames - 40 ? Math.max(0, (maxFrames - frame) / 40) : 1;

      for (const d of drops) {
        d.y += d.vy;
        ctx.save();
        ctx.globalAlpha = d.opacity * fade;
        ctx.fillStyle = "#7fc7ff";
        // Teardrop: circle with a pointed top.
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - d.size);
        ctx.quadraticCurveTo(d.x + d.size * 0.7, d.y, d.x, d.y + d.size * 0.6);
        ctx.quadraticCurveTo(d.x - d.size * 0.7, d.y, d.x, d.y - d.size);
        ctx.fill();
        ctx.restore();
      }

      if (frame < maxFrames) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W(), H());
        onDone?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-grayscale">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="relative flex flex-col items-center animate-[losedrop_0.6s_ease-out]">
        <div className="animate-[wobble_0.9s_ease-in-out_infinite] text-6xl drop-shadow-lg sm:text-8xl">
          😭
        </div>
        <div
          className="mt-2 text-5xl font-black tracking-widest text-slate-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:text-7xl"
          style={{ WebkitTextStroke: "1px rgba(0,0,0,0.3)" }}
        >
          {title}
        </div>
        <div className="mt-3 text-lg font-medium text-slate-300 sm:text-xl">
          {quipRef.current}
        </div>
        {winnerName && (
          <div className="mt-1 text-sm text-slate-400">
            {winnerName} took the pot.
          </div>
        )}
        {typeof coinsLost === "number" && coinsLost > 0 && (
          <div className="mt-2 text-2xl font-bold text-red-300 drop-shadow sm:text-3xl">
            -{coinsLost} 💸
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes losedrop {
          0% {
            transform: translateY(-40px) scale(0.6);
            opacity: 0;
          }
          70% {
            transform: translateY(6px) scale(1.05);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes wobble {
          0%,
          100% {
            transform: rotate(-8deg) translateY(0);
          }
          50% {
            transform: rotate(8deg) translateY(4px);
          }
        }
      `}</style>
    </div>
  );
}

/** Classic descending "wah-wah-waaah" sad trombone via the Web Audio API. */
function playSadTrombone() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    // Four descending "wah" notes, each gliding down a little (portamento).
    const steps = [
      { start: 311.13, end: 293.66, at: 0.0 }, // Eb4 -> D4
      { start: 293.66, end: 277.18, at: 0.35 }, // D4 -> C#4
      { start: 277.18, end: 261.63, at: 0.7 }, // C#4 -> C4
      { start: 261.63, end: 196.0, at: 1.05, long: true }, // C4 -> G3 (the big waaah)
    ];
    for (const s of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const wah = ctx.createGain(); // tremolo for the "wah" mouth effect
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = "sawtooth";
      const t = now + s.at;
      const dur = s.long ? 0.9 : 0.32;
      osc.frequency.setValueAtTime(s.start, t);
      osc.frequency.exponentialRampToValueAtTime(s.end, t + dur);

      // Tremolo LFO ~7Hz on the gain to mimic a muted trombone "wah".
      lfo.frequency.value = 7;
      lfoGain.gain.value = 0.15;
      lfo.connect(lfoGain).connect(wah.gain);
      wah.gain.value = 0.85;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(wah).connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch {
    /* audio blocked — ignore */
  }
}
