import { Check, Eye, Loader2, X } from 'lucide-react';
import { Chess } from 'chess.js';
import { useTranslation } from 'react-i18next';
import type { Puzzle, PuzzleResult } from '../../types';

interface Props {
  puzzle: Puzzle;
  result: PuzzleResult;
  delta: number;
  hintUsed: boolean;
  onNext: () => void;
  onRetry: () => void;
  /**
   * For the failed flow: while the engine's punishing response is still
   * being computed, hide retry/next and show a small loading hint so the
   * user understands the brief pause.
   */
  punisherPending?: boolean;
}

export function PuzzleResultPanel({
  puzzle,
  result,
  delta,
  hintUsed,
  onNext,
  onRetry,
  punisherPending = false,
}: Props) {
  const { t } = useTranslation();
  const tone = toneOf(result);
  const title = titleOf(result, hintUsed, t);
  const explanation = explanationOf(result, hintUsed, t);
  const bestLine = formatBestLine(puzzle);

  return (
    <div className={`pz-result ${tone}`}>
      <div className="pz-result-hd">
        <span className={`pz-result-icon ${tone}`}>
          {tone === 'correct' && <Check size={16} strokeWidth={3} />}
          {tone === 'wrong' && <X size={16} strokeWidth={3} />}
          {tone === 'revealed' && <Eye size={16} />}
        </span>
        <div className="pz-result-title">{title}</div>
        <div className="pz-result-delta">
          {delta > 0 ? `+${delta}` : `${delta}`}
        </div>
      </div>

      {bestLine.length > 0 && (
        <div className="pz-bestline">
          <div className="pz-bestline-label">{t('puzzles.solver.result.solutionLabel')}</div>
          <div className="pz-bestline-moves">
            {bestLine.map((entry, i) => (
              <span key={i} className="flex items-baseline gap-1">
                {entry.num != null && (
                  <span className="pz-bl-num">{entry.num}.</span>
                )}
                <span className="pz-bl-mv">{entry.san}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="pz-explanation">
        {punisherPending ? (
          <span className="inline-flex items-center gap-2 text-ink-3">
            <Loader2 size={14} className="animate-spin" />
            {t('puzzles.solver.result.punisherPending')}
          </span>
        ) : (
          explanation
        )}
      </div>

      {!punisherPending && (
        <div className="pz-result-actions">
          <button type="button" onClick={onRetry} className="pz-btn-secondary">
            {t('puzzles.solver.result.retry')}
          </button>
          <button type="button" onClick={onNext} className="pz-btn-primary">
            {t('puzzles.solver.result.next')}
          </button>
        </div>
      )}
    </div>
  );
}

function toneOf(result: PuzzleResult): 'correct' | 'wrong' | 'revealed' {
  if (result === 'solve') return 'correct';
  if (result === 'reveal') return 'revealed';
  return 'wrong';
}

function titleOf(
  result: PuzzleResult,
  hintUsed: boolean,
  t: (key: string) => string,
): string {
  if (result === 'solve') {
    return hintUsed
      ? t('puzzles.solver.result.solvedWithHints')
      : t('puzzles.solver.result.solved');
  }
  if (result === 'reveal') return t('puzzles.solver.result.revealed');
  if (result === 'hint') return t('puzzles.solver.result.failedWithHints');
  return t('puzzles.solver.result.wrong');
}

function explanationOf(
  result: PuzzleResult,
  hintUsed: boolean,
  t: (key: string) => string,
): string {
  if (result === 'solve' && !hintUsed) {
    return t('puzzles.solver.result.explainSolveClean');
  }
  if (result === 'solve' && hintUsed) {
    return t('puzzles.solver.result.explainSolveHinted');
  }
  if (result === 'reveal') {
    return t('puzzles.solver.result.explainReveal');
  }
  return t('puzzles.solver.result.explainWrong');
}

interface BestLineEntry {
  num: number | null;
  san: string;
}

function formatBestLine(puzzle: Puzzle): BestLineEntry[] {
  const chess = new Chess(puzzle.fen);
  const startNumber = parseInt(puzzle.fen.split(' ')[5] ?? '1', 10);
  const startSide = (puzzle.fen.split(' ')[1] ?? 'w') as 'w' | 'b';

  const out: BestLineEntry[] = [];
  let moveNumber = startNumber;
  let toMove: 'w' | 'b' = startSide;

  for (const uci of puzzle.moves) {
    let san: string | null = null;
    try {
      const applied = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
      });
      san = applied?.san ?? null;
    } catch {
      san = null;
    }
    if (!san) break;

    out.push({
      num: toMove === 'w' ? moveNumber : null,
      san,
    });

    if (toMove === 'b') moveNumber += 1;
    toMove = toMove === 'w' ? 'b' : 'w';
  }
  return out;
}
