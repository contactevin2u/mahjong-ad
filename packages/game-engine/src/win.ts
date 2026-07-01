// Standard win detection: a hand wins when its 14 tiles (concealed + already
// melded) decompose into 4 sets (chow/pong) + 1 pair. Bonus tiles never count.
// (Special hands like Thirteen Orphans / Seven Pairs can be layered on later.)
import { Tile, Meld, isBonus } from "./types.js";
import { tileId } from "./tiles.js";

/** Count tiles by id for the suited/honor decomposition. */
function toCounts(tiles: Tile[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tiles) {
    if (isBonus(t)) continue;
    const id = tileId(t);
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

// Suited ids look like "dots-5"; honor ids look like "wind-east" / "dragon-red".
function parseSuited(id: string): { suit: string; rank: number } | null {
  const [a, b] = id.split("-");
  if (a === "dots" || a === "bamboo" || a === "characters") {
    return { suit: a, rank: Number(b) };
  }
  return null;
}

/** Can the remaining counts be fully split into sets (pongs + chows)? */
function canFormSets(counts: Map<string, number>): boolean {
  // Find the "smallest" remaining tile to reduce branching deterministically.
  let firstId: string | null = null;
  for (const [id, c] of counts) {
    if (c > 0) {
      firstId = id;
      break;
    }
  }
  if (firstId === null) return true; // nothing left → success

  const n = counts.get(firstId)!;

  // Try a pong (triplet).
  if (n >= 3) {
    counts.set(firstId, n - 3);
    if (canFormSets(counts)) {
      counts.set(firstId, n);
      return true;
    }
    counts.set(firstId, n);
  }

  // Try a chow (run) — only for suited tiles.
  const suited = parseSuited(firstId);
  if (suited && suited.rank <= 7) {
    const id2 = `${suited.suit}-${suited.rank + 1}`;
    const id3 = `${suited.suit}-${suited.rank + 2}`;
    if ((counts.get(id2) ?? 0) > 0 && (counts.get(id3) ?? 0) > 0) {
      counts.set(firstId, n - 1);
      counts.set(id2, counts.get(id2)! - 1);
      counts.set(id3, counts.get(id3)! - 1);
      if (canFormSets(counts)) {
        counts.set(firstId, n);
        counts.set(id2, counts.get(id2)! + 1);
        counts.set(id3, counts.get(id3)! + 1);
        return true;
      }
      counts.set(firstId, n);
      counts.set(id2, counts.get(id2)! + 1);
      counts.set(id3, counts.get(id3)! + 1);
    }
  }

  return false;
}

/**
 * Is `concealed` (plus any exposed `melds`) a complete standard winning hand?
 * `melds` are already-formed sets (each 3-4 tiles); we only need the concealed
 * tiles to split into (4 - melds.length) sets + exactly one pair.
 */
export function isWinningHand(concealed: Tile[], melds: Meld[] = []): boolean {
  const counts = toCounts(concealed);
  const needSets = 4 - melds.length;
  if (needSets < 0) return false;

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total !== needSets * 3 + 2) return false; // must be exactly sets*3 + pair

  // Try each candidate pair, then check the rest forms sets.
  for (const [id, c] of counts) {
    if (c >= 2) {
      counts.set(id, c - 2);
      if (canFormSets(counts)) {
        counts.set(id, c);
        return true;
      }
      counts.set(id, c);
    }
  }
  return false;
}
