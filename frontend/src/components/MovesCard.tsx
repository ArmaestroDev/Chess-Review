import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  Star,
} from 'lucide-react';
import type { MoveTree, NodeId } from '../types';
import { fullMainline } from '../utils/tree';
import { MoveList } from './MoveList';

interface Props {
  tree: MoveTree;
  currentNodeId: NodeId;
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
}

export function MovesCard({
  tree,
  currentNodeId,
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
}: Props) {
  const totalPlies = Math.max(0, fullMainline(tree).length - 1);

  return (
    <div className="cr-card flex flex-col" style={{ maxHeight: 'calc(100vh - 320px)' }}>
      <div className="cr-card-hd">
        <div className="cr-card-title">Moves</div>
        {totalPlies > 0 && (
          <span className="cr-pill cr-pill-mono">{totalPlies} plies</span>
        )}
      </div>

      <MoveList
        tree={tree}
        currentNodeId={currentNodeId}
        onSelectNode={onSelectNode}
      />

      {/* Controls */}
      <div className="flex items-center gap-1 px-3 py-2.5 border-t border-line bg-wood-dark/40">
        <CtrlBtn onClick={onJumpFirst} title="Start">
          <ChevronsLeft size={16} />
        </CtrlBtn>
        <CtrlBtn onClick={onJumpPrev} title="Previous">
          <ChevronLeft size={16} />
        </CtrlBtn>
        <CtrlBtn onClick={onTogglePlay} title="Play/Pause" emphasized active={isPlaying}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </CtrlBtn>
        <CtrlBtn onClick={onJumpNext} title="Next">
          <ChevronRight size={16} />
        </CtrlBtn>
        <CtrlBtn onClick={onJumpLast} title="End">
          <ChevronsRight size={16} />
        </CtrlBtn>
        <div className="flex-1" />
        <CtrlBtn
          onClick={onShowBest}
          title="Show best move"
          active={showingBest}
          disabled={!canShowBest}
        >
          <Star size={16} fill={showingBest ? 'currentColor' : 'none'} />
        </CtrlBtn>
      </div>
    </div>
  );
}

function CtrlBtn({
  children,
  onClick,
  title,
  active,
  disabled,
  emphasized,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  emphasized?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={
        'w-[30px] h-[30px] rounded-[7px] border inline-flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ' +
        (active
          ? 'border-accent text-accent-ink bg-accent-soft'
          : emphasized
            ? 'border-transparent bg-ink text-wood-dark hover:bg-ink-2'
            : 'border-transparent text-ink-2 hover:bg-line/40 hover:border-line')
      }
    >
      {children}
    </button>
  );
}
