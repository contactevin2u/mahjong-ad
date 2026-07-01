// Simplified Singaporean "tai" scoring for a winning hand. Computes only the
// patterns that are robust to read off tile counts + melds (no full hand
// decomposition), which covers the common, satisfying cases. Full tai tables
// (all-triplets, pure terminals, thirteen wonders, etc.) can be layered later.
import { isBonus, WINDS } from "./types.js";
import { tileId } from "./tiles.js";
import { GameState } from "./game.js";
import { Seat } from "./wall.js";

export interface Score {
  tai: number;
  parts: { name: string; tai: number }[];
}

const MAX_TAI = 6;

export function scoreWin(state: GameState, seat: Seat): Score {
  const p = state.players[seat];
  const parts: { name: string; tai: number }[] = [];
  const add = (name: string, tai: number) => parts.push({ name, tai });

  const nonBonus = [
    ...p.hand,
    ...p.melds.flatMap((m) => m.tiles),
  ].filter((t) => !isBonus(t));

  // Flush
  const suitsUsed = new Set(
    nonBonus.filter((t) => t.kind === "suit").map((t) => (t as any).suit)
  );
  const hasHonor = nonBonus.some((t) => t.kind === "wind" || t.kind === "dragon");
  if (suitsUsed.size === 1 && !hasHonor) add("Full flush", 4);
  else if (suitsUsed.size === 1 && hasHonor) add("Half flush", 2);

  // Triplets of value tiles (from exposed melds + concealed triples)
  const concealed = new Map<string, number>();
  for (const t of p.hand) concealed.set(tileId(t), (concealed.get(tileId(t)) ?? 0) + 1);
  const tripletIds = new Set<string>();
  for (const m of p.melds)
    if (m.type === "pong" || m.type === "kong") tripletIds.add(tileId(m.tiles[0]));
  for (const [id, n] of concealed) if (n >= 3) tripletIds.add(id);

  for (const id of tripletIds) {
    if (id.startsWith("dragon-")) add("Dragon pong", 1);
    if (id === `wind-${p.seatWind}`) add("Seat wind pong", 1);
    if (id === `wind-${state.prevailingWind}`) add("Prevailing wind pong", 1);
  }

  // Bonus tiles
  const animals = p.bonus.filter((t) => t.kind === "animal").length;
  if (animals) add(`${animals} animal${animals > 1 ? "s" : ""}`, animals);
  const seatIndex = WINDS.indexOf(p.seatWind) + 1; // East=1 … North=4
  const flowersMatch = p.bonus.filter(
    (t) => (t.kind === "flower" || t.kind === "season") && (t as any).index === seatIndex
  ).length;
  if (flowersMatch) add(`${flowersMatch} matching flower${flowersMatch > 1 ? "s" : ""}`, flowersMatch);

  // Win condition bonus
  if (state.winBy === "self-draw") add("Self-draw", 1);

  const raw = parts.reduce((s, x) => s + x.tai, 0);
  return { tai: Math.min(raw, MAX_TAI), parts };
}
