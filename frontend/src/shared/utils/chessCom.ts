// Browser-side client for chess.com's public API (no auth required, CORS-enabled).
// Docs: https://www.chess.com/news/view/published-data-api

export interface ChessComPlayerSide {
  username: string;
  rating: number;
  result: string; // win | checkmated | timeout | resigned | stalemate | repetition | ...
}

export type ChessComTimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  time_class: ChessComTimeClass;
  end_time: number;
  rated: boolean;
  rules: string;
  white: ChessComPlayerSide;
  black: ChessComPlayerSide;
  /** chess.com-computed accuracies; only present on some games. 0–100. */
  accuracies?: { white?: number; black?: number };
  /** ECO opening URL like https://www.chess.com/openings/Italian-Game */
  eco?: string;
}

export interface ChessComProfile {
  '@id': string;
  url: string;
  username: string;
  player_id: number;
  name?: string;
  title?: string;
  avatar?: string;
  followers?: number;
  /** URL like /pub/country/US — fetch separately to resolve to a country name. */
  country?: string;
  location?: string;
  /** Unix timestamp (seconds) — member-since. */
  joined?: number;
  last_online?: number;
  status?: string;
  is_streamer?: boolean;
  twitch_url?: string;
  verified?: boolean;
  league?: string;
}

export interface ChessComRatingSnapshot {
  rating: number;
  date: number;
  /** Glicko rating deviation. */
  rd?: number;
}

export interface ChessComRatingPeak {
  rating: number;
  date: number;
  /** URL to the game where the peak was set. */
  game?: string;
}

export interface ChessComRatingRecord {
  win: number;
  loss: number;
  draw: number;
  time_per_move?: number;
  timeout_percent?: number;
}

export interface ChessComBucketStats {
  last?: ChessComRatingSnapshot;
  best?: ChessComRatingPeak;
  record?: ChessComRatingRecord;
}

export interface ChessComStats {
  chess_bullet?: ChessComBucketStats;
  chess_blitz?: ChessComBucketStats;
  chess_rapid?: ChessComBucketStats;
  chess_daily?: ChessComBucketStats;
  chess960_daily?: ChessComBucketStats;
  fide?: number;
  tactics?: { highest?: { rating: number; date: number }; lowest?: { rating: number; date: number } };
  puzzle_rush?: { best?: { total_attempts: number; score: number } };
}

const BASE = 'https://api.chess.com/pub';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 404) {
    const err = new Error('not_found') as Error & { code?: string };
    err.code = 'not_found';
    throw err;
  }
  if (!res.ok) throw new Error(`chess.com request failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchProfile(username: string): Promise<ChessComProfile> {
  return getJson<ChessComProfile>(
    `${BASE}/player/${encodeURIComponent(username.trim().toLowerCase())}`,
  );
}

export async function fetchStats(username: string): Promise<ChessComStats> {
  return getJson<ChessComStats>(
    `${BASE}/player/${encodeURIComponent(username.trim().toLowerCase())}/stats`,
  );
}

/** Returns archive URLs (one per month the player has played), oldest → newest. */
export async function fetchArchives(username: string): Promise<string[]> {
  const data = await getJson<{ archives?: string[] }>(
    `${BASE}/player/${encodeURIComponent(username.trim().toLowerCase())}/games/archives`,
  );
  return data.archives ?? [];
}

export async function fetchArchiveGames(archiveUrl: string): Promise<ChessComGame[]> {
  const data = await getJson<{ games?: ChessComGame[] }>(archiveUrl);
  return data.games ?? [];
}

/**
 * Walks archives newest-first and returns up to `max` recent standard-chess games
 * with PGNs. Variants are filtered out so the analyzer always gets a parseable game.
 */
export async function fetchRecentGames(username: string, max = 30): Promise<ChessComGame[]> {
  const archives = await fetchArchives(username);
  if (archives.length === 0) return [];
  const out: ChessComGame[] = [];
  for (let i = archives.length - 1; i >= 0 && out.length < max; i--) {
    let games: ChessComGame[];
    try {
      games = await fetchArchiveGames(archives[i]);
    } catch {
      continue;
    }
    for (let j = games.length - 1; j >= 0 && out.length < max; j--) {
      const g = games[j];
      if (g.rules !== 'chess') continue;
      if (!g.pgn || !g.pgn.trim()) continue;
      out.push(g);
    }
  }
  return out;
}

export function describeResult(game: ChessComGame, perspective: string): 'win' | 'loss' | 'draw' {
  const me = game.white.username.toLowerCase() === perspective.toLowerCase() ? game.white : game.black;
  if (me.result === 'win') return 'win';
  const drawResults = new Set([
    'agreed',
    'repetition',
    'stalemate',
    'insufficient',
    'timevsinsufficient',
    '50move',
  ]);
  if (drawResults.has(me.result)) return 'draw';
  return 'loss';
}

export function formatGameLabel(game: ChessComGame, perspective: string): string {
  const isWhite = game.white.username.toLowerCase() === perspective.toLowerCase();
  const opponent = isWhite ? game.black : game.white;
  const result = describeResult(game, perspective);
  const date = new Date(game.end_time * 1000).toISOString().slice(0, 10);
  const resultEmoji = result === 'win' ? 'W' : result === 'loss' ? 'L' : 'D';
  const tc = game.time_class;
  return `${resultEmoji} vs ${opponent.username} (${opponent.rating}) — ${tc} — ${date}`;
}
