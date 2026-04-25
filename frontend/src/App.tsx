import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type BoardArrow } from './components/Board';
import { EvalBar } from './components/EvalBar';
import { ReviewPanel } from './components/ReviewPanel';
import { socket } from './socket';
import type {
  AnalysisEvent,
  GameMeta,
  MoveAnalysis,
  MoveTree,
  NodeId,
} from './types';
import {
  addChild,
  createTree,
  findChildByUci,
  fullMainline,
  isOnMainline,
  pathTo,
  updateMove,
} from './utils/tree';
import {
  classifySound,
  isMuted,
  play as playSound,
  setMuted,
} from './utils/sounds';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PLAYBACK_INTERVAL_MS = 900;

type Status = 'idle' | 'loading' | 'analyzing' | 'ready';

function App() {
  // ---- Tree + navigation state ------------------------------------------

  const initialTree = useMemo(() => createTree(), []);
  const [tree, setTree] = useState<MoveTree>(initialTree);
  const [currentLine, setCurrentLine] = useState<NodeId[]>([initialTree.rootId]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [mainlineCount, setMainlineCount] = useState(0);
  const [analysisDepth, setAnalysisDepth] = useState(14);

  // ---- Misc UI state ----------------------------------------------------

  const [status, setStatus] = useState<Status>('idle');
  const [meta, setMeta] = useState<GameMeta>(emptyMeta());
  const [error, setError] = useState<string | null>(null);
  const [showingBest, setShowingBest] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [boardSize, setBoardSize] = useState(560);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [muted, setMutedState] = useState<boolean>(() => isMuted());

  const playTimer = useRef<number | null>(null);
  const lastSoundedNode = useRef<NodeId | null>(null);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      const next = !m;
      setMuted(next);
      return next;
    });
  }, []);

  const toggleOrientation = useCallback(() => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'));
  }, []);

  // ---- Socket wiring ----------------------------------------------------

  useEffect(() => {
    function onEvent(event: AnalysisEvent) {
      switch (event.type) {
        case 'start': {
          const fresh = createTree();
          setTree(fresh);
          setCurrentLine([fresh.rootId]);
          setCurrentIdx(0);
          setMainlineCount(0);
          setMeta((prev) => ({
            ...prev,
            whiteName: event.whiteName,
            blackName: event.blackName,
            whiteElo: event.whiteElo,
            blackElo: event.blackElo,
            totalPlies: event.totalPlies,
            whiteAccuracy: null,
            blackAccuracy: null,
          }));
          setShowingBest(false);
          setStatus('analyzing');
          setError(null);
          break;
        }
        case 'progress': {
          // event extends MoveAnalysis with `type: 'progress'`. Strip the
          // discriminator before stashing in the tree.
          const { type: _t, ...move } = event;
          setTree((prev) => {
            // Walk children[0] from root to find the mainline tail. Pure —
            // safe under StrictMode double-invocation of state updaters.
            let tailId = prev.rootId;
            while (prev.nodes[tailId]?.childrenIds[0]) {
              tailId = prev.nodes[tailId]!.childrenIds[0]!;
            }
            return addChild(prev, tailId, move).tree;
          });
          setMainlineCount((n) => n + 1);
          break;
        }
        case 'complete': {
          setMeta((prev) => ({
            ...prev,
            whiteAccuracy: event.whiteAccuracy,
            blackAccuracy: event.blackAccuracy,
          }));
          setStatus('ready');
          // currentLine seeded by the effect below once tree is committed.
          break;
        }
        case 'error':
          setError(event.message);
          setStatus('idle');
          break;
      }
    }
    socket.on('analysis:event', onEvent);
    return () => {
      socket.off('analysis:event', onEvent);
    };
  }, []);

  // ---- Responsive board sizing ------------------------------------------

  useEffect(() => {
    function update() {
      const panelW = window.innerWidth >= 1280 ? 420 : 380;
      const reservedSides = 90;
      const availW = window.innerWidth - panelW - reservedSides;
      const availH = window.innerHeight - 130;
      const size = Math.max(320, Math.min(availW, availH, 720));
      setBoardSize(Math.floor(size));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ---- Derived "current node" -------------------------------------------

  const currentNodeId = currentLine[currentIdx] ?? tree.rootId;
  const currentNode = tree.nodes[currentNodeId];
  const currentMove = currentNode?.move ?? null;
  const isPending = currentNode?.pending === true;

  // ---- When analysis completes, seed currentLine to the full mainline ---

  useEffect(() => {
    if (status !== 'ready') return;
    const line = fullMainline(tree);
    setCurrentLine(line);
    setCurrentIdx(0);
    // Intentionally only triggers on the analyzing → ready transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ---- Move sounds (only after analysis completes) ----------------------

  useEffect(() => {
    if (status !== 'ready') return;
    if (currentNodeId === lastSoundedNode.current) return;
    lastSoundedNode.current = currentNodeId;
    if (!currentMove) return;
    playSound(classifySound(currentMove.san));
  }, [currentNodeId, currentMove, status]);

  // ---- Playback timer ---------------------------------------------------

  useEffect(() => {
    if (!isPlaying) {
      if (playTimer.current !== null) window.clearInterval(playTimer.current);
      playTimer.current = null;
      return;
    }
    playTimer.current = window.setInterval(() => {
      setCurrentIdx((idx) => {
        const node = tree.nodes[currentLine[idx]];
        const next = node?.childrenIds[0];
        if (idx + 1 < currentLine.length) return idx + 1;
        if (!next) {
          setIsPlaying(false);
          return idx;
        }
        setCurrentLine((line) => [...line, next]);
        return idx + 1;
      });
    }, PLAYBACK_INTERVAL_MS);
    return () => {
      if (playTimer.current !== null) window.clearInterval(playTimer.current);
      playTimer.current = null;
    };
  }, [isPlaying, currentLine, tree]);

  // ---- Navigation -------------------------------------------------------

  const goPrev = useCallback(() => {
    setCurrentIdx((i) => Math.max(0, i - 1));
    setShowingBest(false);
  }, []);

  const goNext = useCallback(() => {
    const idx = currentIdx;
    const currentId = currentLine[idx];
    const node = tree.nodes[currentId];
    if (!node) return;

    // On the recorded mainline, Next always follows the recorded continuation
    // (children[0]) — even if currentLine still points into a branch the user
    // explored earlier. On a branch, continue along the current line.
    const onMainline = isOnMainline(tree, currentId);
    const nextId = onMainline
      ? node.childrenIds[0]
      : currentLine[idx + 1] ?? node.childrenIds[0];
    if (!nextId) return;

    const peek = currentLine[idx + 1];
    const nextLine =
      peek === nextId ? currentLine : [...currentLine.slice(0, idx + 1), nextId];
    setCurrentLine(nextLine);
    setCurrentIdx(idx + 1);
    setShowingBest(false);
  }, [currentLine, currentIdx, tree]);

  const goFirst = useCallback(() => {
    setCurrentIdx(0);
    setShowingBest(false);
  }, []);

  const goLast = useCallback(() => {
    // Extend currentLine all the way to a leaf along children[0], then jump.
    const out = [...currentLine];
    let cur: typeof tree.nodes[NodeId] | undefined = tree.nodes[out[out.length - 1]];
    while (cur && cur.childrenIds[0]) {
      const nextId: NodeId = cur.childrenIds[0];
      out.push(nextId);
      cur = tree.nodes[nextId];
    }
    setCurrentLine(out);
    setCurrentIdx(out.length - 1);
    setShowingBest(false);
  }, [tree, currentLine]);

  const selectNode = useCallback(
    (nodeId: NodeId) => {
      const path = pathTo(tree, nodeId);
      setCurrentLine(path);
      setCurrentIdx(path.length - 1);
      setShowingBest(false);
    },
    [tree],
  );

  // ---- Branch creation via piece drag -----------------------------------

  const handlePieceMove = useCallback(
    (uci: string) => {
      // Enabled while reviewing a loaded game (status==='ready') AND for the
      // free-play scratch mode at the home screen (status==='idle').
      if (status !== 'ready' && status !== 'idle') return;
      const node = tree.nodes[currentNodeId];
      if (!node) return;
      const fenBefore = node.move?.fenAfter ?? STARTING_FEN;

      // If the user re-played a move that already exists as a child, just
      // navigate to it instead of creating a duplicate branch.
      const existing = findChildByUci(tree, currentNodeId, uci);
      if (existing) {
        setCurrentLine([...currentLine.slice(0, currentIdx + 1), existing]);
        setCurrentIdx(currentIdx + 1);
        setShowingBest(false);
        return;
      }

      const placeholder = buildPlaceholderMove(fenBefore, uci, (node.move?.ply ?? -1) + 1);
      if (!placeholder) return; // illegal move (shouldn't happen — Board pre-validates)

      const { tree: nextTree, nodeId: newId } = addChild(tree, currentNodeId, placeholder, {
        pending: true,
      });
      setTree(nextTree);
      setCurrentLine([...currentLine.slice(0, currentIdx + 1), newId]);
      setCurrentIdx(currentIdx + 1);
      setShowingBest(false);

      socket.emit(
        'analyzeMove',
        {
          fenBefore,
          uci,
          depth: analysisDepth,
          ply: placeholder.ply,
        },
        (ack) => {
          if (!ack.ok || !ack.move) {
            if (ack.error) setError(ack.error);
            return;
          }
          setTree((prev) => updateMove(prev, newId, ack.move!));
        },
      );
    },
    [status, tree, currentNodeId, currentLine, currentIdx, analysisDepth],
  );

  // ---- Keyboard navigation ----------------------------------------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case 'Home':
          e.preventDefault();
          goFirst();
          break;
        case 'End':
          e.preventDefault();
          goLast();
          break;
        case ' ':
          e.preventDefault();
          if (status === 'ready') setIsPlaying((p) => !p);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, goFirst, goLast, status]);

  // ---- Display / arrows / badges ----------------------------------------

  const freePlay = status === 'idle';
  const previewBest = showingBest && currentMove?.bestMoveUci && !isPending;
  const displayedFen = previewBest
    ? currentMove!.fenBefore
    : currentMove
      ? currentMove.fenAfter
      : STARTING_FEN;

  const evalForBar = previewBest
    ? currentMove!.evalBeforeWhite
    : currentMove && !isPending
      ? currentMove.evalAfterWhite
      : { cp: 0 };

  const highlights = useMemo(() => {
    if (!currentMove) return [];
    if (previewBest) {
      const playedFrom = currentMove.uci.slice(0, 2);
      const playedTo = currentMove.uci.slice(2, 4);
      const bestFrom = currentMove.bestMoveUci!.slice(0, 2);
      const bestTo = currentMove.bestMoveUci!.slice(2, 4);
      return [
        { square: playedFrom, color: 'rgba(214, 68, 58, 0.35)' },
        { square: playedTo, color: 'rgba(214, 68, 58, 0.35)' },
        { square: bestFrom, color: 'rgba(134, 191, 44, 0.35)' },
        { square: bestTo, color: 'rgba(134, 191, 44, 0.45)' },
      ];
    }
    return [
      { square: currentMove.uci.slice(0, 2) },
      { square: currentMove.uci.slice(2, 4) },
    ];
  }, [currentMove, previewBest]);

  const arrows: BoardArrow[] = useMemo(() => {
    if (!currentMove || isPending) return [];
    const result: BoardArrow[] = [];

    if (previewBest) {
      result.push({
        from: currentMove.uci.slice(0, 2),
        to: currentMove.uci.slice(2, 4),
        color: '#d6443a',
      });
      if (currentMove.bestMoveUci) {
        result.push({
          from: currentMove.bestMoveUci.slice(0, 2),
          to: currentMove.bestMoveUci.slice(2, 4),
          color: '#86bf2c',
        });
      }
      return result;
    }

    const playedWasSuboptimal =
      !!currentMove.bestMoveUci &&
      currentMove.classification !== 'best' &&
      currentMove.classification !== 'great' &&
      currentMove.classification !== 'brilliant' &&
      currentMove.classification !== 'book' &&
      currentMove.classification !== 'good';

    // Green arrow: what the side that just moved could have played instead
    // (drawn from fenBefore squares — source piece may have moved away).
    if (playedWasSuboptimal) {
      result.push({
        from: currentMove.bestMoveUci!.slice(0, 2),
        to: currentMove.bestMoveUci!.slice(2, 4),
        color: '#86bf2c',
      });
    }

    // Blue arrow: free-play only — engine's best reply for the side now to move.
    if (freePlay && currentMove.nextBestMoveUci) {
      result.push({
        from: currentMove.nextBestMoveUci.slice(0, 2),
        to: currentMove.nextBestMoveUci.slice(2, 4),
        color: '#5b9bd5',
      });
    }
    return result;
  }, [currentMove, previewBest, isPending, freePlay]);

  const badge = useMemo(() => {
    if (!currentMove || previewBest || isPending) return null;
    return {
      square: currentMove.uci.slice(2, 4),
      classification: currentMove.classification,
    };
  }, [currentMove, previewBest, isPending]);

  // ---- Mainline-derived data for chart + accuracies ---------------------

  const mainlineMoves = useMemo<MoveAnalysis[]>(() => {
    const ids = fullMainline(tree);
    const out: MoveAnalysis[] = [];
    for (const id of ids) {
      const m = tree.nodes[id]?.move;
      if (m) out.push(m);
    }
    return out;
  }, [tree]);

  const chartCurrentPly = useMemo(() => {
    let cur = tree.nodes[currentNodeId];
    while (cur && !isOnMainline(tree, cur.id)) {
      if (!cur.parentId) break;
      cur = tree.nodes[cur.parentId];
    }
    return cur?.move?.ply ?? -1;
  }, [tree, currentNodeId]);

  // ---- Actions ----------------------------------------------------------

  const handleAnalyze = useCallback(
    (pgn: string, depth: number, perspective?: 'white' | 'black') => {
      setStatus('loading');
      setAnalysisDepth(depth);
      setError(null);
      const fresh = createTree();
      setTree(fresh);
      setCurrentLine([fresh.rootId]);
      setCurrentIdx(0);
      setMainlineCount(0);
      setMeta(emptyMeta());
      if (perspective) setOrientation(perspective);
      socket.emit('analyze', { pgn, depth });
    },
    [],
  );

  const handleReset = useCallback(() => {
    socket.emit('cancel');
    const fresh = createTree();
    setTree(fresh);
    setCurrentLine([fresh.rootId]);
    setCurrentIdx(0);
    setMainlineCount(0);
    setStatus('idle');
    setMeta(emptyMeta());
    setShowingBest(false);
    setError(null);
    setIsPlaying(false);
  }, []);

  const playerLabel = useMemo(() => {
    const blackOnTop = orientation === 'white';
    return {
      top: blackOnTop ? meta.blackName ?? 'Black' : meta.whiteName ?? 'White',
      topRating: blackOnTop ? meta.blackElo : meta.whiteElo,
      topColor: (blackOnTop ? 'black' : 'white') as 'white' | 'black',
      bottom: blackOnTop ? meta.whiteName ?? 'White' : meta.blackName ?? 'Black',
      bottomRating: blackOnTop ? meta.whiteElo : meta.blackElo,
      bottomColor: (blackOnTop ? 'white' : 'black') as 'white' | 'black',
    };
  }, [meta, orientation]);

  const canShowBest = !!currentMove?.bestMoveUci && !isPending;
  const allowDrag = status === 'ready' || freePlay;

  return (
    <div className="h-full wood-bg flex">
      {/* Left side: board + eval bar + player labels */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-stretch gap-2" style={{ width: boardSize + 36 }}>
          <div className="pl-9">
            <PlayerLabel
              name={playerLabel.top}
              rating={playerLabel.topRating}
              color={playerLabel.topColor}
            />
          </div>
          <div className="flex gap-3 items-stretch">
            <div style={{ height: boardSize, width: 24 }}>
              <EvalBar evalWhite={evalForBar} orientation={orientation} />
            </div>
            <Board
              fen={displayedFen}
              size={boardSize}
              orientation={orientation}
              highlightedSquares={highlights}
              arrows={arrows}
              badge={badge}
              onMove={allowDrag ? handlePieceMove : undefined}
            />
          </div>
          <div className="pl-9">
            <PlayerLabel
              name={playerLabel.bottom}
              rating={playerLabel.bottomRating}
              color={playerLabel.bottomColor}
            />
          </div>
        </div>
      </div>

      <div className="h-full">
        <ReviewPanel
          tree={tree}
          currentNodeId={currentNodeId}
          currentMove={currentMove}
          isPending={isPending}
          mainlineMoves={mainlineMoves}
          chartCurrentPly={chartCurrentPly}
          mainlineCount={mainlineCount}
          status={status}
          meta={meta}
          isPlaying={isPlaying}
          onSelectNode={selectNode}
          onJumpFirst={goFirst}
          onJumpPrev={goPrev}
          onJumpNext={goNext}
          onJumpLast={goLast}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onShowBest={() => setShowingBest((s) => !s)}
          showingBest={showingBest}
          canShowBest={canShowBest}
          onAnalyze={handleAnalyze}
          onReset={handleReset}
          muted={muted}
          onToggleMute={toggleMute}
          onFlipBoard={toggleOrientation}
        />
      </div>

      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-700/90 text-white px-4 py-2 rounded shadow-lg max-w-[80%]">
          <div className="font-bold mb-0.5">Analysis failed</div>
          <div className="text-sm">{error}</div>
        </div>
      )}
    </div>
  );
}

function emptyMeta(): GameMeta {
  return {
    whiteName: null,
    blackName: null,
    whiteElo: null,
    blackElo: null,
    whiteAccuracy: null,
    blackAccuracy: null,
    totalPlies: 0,
  };
}

function buildPlaceholderMove(
  fenBefore: string,
  uci: string,
  ply: number,
): MoveAnalysis | null {
  const chess = new Chess(fenBefore);
  let applied;
  try {
    applied = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    });
  } catch {
    return null;
  }
  if (!applied) return null;
  return {
    ply,
    moveNumber: Math.floor(ply / 2) + 1,
    san: applied.san,
    uci,
    color: applied.color,
    fenBefore,
    fenAfter: chess.fen(),
    evalBeforeWhite: { cp: 0 },
    evalAfterWhite: { cp: 0 },
    bestMoveUci: null,
    bestMoveSan: null,
    nextBestMoveUci: null,
    secondBestEvalWhite: null,
    classification: 'ok',
    wpLoss: 0,
  };
}

function PlayerLabel({
  name,
  rating,
  color,
}: {
  name: string;
  rating: string | null;
  color: 'white' | 'black';
}) {
  return (
    <div className="flex items-center gap-3 text-stone-100 px-1">
      <div
        className={
          'w-9 h-9 rounded grid place-items-center ring-1 ring-black/30 shrink-0 ' +
          (color === 'white' ? 'bg-stone-100 text-stone-900' : 'bg-stone-900 text-stone-100')
        }
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 12c2.5 0 4-2 4-4.5S14.5 3 12 3 8 5 8 7.5 9.5 12 12 12zm0 2c-3.3 0-8 1.6-8 5v2h16v-2c0-3.4-4.7-5-8-5z" />
        </svg>
      </div>
      <div className="flex items-baseline gap-2 font-bold">
        <span>{name}</span>
        {rating && <span className="text-stone-300 font-medium">({rating})</span>}
      </div>
    </div>
  );
}

export default App;
