// Remote-puzzle fetcher. Hits the backend proxy (which adds the RapidAPI
// key server-side) so the API key never enters the browser.
//
// Used for:
//   - Daily puzzle (daily.json holds only IDs)
//   - URL-direct links to /puzzles/:id when the ID isn't in the local catalog
//
// Tier-based selection uses pickFromCatalog instead — instant, offline,
// no rate-limit pressure.

import type { Puzzle } from '../types';
import { findInCatalog } from './catalog';

/**
 * Fetch a puzzle by ID. Tries the bundled catalog first (zero-latency);
 * falls back to the backend proxy for IDs we don't ship locally (daily,
 * deep-linked URLs).
 *
 * Throws on network failure or upstream error so callers can put the
 * solver into an error state. Returns null only if the API responded
 * with a malformed body we can't normalize.
 */
export async function fetchPuzzleById(id: string): Promise<Puzzle | null> {
  const local = findInCatalog(id);
  if (local) return local;

  const res = await fetch(`/api/puzzles/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(
      typeof body.error === 'string' ? body.error : `HTTP ${res.status}`,
    );
  }
  const raw = await res.json();
  return normalizeRemotePuzzle(raw);
}

/**
 * The chess-puzzles RapidAPI was unreachable at planning time, so we don't
 * know the exact field-name casing. Be defensive: accept either the Lichess
 * CSV's PascalCase (PuzzleId, FEN, Moves, ...) or a camelCase shape, and
 * accept Moves as either a space-separated string or an already-split array.
 */
function normalizeRemotePuzzle(raw: unknown): Puzzle | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = pickString(r, ['puzzleId', 'PuzzleId', 'id']);
  const fen = pickString(r, ['fen', 'FEN']);
  const movesField = r.moves ?? r.Moves;
  const ratingField = r.rating ?? r.Rating;
  const popularityField = r.popularity ?? r.Popularity;
  const nbPlaysField = r.nbPlays ?? r.NbPlays;
  const themesField = r.themes ?? r.Themes;

  if (!id || !fen || movesField == null || ratingField == null) {
    return null;
  }

  const moves = Array.isArray(movesField)
    ? movesField.map(String).filter(Boolean)
    : typeof movesField === 'string'
      ? movesField.split(/\s+/).filter(Boolean)
      : null;
  if (!moves || moves.length === 0) return null;

  const themes = Array.isArray(themesField)
    ? themesField.map(String)
    : typeof themesField === 'string'
      ? themesField.split(/\s+/).filter(Boolean)
      : [];

  const rating = toNumber(ratingField);
  if (!Number.isFinite(rating)) return null;

  return {
    id,
    fen,
    moves,
    rating,
    popularity: Number.isFinite(toNumber(popularityField))
      ? toNumber(popularityField)
      : 0,
    nbPlays: Number.isFinite(toNumber(nbPlaysField))
      ? toNumber(nbPlaysField)
      : 0,
    themes,
  };
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number.parseInt(v, 10);
  return Number.NaN;
}
