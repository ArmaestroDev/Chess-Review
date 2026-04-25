import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  ArrowLeft,
  Search,
  Volume2,
  VolumeX,
  Loader2,
} from 'lucide-react';
import type { GameMeta, MoveAnalysis, MoveTree, NodeId } from '../types';
import { CommentBubble } from './CommentBubble';
import { MoveList } from './MoveList';
import { EvalChart } from './EvalChart';
import { PgnLoader } from './PgnLoader';

interface Props {
  tree: MoveTree;
  currentNodeId: NodeId;
  currentMove: MoveAnalysis | null;
  isPending: boolean;
  mainlineMoves: MoveAnalysis[];
  chartCurrentPly: number;
  mainlineCount: number;
  status: 'idle' | 'loading' | 'analyzing' | 'ready';
  meta: GameMeta;
  isPlaying: boolean;
  onSelectNode: (id: NodeId) => void;
  onJumpFirst: () => void;
  onJumpPrev: () => void;
  onJumpNext: () => void;
  onJumpLast: () => void;
  onTogglePlay: () => void;
  onShowBest: () => void;
  showingBest: boolean;
  canShowBest: boolean;
  onAnalyze: (pgn: string, depth: number, perspective?: 'white' | 'black') => void;
  onReset: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onFlipBoard: () => void;
}

export function ReviewPanel(props: Props) {
  const {
    tree,
    currentNodeId,
    currentMove,
    isPending,
    mainlineMoves,
    chartCurrentPly,
    mainlineCount,
    status,
    meta,
    isPlaying,
    onSelectNode,
    onJumpFirst,
    onJumpPrev,
    onJumpNext,
    onJumpLast,
    onTogglePlay,
    onShowBest,
    showingBest,
    canShowBest,
    onAnalyze,
    onReset,
    muted,
    onToggleMute,
    onFlipBoard,
  } = props;

  const showLoader = status === 'idle' && mainlineMoves.length === 0;
  const showAnalyzing = status === 'loading' || status === 'analyzing';
  const expectedTotal =
    meta.totalPlies > 0 ? meta.totalPlies : Math.max(mainlineCount, 1);

  return (
    <div className="panel-wood w-[380px] xl:w-[420px] shadow-panel rounded-l-lg flex flex-col h-full">
      <Header
        onReset={onReset}
        muted={muted}
        onToggleMute={onToggleMute}
        onFlipBoard={onFlipBoard}
        hasGame={!showLoader}
      />

      {showLoader ? (
        <PgnLoader onAnalyze={onAnalyze} busy={false} />
      ) : showAnalyzing ? (
        <AnalyzingCard done={mainlineCount} total={expectedTotal} onCancel={onReset} />
      ) : (
        <>
          <CommentBubble move={isPending ? null : currentMove} isInitial={false} />

          <div className="px-4 mt-3 flex gap-2">
            <button
              type="button"
              onClick={onShowBest}
              disabled={!canShowBest}
              className={
                'flex-1 rounded-md py-2 text-sm font-semibold flex items-center justify-center gap-1 transition-colors ' +
                (showingBest
                  ? 'bg-amber-300 text-stone-900'
                  : 'bg-stone-100/95 text-stone-900 hover:bg-stone-100 disabled:opacity-50')
              }
            >
              <span>★ Best</span>
            </button>
            <button
              type="button"
              onClick={onJumpNext}
              className="flex-1 rounded-md py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1"
            >
              <ChevronRight size={16} />
              Next
            </button>
          </div>

          <div className="mt-2 flex-1 min-h-0 flex flex-col">
            <MoveList
              tree={tree}
              currentNodeId={currentNodeId}
              onSelectNode={onSelectNode}
            />
          </div>

          <div className="px-4 pb-2">
            <EvalChart
              moves={mainlineMoves}
              totalPlies={expectedTotal}
              currentPly={chartCurrentPly}
              onSelect={(ply) => {
                // Jump to mainline node at that ply.
                const id = mainlineNodeIdForPly(tree, ply);
                if (id) onSelectNode(id);
              }}
              width={350}
              height={64}
            />
            {(meta.whiteAccuracy !== null || meta.blackAccuracy !== null) && (
              <div className="flex justify-between text-xs text-stone-300 mt-1 px-1">
                <span>
                  White accuracy:{' '}
                  <span className="text-stone-100 font-bold">
                    {(meta.whiteAccuracy ?? 0).toFixed(1)}%
                  </span>
                </span>
                <span>
                  Black accuracy:{' '}
                  <span className="text-stone-100 font-bold">
                    {(meta.blackAccuracy ?? 0).toFixed(1)}%
                  </span>
                </span>
              </div>
            )}
          </div>

          <NavBar
            isPlaying={isPlaying}
            onJumpFirst={onJumpFirst}
            onJumpPrev={onJumpPrev}
            onJumpNext={onJumpNext}
            onJumpLast={onJumpLast}
            onTogglePlay={onTogglePlay}
          />
        </>
      )}
    </div>
  );
}

