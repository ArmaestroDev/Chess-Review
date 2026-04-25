import { useState } from 'react';
import {
  fetchRecentGames,
  formatGameLabel,
  type ChessComGame,
} from '../utils/chessCom';

interface Props {
  onAnalyze: (pgn: string, depth: number, perspective?: 'white' | 'black') => void;
  busy: boolean;
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

export function PgnLoader({ onAnalyze, busy }: Props) {
  const [tab, setTab] = useState<Tab>('chesscom');
  const [pgn, setPgn] = useState('');
  const [depth, setDepth] = useState(14);

  // Chess.com state
  const [username, setUsername] = useState('');
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [perspective, setPerspective] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [chessComError, setChessComError] = useState<string | null>(null);

  async function loadGames() {
    const u = username.trim();
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
        game.white.username.toLowerCase() === perspective.toLowerCase() ? 'white' : 'black';
      onAnalyze(game.pgn.trim(), depth, persp);
    }
  }

  const canAnalyze =
    !busy &&
    (tab === 'pgn' ? pgn.trim().length > 0 : selectedIdx !== null && !!games[selectedIdx]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex rounded overflow-hidden border border-white/10 self-start">
        <TabButton active={tab === 'chesscom'} onClick={() => setTab('chesscom')}>
          chess.com
        </TabButton>
        <TabButton active={tab === 'pgn'} onClick={() => setTab('pgn')}>
          Paste PGN
        </TabButton>
      </div>

      {tab === 'chesscom' ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-stone-300">
            Enter your chess.com username and pick a recent game.
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadGames();
              }}
              placeholder="username"
              className="flex-1 rounded bg-black/40 border border-white/10 px-2 py-1.5 text-sm text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => void loadGames()}
              disabled={loadingGames || !username.trim()}
              className="rounded bg-stone-100/95 hover:bg-stone-100 disabled:opacity-40 text-stone-900 text-sm font-bold px-3"
            >
              {loadingGames ? 'Loading…' : 'Load games'}
            </button>
          </div>

          {chessComError && (
            <div className="text-xs text-red-300">{chessComError}</div>
          )}

          {games.length > 0 && (
            <label className="flex flex-col gap-1 text-sm text-stone-300">
              Game
              <select
                value={selectedIdx ?? 0}
                onChange={(e) => setSelectedIdx(parseInt(e.target.value, 10))}
                className="rounded bg-black/40 border border-white/10 px-2 py-1.5 text-stone-100 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {games.map((g, i) => (
                  <option key={g.url} value={i} className="bg-stone-800">
                    {formatGameLabel(g, perspective)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-stone-300">
            Paste a PGN below and click <span className="font-bold">Analyze</span>.
          </div>
          <textarea
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder={'[Event "..."]\n1. e4 e5 2. Nf3 ...'}
            className="h-44 resize-none rounded bg-black/40 border border-white/10 p-2 text-stone-100 text-[13px] font-mono leading-snug focus:outline-none focus:ring-2 focus:ring-amber-400"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setPgn(SAMPLE_PGN)}
            className="self-start text-sm text-amber-300/90 hover:text-amber-200 underline-offset-2 hover:underline"
          >
            Insert sample PGN
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm text-stone-300">
          Depth
          <input
            type="number"
            min={6}
            max={24}
            value={depth}
            onChange={(e) => setDepth(parseInt(e.target.value, 10) || 14)}
            className="ml-2 w-16 rounded bg-black/40 border border-white/10 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!canAnalyze}
        onClick={startAnalyze}
        className="rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-600/40 disabled:text-stone-400 text-white font-bold py-2 px-4 transition-colors"
      >
        {busy ? 'Analyzing…' : 'Analyze'}
      </button>
    </div>
  );
}

function TabButton({
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
        'px-3 py-1.5 text-sm font-semibold transition-colors ' +
        (active
          ? 'bg-amber-300 text-stone-900'
          : 'bg-black/30 text-stone-200 hover:bg-black/40')
      }
    >
      {children}
    </button>
  );
}
