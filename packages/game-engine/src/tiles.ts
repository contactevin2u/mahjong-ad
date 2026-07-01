// Tile identity, serialization, sorting, and set construction.
import {
  Tile,
  Suit,
  Rank,
  SUITS,
  WINDS,
  DRAGONS,
  FlowerKind,
  SeasonKind,
  AnimalKind,
} from "./types.js";

const FLOWERS: FlowerKind[] = ["plum", "orchid", "chrysanthemum", "bamboo"];
const SEASONS: SeasonKind[] = ["spring", "summer", "autumn", "winter"];
const ANIMALS: AnimalKind[] = ["cat", "rat", "rooster", "centipede"];

/**
 * A stable string id for a tile (ignores copies). Used for equality, sorting,
 * counting, and network serialization. Examples: "dots-5", "wind-east",
 * "dragon-red", "flower-plum", "season-spring", "animal-cat".
 */
export function tileId(t: Tile): string {
  switch (t.kind) {
    case "suit":
      return `${t.suit}-${t.rank}`;
    case "wind":
      return `wind-${t.wind}`;
    case "dragon":
      return `dragon-${t.dragon}`;
    case "flower":
      return `flower-${t.flower}`;
    case "season":
      return `season-${t.season}`;
    case "animal":
      return `animal-${t.animal}`;
  }
}

export function sameTile(a: Tile, b: Tile): boolean {
  return tileId(a) === tileId(b);
}

/** Deterministic ordering used to sort a hand for display and comparison. */
const KIND_ORDER: Record<Tile["kind"], number> = {
  suit: 0,
  wind: 1,
  dragon: 2,
  flower: 3,
  season: 4,
  animal: 5,
};

function sortWeight(t: Tile): number {
  const base = KIND_ORDER[t.kind] * 1000;
  switch (t.kind) {
    case "suit":
      return base + SUITS.indexOf(t.suit) * 10 + t.rank;
    case "wind":
      return base + WINDS.indexOf(t.wind);
    case "dragon":
      return base + DRAGONS.indexOf(t.dragon);
    case "flower":
      return base + t.index;
    case "season":
      return base + t.index;
    case "animal":
      return base + ANIMALS.indexOf(t.animal);
  }
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => sortWeight(a) - sortWeight(b));
}

/** Build one complete, unshuffled 148-tile Singaporean set. */
export function buildFullSet(): Tile[] {
  const tiles: Tile[] = [];

  // 108 suited: each suit 1-9, 4 copies
  for (const suit of SUITS as Suit[]) {
    for (let rank = 1 as Rank; rank <= 9; rank = (rank + 1) as Rank) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ kind: "suit", suit, rank });
      }
    }
  }

  // 16 winds (4 each)
  for (const wind of WINDS) {
    for (let copy = 0; copy < 4; copy++) tiles.push({ kind: "wind", wind });
  }

  // 12 dragons (4 each)
  for (const dragon of DRAGONS) {
    for (let copy = 0; copy < 4; copy++) tiles.push({ kind: "dragon", dragon });
  }

  // 4 flowers (gentlemen), 1 each — index maps to a seat wind
  FLOWERS.forEach((flower, i) => {
    tiles.push({ kind: "flower", flower, index: (i + 1) as 1 | 2 | 3 | 4 });
  });

  // 4 seasons, 1 each — index maps to a seat wind
  SEASONS.forEach((season, i) => {
    tiles.push({ kind: "season", season, index: (i + 1) as 1 | 2 | 3 | 4 });
  });

  // 4 animals, 1 each
  for (const animal of ANIMALS) tiles.push({ kind: "animal", animal });

  return tiles;
}

export const FULL_SET_SIZE = 148;
