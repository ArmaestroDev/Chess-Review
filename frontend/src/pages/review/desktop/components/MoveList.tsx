import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MoveNode, MoveTree, NodeId } from '../../../../shared/types';
import { fullMainline } from '../../../../shared/utils/tree';
import { ClassificationIcon } from '../../../../shared/components/ClassificationIcon';

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
  const { t } = useTranslation();
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentNodeId]);

  const rows = useMemo<Row[]>(() => {
    const ids = fullMainline(tree).slice(1);
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

  const rootBranchIds = (tree.nodes[tree.rootId]?.childrenIds ?? []).slice(1);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-1">
      {rows.length === 0 && (
        <div className="text-ink-4 py-6 text-center text-[11.5px]">
          {t('review.moves.empty')}
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
          <div className="grid grid-cols-[28px_1fr_1fr] gap-1 items-center py-px">
            <div className="font-mono text-[11px] text-ink-4 text-right pr-1">
              {row.moveNumber}.
            </div>
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
  const { t } = useTranslation();
  const nodes: MoveNode[] = [];
  let cur: MoveNode | undefined = tree.nodes[branchRootId];
  while (cur) {
    nodes.push(cur);
    const nextId: NodeId | undefined = cur.childrenIds[0];
    if (!nextId) break;
    cur = tree.nodes[nextId];
  }

  return (
    <div className="pl-9 pr-2 py-px text-[11px] flex items-center gap-1 flex-wrap border-l-2 border-line ml-3">
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
              <span className="text-ink-4 font-mono font-semibold">{numberLabel}</span>
            )}
            <button
              ref={active ? activeRef : null}
              type="button"
              onClick={() => onSelectNode(node.id)}
              className={
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ' +
                (active
                  ? 'bg-accent-soft text-accent-ink font-semibold'
                  : node.pending
                    ? 'text-ink-3 italic hover:bg-line/40'
                    : 'text-ink-2 hover:bg-line/40 font-medium')
              }
              title={node.pending ? t('review.moves.analyzingTooltip') : undefined}
            >
              {!node.pending && (
                <ClassificationIcon classification={m.classification} size={12} />
              )}
              <span className="font-mono">{m.san}</span>
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
        'flex items-center gap-1.5 px-2 py-[5px] rounded-md text-left border transition-colors ' +
        (active
          ? 'bg-accent-soft border-accent text-accent-ink font-semibold'
          : 'border-transparent hover:bg-line/40 text-ink')
      }
    >
      <ClassificationIcon classification={m.classification} size={14} />
      <span className="font-mono text-[12px] font-medium">{m.san}</span>
    </button>
  );
});
