import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
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
import { PlayerStrip } from '../../../shared/components/PlayerStrip';
import {
  usePublishMobileTopBarActions,
  useHideMobileBottomNav,
} from '../../../shared/components/MobileTopBarContext';
import { deriveStripCaptures } from '../../../shared/utils/capturedPieces';
import type { ReviewState } from '../useReviewState';
import type { ChessComProfileState } from '../useChessComProfile';
import { MovesCard } from '../components/MovesCard';
import { PgnLoader } from '../components/PgnLoader';
import { CommentBubble } from '../components/CommentBubble';
import { AnalyzingCard } from '../components/AnalyzingCard';

type Tab = 'moves' | 'comment';

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

  // Flip stays available in both initial and analyze states. The clear/trash
  // action is hidden on mobile review — the "Back to start" link above the
  // board replaces it.
  usePublishMobileTopBarActions({
    flipBoard: () => setOrientation(orientation === 'white' ? 'black' : 'white'),
    clearBoard: null,
  });

  // Hide the bottom MobileNav whenever a game is loaded so the analyze layout
  // feels immersive. The hook restores the nav on unmount or when hasGame
  // flips back to false (e.g. after handleReset).
  useHideMobileBottomNav(review.hasGame);

  // While a game is loading/analyzing, surface the analyzing card under
  // "comment" so the user sees progress.
  useEffect(() => {
    if (review.showAnalyzing) setTab('comment');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.showAnalyzing]);

  // Mobile board sizing.
  //
  // Initial state (no game loaded): use the full viewport width minus the
  // 12px page padding on each side, capped at 560.
  //
  // Analyze mode: the page must fit the viewport without scrolling, so the
  // board has to be the smaller of (a) available width and (b) available
  // height after subtracting all fixed chrome. ANALYZE_CHROME_RESERVE_PX
  // accounts for the topbar + back-link + tabs + TAB_CONTENT_HEIGHT_PX
  // tab-content slot + top PlayerStrip + horizontal eval bar + bottom
  // PlayerStrip + playback controls + page padding + the 6px gaps between
  // sections. On very small viewports the board may shrink below the ideal
  // size — that's the intentional trade-off for keeping the layout
  // non-scrolling.
  const TAB_CONTENT_HEIGHT_PX = 108;
  const ANALYZE_CHROME_RESERVE_PX = 496;

  const [boardSize, setBoardSize] = useState(320);
  useEffect(() => {
    function update() {
      const widthAvail = Math.min(window.innerWidth - 20, 560);
      if (review.hasGame) {
        const heightAvail = window.innerHeight - ANALYZE_CHROME_RESERVE_PX;
        setBoardSize(
          Math.max(220, Math.min(widthAvail, Math.floor(heightAvail))),
        );
      } else {
        setBoardSize(Math.max(240, Math.floor(widthAvail)));
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [review.hasGame]);

  // Captured pieces / material advantage derived from the displayed FEN.
  // Only used in analyze mode — the initial state board is the starting
  // position, so captured sets would be empty anyway.
  const topColor = review.playerLabel.topColor;
  const bottomColor = review.playerLabel.bottomColor;
  const { topCaptured, topAdvantage, bottomCaptured, bottomAdvantage } = useMemo(
    () => deriveStripCaptures(review.displayedFen, topColor, bottomColor),
    [review.displayedFen, topColor, bottomColor],
  );

  // Reset the active tab to "moves" when the user leaves analyze mode so the
  // next loaded game starts on the most-relevant tab instead of restoring a
  // stale Comment selection from the previous session.
  useEffect(() => {
    if (!review.hasGame) setTab('moves');
  }, [review.hasGame]);

  return (
    <main
      className={
        'cr-mobile-main' + (review.hasGame ? ' cr-mobile-main--fit' : '')
      }
    >
      <div
        className={
          'cr-mobile-page' + (review.hasGame ? ' cr-mobile-page--tight' : '')
        }
      >
        {/* ============================================================
            INITIAL STATE (no game loaded): board + PgnLoader source panel.
            The board is interactive — dragging a piece enters analyze mode
            because review.allowDrag is true while status === 'idle'
            (freePlay path in useReviewState).
            ============================================================ */}
        {review.showLoader && (
          <>
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

            <PgnLoader
              onAnalyze={review.handleAnalyze}
              busy={false}
              chessCom={chessCom}
            />
          </>
        )}

        {/* ============================================================
            ANALYZE MODE (game loaded or being analyzed):
              [back link]
              [tabs]
              [active tab content]
              [top PlayerStrip with captured pieces]
              [eval bar]
              [board]
              [bottom PlayerStrip with captured pieces]
              [playback nav]
            ============================================================ */}
        {!review.showLoader && (
          <>
            <button
              type="button"
              onClick={review.handleReset}
              className="cr-mobile-back-link"
            >
              <ArrowLeft size={14} />
              {t('review.actions.backToStart')}
            </button>

            {/* Tab strip — Moves / Comment */}
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
                onClick={() => setTab('comment')}
                className={
                  'cr-mobile-tab ' +
                  (tab === 'comment' ? 'cr-mobile-tab-active' : '')
                }
              >
                {t('review.mobile.tabs.comment')}
              </button>
            </div>

            {/* Tab content — fixed slot in analyze mode so the layout is
                stable across moves/comment. Each card scrolls internally
                when its content exceeds the slot. TAB_CONTENT_HEIGHT_PX is
                paired with ANALYZE_CHROME_RESERVE_PX above; if you change
                one, retune the other. */}
            <div
              style={{ height: TAB_CONTENT_HEIGHT_PX }}
              className="flex flex-col min-h-0"
            >
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
                  fill
                />
              )}
              {tab === 'comment' && (
                <div className="overflow-y-auto min-h-0">
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
                </div>
              )}
            </div>

            {/* Top player strip — opposite color of orientation */}
            <PlayerStrip
              color={topColor}
              name={review.playerLabel.top}
              rating={review.playerLabel.topRating}
              active={review.hasGame && review.playerToMove === topColor}
              captured={topCaptured}
              advantage={topAdvantage}
            />

            {/* Horizontal eval bar above the board */}
            <div style={{ width: boardSize, alignSelf: 'center' }}>
              <EvalBar
                evalWhite={review.evalForBar}
                orientation={orientation}
                layout="horizontal"
                terminal={review.terminal}
              />
            </div>

            {/* Board — full-width, square */}
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

            {/* Bottom player strip — same color as orientation */}
            <PlayerStrip
              color={bottomColor}
              name={review.playerLabel.bottom}
              rating={review.playerLabel.bottomRating}
              active={review.hasGame && review.playerToMove === bottomColor}
              captured={bottomCaptured}
              advantage={bottomAdvantage}
            />

            {/* Playback controls — large tap targets */}
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
