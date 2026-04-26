import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpDown } from 'lucide-react';
import { Board } from '../../../shared/components/Board';
import { IconBtn } from '../../../shared/components/IconBtn';
import { EvalBar } from './components/EvalBar';
import { MovesCard } from '../components/MovesCard';
import { PlayerStrip } from '../../../shared/components/PlayerStrip';
import { PgnLoader } from '../components/PgnLoader';
import { CommentBubble } from '../components/CommentBubble';
import { AccuracyCard } from '../components/AccuracyCard';
import { AnalyzingCard } from '../components/AnalyzingCard';
import { ChessComStatsCard } from '../components/ChessComStatsCard';
import { EvalChart } from './components/EvalChart';
import type { Settings as AppSettings } from '../../../shared/utils/settings';
import { mainlineNodeIdForPly } from '../useReviewState';
import type { ReviewState } from '../useReviewState';
import type { ChessComProfileState } from '../useChessComProfile';

interface Props {
  settings: AppSettings;
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
  // Owned by the wrapper (ReviewPage) so it survives the desktop/mobile
  // breakpoint cross — see useReviewState.ts and ReviewPage.tsx.
  review: ReviewState;
  chessCom: ChessComProfileState;
}

export function ReviewDesktop({
  settings,
  orientation,
  setOrientation,
  review,
  chessCom,
}: Props) {
  const { t } = useTranslation();
  const flipBoard = () => setOrientation(orientation === 'white' ? 'black' : 'white');

  // ---- Responsive board sizing (desktop layout: fixed left/right cols) --

  const [boardSize, setBoardSize] = useState(560);
  useEffect(() => {
    function update() {
      const leftCol = 320;
      const rightCol = 360;
      const gaps = 40;
      const horizPad = 56;
      const evalGap = 32;
      const usableW = Math.min(window.innerWidth, 1600);
      const availW = usableW - leftCol - rightCol - gaps - horizPad - evalGap;
      const availH = window.innerHeight - 64 - 120 - 40;
      const size = Math.max(320, Math.min(availW, availH, 720));
      setBoardSize(Math.floor(size));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <>
      <main className="grid grid-cols-[320px_minmax(0,1fr)_360px] gap-5 px-7 py-5 max-w-[1600px] mx-auto w-full">
        {/* LEFT — back/greeting slot + moves OR chess.com stats (fills column) */}
        <div className="flex flex-col gap-3 min-w-0 min-h-0">
          {review.hasGame ? (
            <button
              type="button"
              onClick={review.handleReset}
              className="pz-hub-slot pz-hub-slot--back"
            >
              <ArrowLeft size={14} />
              {t('review.actions.backToStart')}
            </button>
          ) : (
            <div className="pz-hub-slot">
              {t('puzzles.hub.greeting', {
                name:
                  settings.chessComUsername.trim() ||
                  t('puzzles.hub.unknownUser'),
              })}
            </div>
          )}
          {review.hasGame ? (
            <div className="flex-1 min-h-0">
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
                fill
              />
            </div>
          ) : (
            <ChessComStatsCard state={chessCom} />
          )}
        </div>

        {/* CENTER — player strips + eval + board */}
        <div className="flex justify-center min-w-0">
          <div
            className="flex flex-col gap-2.5 items-stretch"
            style={{ width: boardSize + 32 }}
          >
            <PlayerStrip
              color={review.playerLabel.topColor}
              name={review.playerLabel.top}
              rating={review.playerLabel.topRating}
              active={review.hasGame && review.playerToMove === review.playerLabel.topColor}
            />
            <div
              className="relative grid gap-2.5 items-stretch"
              style={{ gridTemplateColumns: '22px 1fr', height: boardSize }}
            >
              <EvalBar evalWhite={review.evalForBar} orientation={orientation} />
              <Board
                fen={review.displayedFen}
                size={boardSize}
                orientation={orientation}
                highlightedSquares={review.highlights}
                arrows={review.arrows}
                badge={review.badge}
                onMove={review.allowDrag ? review.handlePieceMove : undefined}
              />
              <div
                className="absolute flex flex-col gap-1.5"
                style={{ left: 'calc(100% + 8px)', top: 0 }}
              >
                <IconBtn onClick={flipBoard} title={t('header.actions.flipBoard')}>
                  <ArrowUpDown size={16} />
                </IconBtn>
              </div>
            </div>
            <PlayerStrip
              color={review.playerLabel.bottomColor}
              name={review.playerLabel.bottom}
              rating={review.playerLabel.bottomRating}
              active={
                review.hasGame && review.playerToMove === review.playerLabel.bottomColor
              }
            />
          </div>
        </div>

        {/* RIGHT — source / coach / accuracy / chart */}
        <div className="flex flex-col gap-4 min-w-0">
          {review.showLoader ? (
            <PgnLoader
              onAnalyze={review.handleAnalyze}
              busy={false}
              chessCom={chessCom}
            />
          ) : review.showAnalyzing ? (
            <AnalyzingCard
              done={review.mainlineCount}
              total={review.expectedTotal}
              onCancel={review.handleReset}
            />
          ) : (
            <CommentBubble move={review.isPending ? null : review.currentMove} />
          )}

          <AccuracyCard
            whiteAccuracy={review.meta.whiteAccuracy}
            blackAccuracy={review.meta.blackAccuracy}
          />

          {review.mainlineMoves.length > 0 && (
            <div className="cr-card">
              <div className="cr-card-hd">
                <div className="cr-card-title">{t('review.evalChart.title')}</div>
              </div>
              <div className="px-4 pb-4">
                <EvalChart
                  moves={review.mainlineMoves}
                  totalPlies={review.expectedTotal}
                  currentPly={review.chartCurrentPly}
                  onSelect={(ply) => {
                    const id = mainlineNodeIdForPly(review.tree, ply);
                    if (id) review.selectNode(id);
                  }}
                  width={328}
                  height={70}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {review.error && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg shadow-card-md max-w-[80%]"
          style={{ background: 'rgba(214, 68, 58, 0.95)', color: '#fdfbf5' }}
          role="alert"
        >
          <div className="font-semibold mb-0.5">{t('review.errors.title')}</div>
          <div className="text-sm">{review.error}</div>
        </div>
      )}
    </>
  );
}
