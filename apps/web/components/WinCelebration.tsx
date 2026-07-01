"use client";
// Reusable win celebration overlay: canvas confetti + animated "MAHJONG!" banner
// + floating coin count + a short chime. Self-contained (no external libs/assets).
//
// Usage:
//   <WinCelebration
//     show={didWin}
//     title="MAHJONG!"
//     winnerName="You"
//     coinsWon={240}
//     onDone={() => setDidWin(false)}
//   />
import { useEffect, useRef } from "react";

interface WinCelebrationProps {
  show: boolean;
  title?: string;
  winnerName?: string;
  coinsWon?: number;
  /** Called when the celebration finishes (default ~4s). */
  onDone?: () => void;
  /** Play the chime (default true). Muted automatically if the browser blocks audio. */
  sound?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
  shape: "rect" | "circle";
}

const COLORS = ["#e8c268", "#ffd93d", "#ff6b6b", "#4ecdc4", "#ffffff", "#f7b32b"];

export function WinCelebration({
  show,
  title = "MAHJONG!",
  winnerName,
  coinsWon,
  onDone,
  sound = true,
}: WinCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!show) return;

    if (sound) playChime();

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

    // Emit an initial burst from two lower corners + a top shower.
    const particles: Particle[] = [];
    const spawnBurst = (originX: number, originY: number, count: number, spread: number) => {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
        const speed = 6 + Math.random() * 9;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 6 + Math.random() * 8,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.3,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          shape: Math.random() > 0.5 ? "rect" : "circle",
        });
      }
    };
    spawnBurst(W() * 0.15, H() * 0.85, 90, 1.2);
    spawnBurst(W() * 0.85, H() * 0.85, 90, 1.2);

    let frame = 0;
    const gravity = 0.22;
    const maxFrames = 240; // ~4s at 60fps

    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, W(), H());

      // Gentle top shower for the first ~1.5s.
      if (frame < 90 && frame % 3 === 0) {
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: Math.random() * W(),
            y: -10,
            vx: (Math.random() - 0.5) * 2,
            vy: 2 + Math.random() * 3,
            size: 5 + Math.random() * 7,
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 0.3,
            color: COLORS[(Math.random() * COLORS.length) | 0],
            shape: Math.random() > 0.5 ? "rect" : "circle",
          });
        }
      }

      const fade = frame > maxFrames - 40 ? Math.max(0, (maxFrames - frame) / 40) : 1;

      for (const p of particles) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
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
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="relative flex flex-col items-center animate-[winpop_0.6s_ease-out]">
        <div className="text-6xl drop-shadow-lg sm:text-8xl">🀄</div>
        <div
          className="mt-2 bg-gradient-to-b from-yellow-200 to-gold bg-clip-text text-5xl font-black tracking-widest text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-7xl"
          style={{ WebkitTextStroke: "1px rgba(0,0,0,0.25)" }}
        >
          {title}
        </div>
        {winnerName && (
          <div className="mt-3 text-xl font-semibold text-white drop-shadow sm:text-2xl">
            {winnerName} wins!
          </div>
        )}
        {typeof coinsWon === "number" && (
          <div className="mt-2 animate-bounce text-2xl font-bold text-gold drop-shadow sm:text-3xl">
            +{coinsWon} 💰
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes winpop {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          60% {
            transform: scale(1.15);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

/** A short ascending arpeggio using the Web Audio API — no audio file needed. */
function playChime() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = now + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    // Close the context after the sound finishes.
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* audio blocked — ignore */
  }
}
