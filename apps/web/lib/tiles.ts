// Frontend tile types (mirror the engine) + Unicode/emoji glyph rendering.
export type Suit = "dots" | "bamboo" | "characters";
export type Tile =
  | { kind: "suit"; suit: Suit; rank: number }
  | { kind: "wind"; wind: "east" | "south" | "west" | "north" }
  | { kind: "dragon"; dragon: "red" | "green" | "white" }
  | { kind: "flower"; flower: string; index: number }
  | { kind: "season"; season: string; index: number }
  | { kind: "animal"; animal: string };

export interface Meld {
  type: "chow" | "pong" | "kong";
  tiles: Tile[];
  exposed: boolean;
}

// Unicode Mahjong Tiles block base code points.
const MAN = 0x1f007; // characters 1..9
const SOU = 0x1f010; // bamboo 1..9
const PIN = 0x1f019; // dots 1..9
const WINDS: Record<string, number> = {
  east: 0x1f000,
  south: 0x1f001,
  west: 0x1f002,
  north: 0x1f003,
};
const DRAGONS: Record<string, number> = {
  red: 0x1f004,
  green: 0x1f005,
  white: 0x1f006,
};
const ANIMALS: Record<string, string> = {
  cat: "🐱",
  rat: "🐭",
  rooster: "🐔",
  centipede: "🐛",
};

/** A display glyph for a tile. */
export function tileGlyph(t: Tile): string {
  switch (t.kind) {
    case "suit": {
      const base = t.suit === "characters" ? MAN : t.suit === "bamboo" ? SOU : PIN;
      return String.fromCodePoint(base + (t.rank - 1));
    }
    case "wind":
      return String.fromCodePoint(WINDS[t.wind]);
    case "dragon":
      return String.fromCodePoint(DRAGONS[t.dragon]);
    case "flower":
      return String.fromCodePoint(0x1f026 + ((t.index - 1) % 4)); // 🀦..🀩
    case "season":
      return String.fromCodePoint(0x1f022 + ((t.index - 1) % 4)); // 🀢..🀥
    case "animal":
      return ANIMALS[t.animal] ?? "🐾";
  }
}

/** A short text label (for accessibility / fallback). */
export function tileLabel(t: Tile): string {
  switch (t.kind) {
    case "suit":
      return `${t.rank}${t.suit[0].toUpperCase()}`;
    case "wind":
      return `${t.wind[0].toUpperCase()}W`;
    case "dragon":
      return `${t.dragon[0].toUpperCase()}D`;
    case "flower":
      return `F${t.index}`;
    case "season":
      return `S${t.index}`;
    case "animal":
      return t.animal;
  }
}

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
