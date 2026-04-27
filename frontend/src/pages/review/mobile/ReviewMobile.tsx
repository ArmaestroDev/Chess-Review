import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Board } from '../../../shared/components/Board';
import { EvalBar } from '../desktop/components/EvalBar';
import { usePublishMobileTopBarActions } from '../../../shared/components/MobileTopBarContext';
import type { ReviewState } from '../useReviewState';
import type { ChessComProfileState } from '../useChessComProfile';
import { GameMeta as GameMetaCard } from '../components/GameMeta';
import { MovesCard } from '../components/MovesCard';
import { PgnLoader } from '../components/PgnLoader';
import { CommentBubble } from '../components/CommentBubble';
import { AccuracyCard } from '../components/AccuracyCard';
import { AnalyzingCard } from '../components/AnalyzingCard';

type Tab = 'moves' | 'stats' | 'comment';

interface Props {
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
  // Owned by the wrapper (ReviewPage) so it survives the desktop/mobile
  // breakpoint cross — see useReviewState.ts and ReviewPage.tsx.
  review: ReviewState;
  chessCom: ChessComProfileState;
}

export function ReviewMobile({
  orientation,
  setOrientation,
  review,
  chessCom,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('moves');

  usePublishMobileTopBarActions({
    flipBoard: review.hasGame
      ? () => setOrientation(orientation === 'white' ? 'black' : 'white')
      : null,
    clearBoard: review.hasGame ? review.handleReset : null,
  });

  // Switch the active tab when state-driven content becomes more relevant:
  // - while a game is loading/analyzing, show the analyzing card under
  //   "comment" so the user sees progress.
  // - otherwise leave the user's choice alone.
  useEffect(() => {
    if (review.showAnalyzing && tab !== 'comment') setTab('comment');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.showAnalyzing]);

  // Mobile board sizing: full viewport width minus page padding.
  // We rely on CSS aspect-ratio for height; the Board component still needs
  // a numeric size, so measure the container width.
  const [boardSize, setBoardSize] = useState(320);
  useEffect(() => {
    function update() {
      // 12px page padding on each side.
      const w = Math.min(window.innerWidth - 24, 560);
      setBoardSize(Math.max(240, Math.floor(w)));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <main className="cr-mobile-main">
      <div className="cr-mobile-page">
        {/* Loader / analyzing card (only when no game yet, or analysing) */}
        {review.showLoader && (
          <PgnLoader
            onAnalyze={review.handleAnalyze}
            busy={false}
            chessCom={chessCom}
          />
        )}

        {/* Horizontal eval bar above the board (mobile counterpart of the desktop column) */}
        {!review.showLoader && (
          <div style={{ width: boardSize, alignSelf: 'center' }}>
            <EvalBar
              evalWhite={review.evalForBar}
              orientation={orientation}
              layout="horizontal"
              terminal={review.terminal}
            />
          </div>
        )}

        {/* Board — full-width, square */}
        {!review.showLoader && (
          <div
            className="cr-mobile-board-wrap"
            style={{ width: boardSize, alignSelf: 'center' }}
          >
            <Board
              fen={review.displayedFen}
              size={boardSize}
              orientation={orientation}
              highlightedSquares={review.highlights}
              arrows={review.arrows}
              badge={review.badge}
              onMove={review.allowDrag ? review.handlePieceMove : undefined}
            />
          </div>
        )}

        {/* Playback controls — large tap targets */}
        {!review.showLoader && (
          <div className="cr-mobile-playback">
            <button
              type="button"
              onClick={review.goFirst}
              className="cr-mobile-playback-btn"
              title={t('review.controls.start')}
              aria-label={t('review.controls.start')}
            >
              <ChevronsLeft size={18} />
            </button>
            <button
              type="button"
              onClick={review.goPrev}
              className="cr-mobile-playback-btn"
              title={t('review.controls.previous')}
              aria-label={t('review.controls.previous')}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={review.togglePlay}
              disabled={review.status !== 'ready'}
              className="cr-mobile-playback-btn"
              title={t('review.controls.playPause')}
              aria-label={t('review.controls.playPause')}
            >
              {review.isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              type="button"
              onClick={review.goNext}
              className="cr-mobile-playback-btn"
              title={t('review.controls.next')}
              aria-label={t('review.controls.next')}
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={review.goLast}
              className="cr-mobile-playback-btn"
              title={t('review.controls.end')}
              aria-label={t('review.controls.end')}
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        )}

        {/* Tab strip — Moves / Stats / Comment */}
        {!review.showLoader && (
          <div className="cr-mobile-tabs">
            <button
              type="button"
              onClick={() => setTab('moves')}
              className={
                'cr-mobile-tab ' + (tab === 'moves' ? 'cr-mobile-tab-active' : '')
              }
            >
              {t('review.mobile.tabs.moves')}
            </button>
            <button
              type="button"
              onClick={() => setTab('stats')}
              className={
                'cr-mobile-tab ' + (tab === 'stats' ? 'cr-mobile-tab-active' : '')
              }
            >
              {t('review.mobile.tabs.stats')}
            </button>
            <button
              type="button"
              onClick={() => setTab('comment')}
              className={
                'cr-mobile-tab ' + (tab === 'comment' ? 'cr-mobile-tab-active' : '')
              }
            >
              {t('review.mobile.tabs.comment')}
            </button>
          </div>
        )}

        {/* Active tab content */}
        {!review.showLoader && (
          <>
            {tab === 'moves' && (
              <MovesCard
                tree={review.tree}
                currentNodeId={review.currentNodeId}
                isPlaying={review.isPlaying}
                onSelectNode={review.selectNode}
                onJumpFirst={review.goFirst}
                onJumpPrev={review.goPrev}
                onJumpNext={review.goNext}
                onJumpLast={review.goLast}
                onTogglePlay={review.togglePlay}
                onShowBest={review.toggleShowBest}
                showingBest={review.showingBest}
                canShowBest={review.canShowBest}
                compact
              />
            )}

            {tab === 'stats' && (
              <>
                <GameMetaCard meta={review.meta} hasGame={review.hasGame} />
                <AccuracyCard
                  whiteAccuracy={review.meta.whiteAccuracy}
                  blackAccuracy={review.meta.blackAccuracy}
                />
              </>
            )}

            {tab === 'comment' && (
              <>
                {review.showAnalyzing ? (
                  <AnalyzingCard
                    done={review.mainlineCount}
                    total={review.expectedTotal}
                    onCancel={review.handleReset}
                  />
                ) : (
                  <CommentBubble
                    move={review.isPending ? null : review.currentMove}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {review.error && (
        <div
          className="fixed left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg shadow-card-md max-w-[90%]"
          style={{
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0))',
            background: 'rgba(214, 68, 58, 0.95)',
            color: '#fdfbf5',
          }}
          role="alert"
        >
          <div className="font-semibold mb-0.5">{t('review.errors.title')}</div>
          <div className="text-sm">{review.error}</div>
        </div>
      )}
    </main>
  );
}
