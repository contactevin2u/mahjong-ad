// Shared client-side gameplay config.
// NOTE: this is a UX gate only. The server independently enforces the entry fee
// (escrows coins) when a player actually joins a table in Phase 3 — the client
// can never grant itself a seat without coins.

/** Minimum coins required to sit at a table (smallest table stake). */
export const MIN_PLAY_COINS = 100;
