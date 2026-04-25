import type { MoveAnalysis, MoveNode, MoveTree, NodeId } from '../types';

let idCounter = 0;
export function newNodeId(): NodeId {
  idCounter += 1;
  return `n${idCounter}`;
}

export function createTree(): MoveTree {
  const rootId = newNodeId();
  const root: MoveNode = {
    id: rootId,
    parentId: null,
    move: null,
    childrenIds: [],
  };
  return { rootId, nodes: { [rootId]: root } };
}

/** Returns the node for `id` or undefined. */
export function getNode(tree: MoveTree, id: NodeId): MoveNode | undefined {
  return tree.nodes[id];
}

/**
 * Append a new node as a child of `parentId`. Returns the updated tree and
 * the new node's id. The tree is treated as immutable: a fresh object is
 * returned and only touched nodes are replaced.
 */
export function addChild(
  tree: MoveTree,
  parentId: NodeId,
  move: MoveAnalysis,
  options: { pending?: boolean } = {},
): { tree: MoveTree; nodeId: NodeId } {
  const parent = tree.nodes[parentId];
  if (!parent) throw new Error(`addChild: unknown parent ${parentId}`);
  const id = newNodeId();
  const child: MoveNode = {
    id,
    parentId,
    move,
    childrenIds: [],
    ...(options.pending ? { pending: true } : {}),
  };
  const newParent: MoveNode = {
    ...parent,
    childrenIds: [...parent.childrenIds, id],
  };
  return {
    tree: {
      ...tree,
      nodes: { ...tree.nodes, [id]: child, [parentId]: newParent },
    },
    nodeId: id,
  };
}

/** Replace the move on an existing node (used when a pending branch move's analysis arrives). */
export function updateMove(
  tree: MoveTree,
  nodeId: NodeId,
  move: MoveAnalysis,
): MoveTree {
  const node = tree.nodes[nodeId];
  if (!node) return tree;
  const updated: MoveNode = { ...node, move, pending: false };
  return { ...tree, nodes: { ...tree.nodes, [nodeId]: updated } };
}

/**
 * Look up an existing child of `parentId` whose move matches the given UCI.
 * Used to avoid duplicate branches when the user re-plays the same move.
 */
export function findChildByUci(
  tree: MoveTree,
  parentId: NodeId,
  uci: string,
): NodeId | null {
  const parent = tree.nodes[parentId];
  if (!parent) return null;
  for (const cid of parent.childrenIds) {
    if (tree.nodes[cid]?.move?.uci === uci) return cid;
  }
  return null;
}

/** Walks children[0] from `nodeId` to the end of that line. */
export function mainlineFrom(tree: MoveTree, nodeId: NodeId): NodeId[] {
  const out: NodeId[] = [];
  let cur: MoveNode | undefined = tree.nodes[nodeId];
  while (cur) {
    out.push(cur.id);
    const next: NodeId | undefined = cur.childrenIds[0];
    if (!next) break;
    cur = tree.nodes[next];
  }
  return out;
}

/** Same as `mainlineFrom(tree, tree.rootId)`. */
export function fullMainline(tree: MoveTree): NodeId[] {
  return mainlineFrom(tree, tree.rootId);
}

/** Returns ancestor path root → nodeId. */
export function pathTo(tree: MoveTree, nodeId: NodeId): NodeId[] {
  const path: NodeId[] = [];
  let cur: MoveNode | undefined = tree.nodes[nodeId];
  while (cur) {
    path.push(cur.id);
    if (!cur.parentId) break;
    cur = tree.nodes[cur.parentId];
  }
  return path.reverse();
}

/** True iff `nodeId` is on the original mainline path (only follows children[0]). */
export function isOnMainline(tree: MoveTree, nodeId: NodeId): boolean {
  let cur = tree.nodes[nodeId];
  while (cur && cur.parentId) {
    const parent = tree.nodes[cur.parentId];
    if (!parent || parent.childrenIds[0] !== cur.id) return false;
    cur = parent;
  }
  return true;
}
