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

export interface MoveAnalysis {
  ply: number;
  moveNumber: number;
  san: string;
  uci: string;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  evalBeforeWhite: UciScore;
  evalAfterWhite: UciScore;
  bestMoveUci: string | null;
  bestMoveSan: string | null;
  /** Engine's best move from `fenAfter` — i.e. the opponent's best reply. */
  nextBestMoveUci: string | null;
  secondBestEvalWhite: UciScore | null;
  classification: MoveClassification;
  wpLoss: number;
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

export interface GameMeta {
  whiteName: string | null;
  blackName: string | null;
  whiteElo: string | null;
  blackElo: string | null;
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  totalPlies: number;
}

// ---------- Tree of moves (mainline + branches) ----------
//
// Every position the user can navigate to is a node. The root has no move
// (it's the starting FEN). For a node N with `childrenIds`, `childrenIds[0]`
// is N's mainline continuation; any additional children are branches the user
// has explored by dragging pieces. A branch's own first child becomes its
// "mainline" continuation, recursively.
//
// `currentLine` is the path through the tree the user is currently on
// (root → ... → currentNode). When the user navigates back and plays a
// different move, the line beyond that point is rewritten to follow the new
// branch — but the previously-explored sub-tree is still reachable through
// the parent's children.

export type NodeId = string;

export interface MoveNode {
  id: NodeId;
  parentId: NodeId | null;
  move: MoveAnalysis | null; // null only on the root
  childrenIds: NodeId[];
  /** True while we're waiting for the engine to score a user-played branch move. */
  pending?: boolean;
}

export interface MoveTree {
  rootId: NodeId;
  nodes: Record<NodeId, MoveNode>;
}
