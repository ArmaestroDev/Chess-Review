import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MoveTree, NodeId } from '../../../shared/types';
import { fullMainline } from '../../../shared/utils/tree';
import { MoveList } from '../desktop/components/MoveList';

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
  /**
   * When true, sizes the card for the mobile layout (more vertical space
   * reserved for the top bar + eval chip + board + playback row + tab strip +
   * MobileNav + safe-area padding) and hides the inline playback controls
   * since the mobile layout already has a dedicated playback row above the
   * tab strip.
   */
  compact?: boolean;
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
  compact,
}: Props) {
  const { t } = useTranslation();
  const totalPlies = Math.max(0, fullMainline(tree).length - 1);

  // Reserve viewport height for everything *outside* the moves list. The
  // mobile reservation is roughly: top-bar (~52) + eval chip (~36) +
  // board (~380) + playback row (~52) + tab strip (~44) + MobileNav (~56) +
  // safe-area + padding (~20). Bump if the layout grows.
  const maxHeight = compact ? 'calc(100vh - 540px)' : 'calc(100vh - 320px)';

  return (
    <div className="cr-card flex flex-col" style={{ maxHeight }}>
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('review.moves.title')}</div>
        {totalPlies > 0 && (
          <span className="cr-pill cr-pill-mono">
            {t('review.moves.plies', { count: totalPlies })}
          </span>
        )}
      </div>

      <MoveList
        tree={tree}
        currentNodeId={currentNodeId}
        onSelectNode={onSelectNode}
      />

      {/* Controls — hidden on the mobile layout since the dedicated playback
          row above the tabs already exposes these buttons (and Play/Pause). */}
      {!compact && (
        <div className="flex items-center gap-1 px-3 py-2.5 border-t border-line bg-wood-dark/40">
          <CtrlBtn onClick={onJumpFirst} title={t('review.controls.start')}>
            <ChevronsLeft size={16} />
          </CtrlBtn>
          <CtrlBtn onClick={onJumpPrev} title={t('review.controls.previous')}>
            <ChevronLeft size={16} />
          </CtrlBtn>
          <CtrlBtn
            onClick={onTogglePlay}
            title={t('review.controls.playPause')}
            emphasized
            active={isPlaying}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </CtrlBtn>
          <CtrlBtn onClick={onJumpNext} title={t('review.controls.next')}>
            <ChevronRight size={16} />
          </CtrlBtn>
          <CtrlBtn onClick={onJumpLast} title={t('review.controls.end')}>
            <ChevronsRight size={16} />
          </CtrlBtn>
          <div className="flex-1" />
          <CtrlBtn
            onClick={onShowBest}
            title={t('review.controls.showBest')}
            active={showingBest}
            disabled={!canShowBest}
          >
            <Star size={16} fill={showingBest ? 'currentColor' : 'none'} />
          </CtrlBtn>
        </div>
      )}
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
