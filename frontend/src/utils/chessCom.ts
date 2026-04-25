// Browser-side client for chess.com's public API (no auth required, CORS-enabled).
// Docs: https://www.chess.com/news/view/published-data-api

export interface ChessComPlayerSide {
  username: string;
  rating: number;
  result: string; // win | checkmated | timeout | resigned | stalemate | repetition | ...
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  time_class: 'bullet' | 'blitz' | 'rapid' | 'daily';
  end_time: number;
  rated: boolean;
  rules: string;
  white: ChessComPlayerSide;
  black: ChessComPlayerSide;
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
