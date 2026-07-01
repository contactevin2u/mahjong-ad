// Core tile & game types for Singaporean Mahjong.
// A full Singapore set = 148 tiles:
//   108 suited (dots/bamboo/characters 1-9, x4)
//   +16 winds (E/S/W/N x4)  +12 dragons (red/green/white x4)
//   +8 flowers (4 gentlemen + 4 seasons, x1)  +4 animals (x1)

export type Suit = "dots" | "bamboo" | "characters";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Wind = "east" | "south" | "west" | "north";
export type Dragon = "red" | "green" | "white";

/** The 4 "gentlemen" flowers + 4 seasons. Each carries an index 1-4 that maps to a seat wind. */
export type FlowerKind = "plum" | "orchid" | "chrysanthemum" | "bamboo"; // gentlemen (flowers)
export type SeasonKind = "spring" | "summer" | "autumn" | "winter"; // seasons
export type AnimalKind = "cat" | "rat" | "rooster" | "centipede"; // Singapore animals

export type SuitTile = { kind: "suit"; suit: Suit; rank: Rank };
export type WindTile = { kind: "wind"; wind: Wind };
export type DragonTile = { kind: "dragon"; dragon: Dragon };
export type FlowerTile = { kind: "flower"; flower: FlowerKind; index: 1 | 2 | 3 | 4 };
export type SeasonTile = { kind: "season"; season: SeasonKind; index: 1 | 2 | 3 | 4 };
export type AnimalTile = { kind: "animal"; animal: AnimalKind };

export type Tile =
  | SuitTile
  | WindTile
  | DragonTile
  | FlowerTile
  | SeasonTile
  | AnimalTile;

/** Bonus tiles (flowers/seasons/animals) are set aside and replaced, never part of a hand's melds. */
export type BonusTile = FlowerTile | SeasonTile | AnimalTile;

export function isBonus(t: Tile): t is BonusTile {
  return t.kind === "flower" || t.kind === "season" || t.kind === "animal";
}

export function isHonor(t: Tile): t is WindTile | DragonTile {
  return t.kind === "wind" || t.kind === "dragon";
}

/** Meld types formed during play. */
export type MeldType = "chow" | "pong" | "kong";
export type Meld = {
  type: MeldType;
  tiles: Tile[];
  /** true if formed by claiming another player's discard (exposed), false if concealed. */
  exposed: boolean;
};

export const WINDS: Wind[] = ["east", "south", "west", "north"];
export const DRAGONS: Dragon[] = ["red", "green", "white"];
export const SUITS: Suit[] = ["dots", "bamboo", "characters"];
