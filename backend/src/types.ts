export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'good'
  | 'ok'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface UciScore {
  cp?: number;
  mate?: number;
}

export interface PvInfo {
  multipv: number;
  depth: number;
  score: UciScore;
  pv: string[]; // UCI move list
}

export interface AnalysisResult {
  bestMove: string | null;
  ponder: string | null;
  pvs: PvInfo[];
}

export interface MoveAnalysis {
  ply: number; // 0-indexed
  moveNumber: number; // 1, 1, 2, 2, ...
  san: string;
  uci: string;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  evalBeforeWhite: UciScore; // White-POV score before move
  evalAfterWhite: UciScore;  // White-POV score after move
  bestMoveUci: string | null;
  bestMoveSan: string | null;
  /** Engine's best move from `fenAfter` — i.e. the opponent's best reply. */
  nextBestMoveUci: string | null;
  secondBestEvalWhite: UciScore | null;
  classification: MoveClassification;
  wpLoss: number; // 0-100, win-probability loss for the moving side
}

export interface AnalysisStartEvent {
  type: 'start';
  totalPlies: number;
  whiteName: string | null;
  blackName: string | null;
  whiteElo: string | null;
  blackElo: string | null;
}

export interface AnalysisProgressEvent extends MoveAnalysis {
  type: 'progress';
}

export interface AnalysisCompleteEvent {
  type: 'complete';
  whiteAccuracy: number;
  blackAccuracy: number;
}

export interface AnalysisErrorEvent {
  type: 'error';
  message: string;
}

export type AnalysisEvent =
  | AnalysisStartEvent
  | AnalysisProgressEvent
  | AnalysisCompleteEvent
  | AnalysisErrorEvent;
