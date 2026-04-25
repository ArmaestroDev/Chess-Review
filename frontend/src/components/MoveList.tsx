import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { MoveNode, MoveTree, NodeId } from '../types';
import { fullMainline } from '../utils/tree';
import { ClassificationIcon } from './ClassificationIcon';

interface Props {
  tree: MoveTree;
  currentNodeId: NodeId;
  onSelectNode: (id: NodeId) => void;
}

interface Row {
  moveNumber: number;
  whiteId?: NodeId;
  blackId?: NodeId;
}

export function MoveList({ tree, currentNodeId, onSelectNode }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentNodeId]);

  const rows = useMemo<Row[]>(() => {
    const ids = fullMainline(tree).slice(1); // skip root
    const out: Row[] = [];
    for (const id of ids) {
      const m = tree.nodes[id]?.move;
      if (!m) continue;
      const rowIdx = Math.floor(m.ply / 2);
      if (!out[rowIdx]) out[rowIdx] = { moveNumber: rowIdx + 1 };
      if (m.color === 'w') out[rowIdx].whiteId = id;
      else out[rowIdx].blackId = id;
    }
    return out;
  }, [tree]);

  // Branches off the root (alt for white's first move) get rendered before
  // any mainline rows.
  const rootBranchIds = (tree.nodes[tree.rootId]?.childrenIds ?? []).slice(1);

  return (
    <div className="overflow-y-auto scrollbar-thin px-3 py-1 text-[15px]">
      {rows.length === 0 && (
        <div className="text-stone-400/70 py-4 text-center text-sm">
          Moves will appear here once analysis starts.
        </div>
      )}

      {rootBranchIds.map((bid) => (
        <BranchLine
          key={bid}
          tree={tree}
          branchRootId={bid}
          currentNodeId={currentNodeId}
          onSelectNode={onSelectNode}
          activeRef={activeRef}
        />
      ))}

      {rows.map((row) => (
        <div key={row.moveNumber}>
          <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center py-[3px]">
            <div className="text-stone-400 font-semibold">{row.moveNumber}.</div>
            <MoveCell
              nodeId={row.whiteId}
              tree={tree}
              currentNodeId={currentNodeId}
              onSelectNode={onSelectNode}
              ref={row.whiteId === currentNodeId ? activeRef : null}
            />
            <MoveCell
              nodeId={row.blackId}
              tree={tree}
              currentNodeId={currentNodeId}
              onSelectNode={onSelectNode}
              ref={row.blackId === currentNodeId ? activeRef : null}
            />
          </div>
          {row.whiteId &&
            renderBranches(tree, row.whiteId, currentNodeId, onSelectNode, activeRef)}
          {row.blackId &&
            renderBranches(tree, row.blackId, currentNodeId, onSelectNode, activeRef)}
        </div>
      ))}
    </div>
  );
}

function renderBranches(
  tree: MoveTree,
  parentId: NodeId,
  currentNodeId: NodeId,
  onSelectNode: (id: NodeId) => void,
  activeRef: React.RefObject<HTMLButtonElement>,
) {
  const parent = tree.nodes[parentId];
  if (!parent || parent.childrenIds.length <= 1) return null;
  return (
    <>
      {parent.childrenIds.slice(1).map((bid) => (
        <BranchLine
          key={bid}
          tree={tree}
          branchRootId={bid}
          currentNodeId={currentNodeId}
          onSelectNode={onSelectNode}
          activeRef={activeRef}
        />
      ))}
    </>
  );
}

interface BranchLineProps {
  tree: MoveTree;
  branchRootId: NodeId;
  currentNodeId: NodeId;
  onSelectNode: (id: NodeId) => void;
  activeRef: React.RefObject<HTMLButtonElement>;
}

function BranchLine({
  tree,
  branchRootId,
  currentNodeId,
  onSelectNode,
  activeRef,
}: BranchLineProps) {
  // Walk the branch's children[0] chain to collect the moves shown inline.
  const nodes: MoveNode[] = [];
  let cur: MoveNode | undefined = tree.nodes[branchRootId];
  while (cur) {
    nodes.push(cur);
    const nextId: NodeId | undefined = cur.childrenIds[0];
    if (!nextId) break;
    cur = tree.nodes[nextId];
  }

  return (
    <div className="pl-9 pr-2 py-[3px] text-[13px] flex items-center gap-1 flex-wrap border-l-2 border-stone-500/30 ml-3">
      {nodes.map((node, i) => {
        const m = node.move;
        if (!m) return null;
        const isWhite = m.color === 'w';
        const showNumber = i === 0 || isWhite;
        const numberLabel = showNumber
          ? `${m.moveNumber}${isWhite ? '.' : '...'}`
          : null;
        const active = node.id === currentNodeId;
        return (
          <span key={node.id} className="inline-flex items-center gap-1">
            {numberLabel && (
              <span className="text-stone-400 font-semibold">{numberLabel}</span>
            )}
            <button
              ref={active ? activeRef : null}
              type="button"
              onClick={() => onSelectNode(node.id)}
              className={
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ' +
                (active
                  ? 'bg-stone-100 text-stone-900 font-bold'
                  : node.pending
                    ? 'text-stone-300/70 italic hover:bg-white/10'
                    : 'text-amber-200/90 hover:bg-white/10 font-semibold')
              }
              title={node.pending ? 'Analyzing…' : undefined}
            >
              {!node.pending && (
                <ClassificationIcon classification={m.classification} size={14} />
              )}
              <span>{m.san}</span>
            </button>
          </span>
        );
      })}
    </div>
  );
}

interface CellProps {
  nodeId?: NodeId;
  tree: MoveTree;
  currentNodeId: NodeId;
  onSelectNode: (id: NodeId) => void;
}

const MoveCell = forwardRef<HTMLButtonElement, CellProps>(function MoveCell(
  { nodeId, tree, currentNodeId, onSelectNode },
  ref,
) {
  if (!nodeId) return <span />;
  const node = tree.nodes[nodeId];
  const m = node?.move;
  if (!m) return <span />;
  const active = nodeId === currentNodeId;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelectNode(nodeId)}
      className={
        'flex items-center gap-1.5 px-2 py-0.5 rounded text-left transition-colors ' +
        (active
          ? 'bg-stone-100 text-stone-900 font-bold'
          : 'text-stone-100 hover:bg-white/10 font-semibold')
      }
    >
      <ClassificationIcon classification={m.classification} size={16} />
      <span>{m.san}</span>
    </button>
  );
});
