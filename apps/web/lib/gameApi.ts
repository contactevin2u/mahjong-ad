// Client for the single-player game endpoints.
import { api } from "./api";
import { Tile, Meld } from "./tiles";

export interface PlayerView {
  seat: number;
  seatWind: string;
  handCount: number;
  melds: Meld[];
  bonus: Tile[];
}

export interface GameView {
  phase: "action" | "claims" | "ended";
  dealer: number;
  prevailingWind: string;
  currentTurn: number;
  lastDiscard: { seat: number; tile: Tile } | null;
  discards: { seat: number; tile: Tile }[];
  wallRemaining: number;
  winner: number | null;
  winningTile: Tile | null;
  winBy: "self-draw" | "discard" | null;
  you: { seat: number; hand: Tile[]; melds: Meld[]; bonus: Tile[] };
  players: PlayerView[];
}

export type ClaimOption = { type: "win" | "kong" | "pong" | "chow"; useTiles?: Tile[] };

export type Options =
  | { kind: "action"; discards: Tile[]; canSelfWin: boolean; concealedKongs: Tile[][] }
  | { kind: "claims"; claims: ClaimOption[] }
  | { kind: "wait" };

export interface GameResult {
  ended: boolean;
  winner: number | null;
  winBy: "self-draw" | "discard" | null;
  youWon: boolean;
  payout: number;
  balance: number | null;
}

export interface GameResponse {
  gameId: string;
  stake: number;
  view: GameView;
  options: Options;
  result: GameResult | null;
}

export function startSingle(stake: number) {
  return api<GameResponse>("/game/single/start", {
    method: "POST",
    body: JSON.stringify({ stake }),
  });
}

export function getGame(id: string) {
  return api<GameResponse>(`/game/single/${id}`);
}

export type Action =
  | { type: "discard"; tile: Tile }
  | { type: "selfWin" }
  | { type: "concealedKong"; tile: Tile }
  | { type: "claim"; claim: ClaimOption | "pass" };

export function sendAction(id: string, action: Action) {
  return api<GameResponse>(`/game/single/${id}/action`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}
