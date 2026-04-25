import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchRecentGames,
  formatGameLabel,
  type ChessComGame,
} from '../utils/chessCom';

interface Props {
  onAnalyze: (pgn: string, depth: number, perspective?: 'white' | 'black') => void;
  busy: boolean;
  defaultUsername?: string;
}

const SAMPLE_PGN = `[Event "Sample"]
[Site "?"]
[Date "2024.01.01"]
[Round "?"]
[White "ArmandoSchach"]
[Black "GH-Hardy"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. O-O f6 6. d4 exd4 7. Nxd4 c5
8. Nb3 Qxd1 9. Rxd1 Bg4 10. f3 Be6 11. Nc3 O-O-O 12. Be3 b6 13. a4 Kb7
14. a5 b5 15. Nd5 Bxd5 16. Rxd5 Rxd5 17. exd5 Nh6 18. d6 cxd6 19. Rd1 Nf5
20. Bxc5 dxc5 21. Rxd8 Nd6 22. Rxf8 1-0`;

type Tab = 'chesscom' | 'pgn';

export function PgnLoader({ onAnalyze, busy, defaultUsername }: Props) {
  const [tab, setTab] = useState<Tab>('chesscom');
  const [pgn, setPgn] = useState('');
  const [depth, setDepth] = useState(14);

  const [username, setUsername] = useState(defaultUsername ?? '');
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [perspective, setPerspective] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [chessComError, setChessComError] = useState<string | null>(null);

  // Auto-load whenever a default username is set (and changes via Settings).
  // Tracked via a ref so we don't re-fetch when the user manually edits the
  // input or `loadGames` redefines below.
  const lastAutoLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    const u = (defaultUsername ?? '').trim();
    if (!u) return;
    if (lastAutoLoadedFor.current === u) return;
    lastAutoLoadedFor.current = u;
    setUsername(u);
    void loadGamesFor(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUsername]);

  async function loadGamesFor(u: string) {
    if (!u) return;
    setLoadingGames(true);
    setChessComError(null);
    setGames([]);
    setSelectedIdx(null);
    try {
      const result = await fetchRecentGames(u, 30);
      if (result.length === 0) {
        setChessComError(`No standard-chess games found for "${u}".`);
      } else {
        setGames(result);
        setPerspective(u);
        setSelectedIdx(0);
      }
    } catch (err) {
      const msg =
        (err as Error & { code?: string }).code === 'not_found'
          ? `Chess.com user "${u}" not found.`
          : (err as Error).message || 'Failed to load games from chess.com.';
      setChessComError(msg);
    } finally {
      setLoadingGames(false);
    }
  }

  async function loadGames() {
    await loadGamesFor(username.trim());
  }

  function startAnalyze() {
    if (tab === 'pgn') {
      const p = pgn.trim();
      if (!p) return;
      onAnalyze(p, depth);
      return;
    }
    if (selectedIdx !== null && games[selectedIdx]) {
      const game = games[selectedIdx];
      const persp: 'white' | 'black' =
        game.white.username.toLowerCase() === perspective.toLowerCase()
          ? 'white'
          : 'black';
      onAnalyze(game.pgn.trim(), depth, persp);
    }
  }

  const canAnalyze =
    !busy &&
    (tab === 'pgn'
      ? pgn.trim().length > 0
      : selectedIdx !== null && !!games[selectedIdx]);

  return (
    <div className="cr-card">
      <div className="cr-card-hd">
        <div className="cr-card-title">Source</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 p-[3px] mx-4 bg-wood-dark/60 rounded-lg">
        <TabBtn active={tab === 'chesscom'} onClick={() => setTab('chesscom')}>
          chess.com
        </TabBtn>
        <TabBtn active={tab === 'pgn'} onClick={() => setTab('pgn')}>
          Paste PGN
        </TabBtn>
      </div>

      <div className="px-4 pt-3 pb-2">
        {tab === 'chesscom' ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-[11.5px] text-ink-3 m-0">
              Enter your chess.com username and pick a recent game.
            </p>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadGames();
                }}
                placeholder="username"
                className="flex-1 h-8 px-2.5 rounded-[7px] border border-line-2 bg-wood-dark/60 text-[12.5px] text-ink outline-none focus:border-accent focus:bg-wood-card focus:ring-2 focus:ring-accent-soft transition-all"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void loadGames()}
                disabled={loadingGames || !username.trim()}
                className="h-8 px-3 rounded-[7px] border border-line-2 bg-wood-card text-ink-2 text-[12px] font-medium hover:bg-wood-hover disabled:opacity-40"
              >
                {loadingGames ? 'Loading…' : 'Load'}
              </button>
            </div>

            {chessComError && (
              <div className="text-[11px] text-review-blunder">{chessComError}</div>
            )}

            {games.length > 0 && (
              <label className="flex flex-col gap-1 text-[11.5px] text-ink-3">
                Game
                <select
                  value={selectedIdx ?? 0}
                  onChange={(e) => setSelectedIdx(parseInt(e.target.value, 10))}
                  className="rounded-[7px] border border-line-2 bg-wood-dark/60 px-2 py-1.5 text-ink font-mono text-[11.5px] focus:outline-none focus:border-accent"
                >
                  {games.map((g, i) => (
                    <option key={g.url} value={i} className="bg-wood-card">
                      {formatGameLabel(g, perspective)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[11.5px] text-ink-3 m-0">
              Paste a PGN below.
            </p>
            <textarea
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={'[Event "..."]\n1. e4 e5 2. Nf3 ...'}
              className="h-32 resize-none rounded-[7px] bg-wood-dark/60 border border-line-2 p-2.5 text-ink-2 text-[11px] font-mono leading-snug focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setPgn(SAMPLE_PGN)}
              className="self-start text-[11px] text-accent-ink hover:text-accent underline-offset-2 hover:underline"
            >
              Insert sample PGN
            </button>
          </div>
        )}
      </div>

      {/* Depth slider */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2 border-t border-line">
        <span className="text-[11.5px] text-ink-3 font-medium">Depth</span>
        <input
          type="range"
          min={6}
          max={24}
          value={depth}
          onChange={(e) => setDepth(parseInt(e.target.value, 10) || 14)}
          className="flex-1 cr-range"
        />
        <span className="font-mono text-[12px] font-semibold min-w-[18px] text-right">
          {depth}
        </span>
      </div>

      <div className="px-4 pb-4 pt-1">
        <button
          type="button"
          disabled={!canAnalyze}
          onClick={startAnalyze}
          className={
            'w-full h-[38px] rounded-[9px] flex items-center justify-center gap-2 text-[13px] font-semibold transition-all ' +
            (canAnalyze
              ? 'accent-grad text-wood-dark hover:brightness-110'
              : 'bg-wood-hover text-ink-4 cursor-not-allowed')
          }
          style={{
            boxShadow: canAnalyze
              ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 4px rgba(0, 0, 0, 0.35)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
          }}
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex-1 px-2.5 py-1.5 text-[11.5px] font-medium rounded-md transition-colors ' +
        (active
          ? 'bg-wood-card text-ink shadow-card'
          : 'text-ink-3 hover:text-ink')
      }
    >
      {children}
    </button>
  );
}
