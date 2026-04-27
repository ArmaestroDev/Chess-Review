import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { useTranslation } from 'react-i18next';
import type { BoardArrow } from '../../shared/components/Board';
import { ensureConnected, socket } from '../../shared/socket';
import type {
  AnalysisEvent,
  GameMeta,
  MoveAnalysis,
  MoveTree,
  NodeId,
} from '../../shared/types';
import {
  addChild,
  createTree,
  findChildByUci,
  fullMainline,
  isOnMainline,
  pathTo,
  updateMove,
} from '../../shared/utils/tree';
import {
  classifySound,
  play as playSound,
} from '../../shared/utils/sounds';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PLAYBACK_INTERVAL_MS = 900;

export type ReviewStatus = 'idle' | 'loading' | 'analyzing' | 'ready';

interface ReviewStateOptions {
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
}

/**
 * Owns the entire review-page runtime: socket subscription, move tree,
 * navigation, playback, branch creation, derived board state. Both the
 * desktop and mobile layouts call this hook so neither has to re-implement
 * the wiring. Only one layout is mounted at a time (gated by useIsMobile),
 * so we never race with two simultaneous socket subscriptions.
 */
export function useReviewState({ orientation, setOrientation }: ReviewStateOptions) {
  const { t } = useTranslation();

  // ---- Tree + navigation state ------------------------------------------

  const initialTree = useMemo(() => createTree(), []);
  const [tree, setTree] = useState<MoveTree>(initialTree);
  const [currentLine, setCurrentLine] = useState<NodeId[]>([initialTree.rootId]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const [mainlineCount, setMainlineCount] = useState(0);
  const [analysisDepth, setAnalysisDepth] = useState(14);

  // ---- Misc UI state ----------------------------------------------------

  const [status, setStatus] = useState<ReviewStatus>('idle');
  const [meta, setMeta] = useState<GameMeta>(emptyMeta());
  const [error, setError] = useState<string | null>(null);
  const [showingBest, setShowingBest] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const playTimer = useRef<number | null>(null);
  const lastSoundedNode = useRef<NodeId | null>(null);

  // Track latest status via a ref so the socket-effect cleanup (which only
  // runs at hook unmount) can decide whether there is an in-flight backend
  // analyze worth cancelling. Without this, an unmount mid-analysis would
  // orphan the engine on the backend's queue.
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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
          const { type: _t, ...move } = event;
          setTree((prev) => {
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
      // Belt-and-suspenders: if the hook unmounts (e.g. user navigates away
      // mid-analysis), tell the backend to stop so the engine isn't left
      // running with no listener. Only emit when there's something to
      // cancel — emitting cancel on idle would be a no-op but adds noise.
      const s = statusRef.current;
      if (s === 'loading' || s === 'analyzing') {
        socket.emit('cancel');
      }
    };
  }, []);

  // ---- Derived "current node" -------------------------------------------

  const currentNodeId = currentLine[currentIdx] ?? tree.rootId;
  const currentNode = tree.nodes[currentNodeId];
  const currentMove = currentNode?.move ?? null;
  const isPending = currentNode?.pending === true;
  // Parent move — used by the eval bar while the current node is pending,
  // so the bar holds at the position the user moved FROM (e.g. +1.0)
  // instead of dropping to 0.0 during the analyzeMove round-trip.
  const parentNode = currentNode?.parentId
    ? tree.nodes[currentNode.parentId]
    : null;
  const parentMove = parentNode?.move ?? null;

  // ---- When analysis completes, seed currentLine to the full mainline ---

  useEffect(() => {
    if (status !== 'ready') return;
    const line = fullMainline(tree);
    setCurrentLine(line);
    setCurrentIdx(0);
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
      if (status !== 'ready' && status !== 'idle') return;
      const node = tree.nodes[currentNodeId];
      if (!node) return;
      const fenBefore = node.move?.fenAfter ?? STARTING_FEN;

      const existing = findChildByUci(tree, currentNodeId, uci);
      if (existing) {
        setCurrentLine([...currentLine.slice(0, currentIdx + 1), existing]);
        setCurrentIdx(currentIdx + 1);
        setShowingBest(false);
        return;
      }

      const placeholder = buildPlaceholderMove(fenBefore, uci, (node.move?.ply ?? -1) + 1);
      if (!placeholder) return;

      const { tree: nextTree, nodeId: newId } = addChild(tree, currentNodeId, placeholder, {
        pending: true,
      });
      setTree(nextTree);
      setCurrentLine([...currentLine.slice(0, currentIdx + 1), newId]);
      setCurrentIdx(currentIdx + 1);
      setShowingBest(false);

      ensureConnected();
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

  // Latest analyzed move on the mainline. During streaming the cursor sits
  // at the root (CLAUDE.md: cursor doesn't auto-advance), so without this
  // fallback the eval bar would pin at 0.0 the entire analysis. We let the
  // bar track the tail instead — each new `progress` event extends the
  // mainline, tailMove updates, and the EvalBar's CSS height transition
  // smoothly moves the slab to the new value.
  const tailMove = useMemo<MoveAnalysis | null>(() => {
    let cur = tree.nodes[tree.rootId];
    let last: MoveAnalysis | null = null;
    while (cur) {
      if (cur.move) last = cur.move;
      const nextId = cur.childrenIds[0];
      if (!nextId) break;
      cur = tree.nodes[nextId];
      if (!cur) break;
    }
    return last;
  }, [tree]);

  const evalForBar = previewBest
    ? currentMove!.evalBeforeWhite
    : currentMove && !isPending
      ? currentMove.evalAfterWhite
      : isPending
        ? parentMove?.evalAfterWhite ?? { cp: 0 }
        : status === 'analyzing' && tailMove
          ? tailMove.evalAfterWhite
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

    if (playedWasSuboptimal) {
      result.push({
        from: currentMove.bestMoveUci!.slice(0, 2),
        to: currentMove.bestMoveUci!.slice(2, 4),
        color: '#86bf2c',
      });
    }

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
      ensureConnected();
      socket.emit('analyze', { pgn, depth });
    },
    [setOrientation],
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

  // ---- Layout helpers ---------------------------------------------------

  const playerLabel = useMemo(() => {
    const blackOnTop = orientation === 'white';
    const whiteFallback = t('review.color.white');
    const blackFallback = t('review.color.black');
    return {
      top: blackOnTop ? meta.blackName ?? blackFallback : meta.whiteName ?? whiteFallback,
      topRating: blackOnTop ? meta.blackElo : meta.whiteElo,
      topColor: (blackOnTop ? 'black' : 'white') as 'white' | 'black',
      bottom: blackOnTop ? meta.whiteName ?? whiteFallback : meta.blackName ?? blackFallback,
      bottomRating: blackOnTop ? meta.whiteElo : meta.blackElo,
      bottomColor: (blackOnTop ? 'white' : 'black') as 'white' | 'black',
    };
  }, [meta, orientation, t]);

  const canShowBest = !!currentMove?.bestMoveUci && !isPending;
  const allowDrag = status === 'ready' || freePlay;
  const showLoader = status === 'idle' && mainlineMoves.length === 0;
  const showAnalyzing = status === 'loading' || status === 'analyzing';
  const hasGame = !showLoader;
  const sideToMove = (displayedFen.split(' ')[1] ?? 'w') as 'w' | 'b';
  const playerToMove: 'white' | 'black' = sideToMove === 'w' ? 'white' : 'black';
  const expectedTotal =
    meta.totalPlies > 0 ? meta.totalPlies : Math.max(mainlineCount, 1);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const toggleShowBest = useCallback(() => setShowingBest((s) => !s), []);

  return {
    // tree / navigation
    tree,
    currentNodeId,
    currentMove,
    isPending,
    selectNode,
    goPrev,
    goNext,
    goFirst,
    goLast,
    // playback / show-best
    isPlaying,
    togglePlay,
    showingBest,
    toggleShowBest,
    canShowBest,
    // status / meta
    status,
    meta,
    error,
    mainlineCount,
    expectedTotal,
    mainlineMoves,
    chartCurrentPly,
    // board display
    displayedFen,
    evalForBar,
    highlights,
    arrows,
    badge,
    allowDrag,
    handlePieceMove,
    // layout flags
    showLoader,
    showAnalyzing,
    hasGame,
    playerLabel,
    playerToMove,
    // actions
    handleAnalyze,
    handleReset,
  };
}

export function mainlineNodeIdForPly(tree: MoveTree, ply: number): NodeId | null {
  let cur = tree.nodes[tree.rootId];
  while (cur) {
    if (cur.move?.ply === ply) return cur.id;
    const next = cur.childrenIds[0];
    if (!next) break;
    cur = tree.nodes[next];
  }
  return null;
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

// Public alias for the entire review-state surface. The wrapper page calls
// useReviewState() and threads the result through to whichever variant
// (desktop / mobile) is mounted, so the move tree, socket subscription, and
// engine lifecycle survive a breakpoint cross.
export type ReviewState = ReturnType<typeof useReviewState>;
