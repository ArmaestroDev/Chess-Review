import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchProfile,
  fetchRecentGames,
  fetchStats,
  type ChessComGame,
  type ChessComProfile,
  type ChessComStats,
} from '../../shared/utils/chessCom';
import { computeActivity, type ChessComActivity } from './utils/chessComActivity';

export type ChessComLoadError = 'not_found' | 'failed' | null;

interface Options {
  /** From settings. When non-empty and changed, auto-loads on mount/update. */
  defaultUsername?: string;
}

/**
 * Owns chess.com fetching for the review page: profile, stats, recent games,
 * and the derived 30-game activity summary. Lifted above the desktop/mobile
 * variant split (called from ReviewPage) so the data survives a breakpoint
 * cross and is shared by the PgnLoader and the start-page stats card.
 *
 * `usernameInput` is the live text in the loader's input field; it is
 * separate from `committedUsername`, which only updates when a load actually
 * fires. This way the stats card never flickers on every keystroke.
 */
export function useChessComProfile({ defaultUsername }: Options) {
  const [usernameInput, setUsernameInput] = useState<string>(defaultUsername ?? '');
  const [committedUsername, setCommittedUsername] = useState<string>('');
  const [profile, setProfile] = useState<ChessComProfile | null>(null);
  const [stats, setStats] = useState<ChessComStats | null>(null);
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ChessComLoadError>(null);

  // Tracks the latest in-flight committed username so that out-of-order
  // resolutions from a stale load can't clobber the newer state.
  const inFlightRef = useRef<string>('');
  // Tracks which defaultUsername we already auto-loaded for so we don't
  // re-fetch on every render.
  const lastDefaultRef = useRef<string | null>(null);

  const load = useCallback(
    async (raw?: string) => {
      const target = (raw ?? usernameInput).trim();
      if (!target) return;

      inFlightRef.current = target;
      setUsernameInput(target);
      setCommittedUsername(target);
      setLoading(true);
      setError(null);
      setProfile(null);
      setStats(null);
      setGames([]);

      const [profileRes, statsRes, gamesRes] = await Promise.allSettled([
        fetchProfile(target),
        fetchStats(target),
        fetchRecentGames(target, 30),
      ]);

      if (inFlightRef.current !== target) return;

      const profile404 =
        profileRes.status === 'rejected' &&
        (profileRes.reason as Error & { code?: string })?.code === 'not_found';
      const games404 =
        gamesRes.status === 'rejected' &&
        (gamesRes.reason as Error & { code?: string })?.code === 'not_found';

      if (profile404 || games404) {
        setError('not_found');
        setLoading(false);
        return;
      }

      if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (gamesRes.status === 'fulfilled') setGames(gamesRes.value);

      const allFailed =
        profileRes.status === 'rejected' &&
        statsRes.status === 'rejected' &&
        gamesRes.status === 'rejected';
      if (allFailed) setError('failed');

      setLoading(false);
    },
    [usernameInput],
  );

  useEffect(() => {
    const u = (defaultUsername ?? '').trim();
    if (!u) return;
    if (lastDefaultRef.current === u) return;
    lastDefaultRef.current = u;
    setUsernameInput(u);
    void load(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUsername]);

  const activity = useMemo<ChessComActivity | null>(() => {
    if (!games.length || !committedUsername) return null;
    return computeActivity(games, committedUsername);
  }, [games, committedUsername]);

  return {
    usernameInput,
    setUsernameInput,
    committedUsername,
    profile,
    stats,
    games,
    activity,
    loading,
    error,
    load,
  };
}

export type ChessComProfileState = ReturnType<typeof useChessComProfile>;
