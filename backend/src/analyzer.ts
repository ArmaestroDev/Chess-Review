import { Chess } from 'chess.js';
import { StockfishEngine } from './engine';
import {
  AnalysisEvent,
  AnalysisResult,
  MoveAnalysis,
  UciScore,
} from './types';
import {
  accuracyFromWpLoss,
  classifyMove,
  inferBook,
  scoreToCp,
  scoreToWhitePov,
} from './classify';

export interface AnalyzeOptions {
  depth: number;
  multiPv: number; // for the "before" position to detect great/only moves
}

/**
 * Run Stockfish over a single move from `fenBefore` (apply `uci`) and produce
 * a fully-classified MoveAnalysis. Used both inside the per-game loop and for
 * one-off branch evaluations triggered by the user dragging a piece.
 *
 * `cachedBefore` lets the caller hand in an already-computed multiPV result
 * for the position prior to the move so we don't analyze it twice in a row.
 */
export async function analyzePosition(
  engine: StockfishEngine,
  fenBefore: string,
  uci: string,
  options: AnalyzeOptions,
  ply: number,
  cachedBefore: AnalysisResult | null = null,
): Promise<{ move: MoveAnalysis; afterAnalysis: AnalysisResult }> {
  const replay = new Chess(fenBefore);
  const sideToMoveBefore = replay.turn();

  const moveSpec = {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
  };
  const applied = replay.move(moveSpec);
  if (!applied) {
    throw new Error(`Illegal move ${uci} from FEN ${fenBefore}`);
  }
  const fenAfter = replay.fen();
  const sideToMoveAfter = replay.turn();

  const beforeAnalysis: AnalysisResult =
    cachedBefore && cachedBefore.pvs.length >= options.multiPv
      ? cachedBefore
      : await engine.analyze(fenBefore, options.depth, options.multiPv);

  const afterAnalysis = await engine.analyze(fenAfter, options.depth, options.multiPv);

  const evalBeforeWhite: UciScore = scoreToWhitePov(
    beforeAnalysis.pvs[0]?.score,
    sideToMoveBefore,
  );
  const evalAfterWhite: UciScore = scoreToWhitePov(
    afterAnalysis.pvs[0]?.score,
    sideToMoveAfter,
  );
  const secondBestEvalWhite: UciScore | null = beforeAnalysis.pvs[1]
    ? scoreToWhitePov(beforeAnalysis.pvs[1].score, sideToMoveBefore)
    : null;

  let bestMoveSan: string | null = null;
  if (beforeAnalysis.bestMove) {
    try {
      const tmp = new Chess(fenBefore);
      const m = tmp.move({
        from: beforeAnalysis.bestMove.slice(0, 2),
        to: beforeAnalysis.bestMove.slice(2, 4),
        promotion: beforeAnalysis.bestMove.slice(4, 5) || undefined,
      });
      bestMoveSan = m?.san ?? null;
    } catch {
      bestMoveSan = null;
    }
  }

  const candidatesUci = beforeAnalysis.pvs
    .slice(0, Math.max(2, options.multiPv))
    .map((p) => p.pv[0])
    .filter(Boolean);

  const inferredBook = inferBook({
    ply,
    candidatesUci,
    playedUci: uci,
    evalBeforeCpWhite: scoreToCp(evalBeforeWhite),
  });

  const { classification, wpLoss } = classifyMove({
    movedColor: applied.color,
    bestMoveUci: beforeAnalysis.bestMove,
    playedUci: uci,
    evalBeforeWhite,
    evalAfterWhite,
    secondBestEvalWhite,
    fenAfterMove: fenAfter,
    movedMove: applied,
    ply,
    inferredBook,
  });

  const move: MoveAnalysis = {
    ply,
    moveNumber: Math.floor(ply / 2) + 1,
    san: applied.san,
    uci,
    color: applied.color,
    fenBefore,
    fenAfter,
    evalBeforeWhite,
    evalAfterWhite,
    bestMoveUci: beforeAnalysis.bestMove,
    bestMoveSan,
    nextBestMoveUci: afterAnalysis.bestMove,
    secondBestEvalWhite,
    classification,
    wpLoss,
  };

  return { move, afterAnalysis };
}

export async function analyzeGame(
  pgn: string,
  engine: StockfishEngine,
  options: AnalyzeOptions,
  emit: (event: AnalysisEvent) => void,
): Promise<void> {
  const game = new Chess();

  try {
    game.loadPgn(pgn);
  } catch (err) {
    emit({ type: 'error', message: `Failed to parse PGN: ${(err as Error).message}` });
    return;
  }

  // chess.js 1.x exposes getHeaders(); older betas exposed header(). Prefer the
  // newer name and fall back, since either may be present at runtime.
  const headers = (
    (game as any).getHeaders?.() ??
    (game as any).header?.() ??
    {}
  ) as Record<string, string | undefined>;
  const history = game.history({ verbose: true });
  if (history.length === 0) {
    emit({ type: 'error', message: 'PGN contains no moves.' });
    return;
  }

  emit({
    type: 'start',
    totalPlies: history.length,
    whiteName: headers.White ?? null,
    blackName: headers.Black ?? null,
    whiteElo: headers.WhiteElo ?? null,
    blackElo: headers.BlackElo ?? null,
  });

  await engine.newGame();

  const replay = new Chess();
  let cachedBefore: AnalysisResult | null = null;

  const wpLossesByColor: Record<'w' | 'b', number[]> = { w: [], b: [] };

  for (let ply = 0; ply < history.length; ply++) {
    const histMove = history[ply];
    const fenBefore = replay.fen();
    const uci = histMove.from + histMove.to + (histMove.promotion ?? '');

    const { move, afterAnalysis } = await analyzePosition(
      engine,
      fenBefore,
      uci,
      options,
      ply,
      cachedBefore,
    );

    // Replay to keep replay.fen() correct for the next iteration's fenBefore
    replay.move({ from: histMove.from, to: histMove.to, promotion: histMove.promotion });

    cachedBefore = afterAnalysis;
    wpLossesByColor[move.color].push(move.wpLoss);
    emit({ type: 'progress', ...move });
  }

  const whiteAccuracy = avg(wpLossesByColor.w.map(accuracyFromWpLoss));
  const blackAccuracy = avg(wpLossesByColor.b.map(accuracyFromWpLoss));

  emit({ type: 'complete', whiteAccuracy, blackAccuracy });
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