function mainlineNodeIdForPly(tree: MoveTree, ply: number): NodeId | null {
  let cur = tree.nodes[tree.rootId];
  while (cur) {
    if (cur.move?.ply === ply) return cur.id;
    const next = cur.childrenIds[0];
    if (!next) break;
    cur = tree.nodes[next];
  }
  return null;
}

function Header({
  onReset,
  muted,
  onToggleMute,
  onFlipBoard,
  hasGame,
}: {
  onReset: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onFlipBoard: () => void;
  hasGame: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 h-14 border-b border-white/10">
      <div className="flex items-center gap-2 text-stone-100 font-bold">
        {hasGame && (
          <button
            type="button"
            onClick={onReset}
            className="p-1 rounded hover:bg-white/10 text-stone-300"
            title="New game"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <span className="text-amber-300">★</span> Game Review
      </div>
      <div className="flex items-center gap-1 text-stone-300">
        <button
          type="button"
          onClick={onFlipBoard}
          className="p-1 rounded hover:bg-white/10"
          title="Flip board"
        >
          <ArrowUpDown size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          className="p-1 rounded hover:bg-white/10"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button className="p-1 rounded hover:bg-white/10" title="Search">
          <Search size={18} />
        </button>
      </div>
    </div>
  );
}

function AnalyzingCard({
  done,
  total,
  onCancel,
}: {
  done: number;
  total: number;
  onCancel: () => void;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 text-center">
      <Loader2 size={42} className="animate-spin text-amber-300" />
      <div className="text-stone-100 font-bold text-lg">Analyzing your game…</div>
      <div className="text-stone-300 text-sm">
        Stockfish is reviewing every move. The board will be ready in a moment.
      </div>
      <div className="w-full max-w-[280px]">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[12px] text-stone-300 mt-1.5 tabular-nums">
          {done} / {total} moves
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 text-sm text-stone-300 hover:text-stone-100 underline-offset-2 hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}

interface NavBarProps {
  isPlaying: boolean;
  onJumpFirst: () => void;
  onJumpPrev: () => void;
  onJumpNext: () => void;
  onJumpLast: () => void;
  onTogglePlay: () => void;
}

function NavBar({
  isPlaying,
  onJumpFirst,
  onJumpPrev,
  onJumpNext,
  onJumpLast,
  onTogglePlay,
}: NavBarProps) {
  const btn =
    'flex-1 h-11 grid place-items-center bg-stone-800/60 hover:bg-stone-700/60 text-stone-200 disabled:opacity-30 transition-colors';
  return (
    <div className="grid grid-cols-5 border-t border-white/10">
      <button onClick={onJumpFirst} className={btn} title="Start">
        <ChevronsLeft size={20} />
      </button>
      <button onClick={onJumpPrev} className={btn} title="Previous">
        <ChevronLeft size={20} />
      </button>
      <button onClick={onTogglePlay} className={btn} title="Play/Pause">
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <button onClick={onJumpNext} className={btn} title="Next">
        <ChevronRight size={20} />
      </button>
      <button onClick={onJumpLast} className={btn} title="End">
        <ChevronsRight size={20} />
      </button>
    </div>
  );
}
