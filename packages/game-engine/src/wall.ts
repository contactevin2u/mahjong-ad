// Wall construction and the initial deal for a 4-player Singaporean game.
import { Tile, BonusTile, isBonus } from "./types.js";
import { buildFullSet, sortTiles } from "./tiles.js";
import { Rng, shuffle } from "./rng.js";

export type Seat = 0 | 1 | 2 | 3;

export interface PlayerDeal {
  /** Concealed hand tiles (bonus tiles removed and replaced). */
  hand: Tile[];
  /** Bonus tiles (flowers/seasons/animals) this player revealed during the deal. */
  bonus: BonusTile[];
}

export interface Deal {
  players: [PlayerDeal, PlayerDeal, PlayerDeal, PlayerDeal];
  /** Remaining live wall to draw from during play (front). */
  wall: Tile[];
}

/** Build a shuffled wall from a full 148-tile set using the given RNG. */
export function buildWall(rng: Rng): Tile[] {
  return shuffle(buildFullSet(), rng);
}

/**
 * Deal a fresh hand. Dealer (seat 0 / East) gets 14, others 13. Any bonus tiles
 * dealt are set aside and replaced by drawing from the BACK of the wall, repeating
 * until no player holds a bonus tile in hand (a replacement can itself be a bonus).
 */
export function deal(rng: Rng): Deal {
  const wall = buildWall(rng);

  const hands: Tile[][] = [[], [], [], []];
  // Standard deal: 13 tiles each, then dealer draws the 14th to start.
  for (let round = 0; round < 13; round++) {
    for (let seat = 0; seat < 4; seat++) {
      hands[seat].push(wall.shift()!);
    }
  }
  hands[0].push(wall.shift()!); // dealer's 14th

  const bonuses: BonusTile[][] = [[], [], [], []];

  // Replace bonus tiles from the back of the wall until hands are bonus-free.
  for (let seat = 0; seat < 4; seat++) {
    let i = 0;
    while (i < hands[seat].length) {
      const t = hands[seat][i];
      if (isBonus(t)) {
        bonuses[seat].push(t);
        hands[seat].splice(i, 1);
        hands[seat].push(wall.pop()!); // replacement from back
        // do not advance i: the replacement now sits at the end and will be checked
      } else {
        i++;
      }
    }
  }

  const players = hands.map((h, seat) => ({
    hand: sortTiles(h),
    bonus: bonuses[seat],
  })) as [PlayerDeal, PlayerDeal, PlayerDeal, PlayerDeal];

  return { players, wall };
}
