/**
 * Layered-assistant tree model — every rule about the routing tree, as pure functions over
 * `RouterNode` / `LeafNode` (types/layeredAssistant.ts). The builder components only render it.
 *
 * Ported from the old `LayeredAssistantBuilder` (its helpers were inline and untestable), with two
 * additions the old builder did not have:
 *   • keyboard moves (`moveNodeStep`, `indentNode`, `outdentNode`) — drag-and-drop alone is not
 *     reachable without a pointer;
 *   • `normalizeDropPosition`, the "which third of the row am I over" rule, so it can be tested.
 *
 * All functions are immutable: they return a new root (or `null` when the request is invalid or a
 * no-op), never mutate their input.
 *
 * No React imports.
 */

import {
    LayeredAssistantNode,
    LayeredNodeType,
    LeafNode,
    RouterContextField,
    RouterNode,
    createLeafNode,
    createRouterNode,
    isLeafNode,
    isRouterNode,
} from '@/types/layeredAssistant';

export type DropPosition = 'before' | 'after' | 'inside';

export interface FoundNode {
    node: LayeredAssistantNode;
    parent: RouterNode | null;
    /** Index within `parent.children`; -1 for the root. */
    index: number;
}

// ── Lookup ─────────────────────────────────────────────────────────────────────

export function findNode(root: RouterNode, id: string): FoundNode | null {
    if (root.id === id) return { node: root, parent: null, index: -1 };
    const walk = (parent: RouterNode): FoundNode | null => {
        for (let i = 0; i < parent.children.length; i++) {
            const child = parent.children[i];
            if (child.id === id) return { node: child, parent, index: i };
            if (isRouterNode(child)) {
                const found = walk(child);
                if (found) return found;
            }
        }
        return null;
    };
    return walk(root);
}

export function containsNode(subtree: LayeredAssistantNode, id: string): boolean {
    if (subtree.id === id) return true;
    return isRouterNode(subtree) && subtree.children.some((c) => containsNode(c, id));
}

/** True when `ancestorId` is a *proper* ancestor of `nodeId` (a node is not its own ancestor). */
export function isProperAncestor(root: RouterNode, ancestorId: string, nodeId: string): boolean {
    if (ancestorId === nodeId) return false;
    const ancestor = findNode(root, ancestorId);
    return !!ancestor && containsNode(ancestor.node, nodeId);
}

export function getNodeDepth(root: RouterNode, id: string): number {
    const walk = (node: LayeredAssistantNode, depth: number): number => {
        if (node.id === id) return depth;
        if (isRouterNode(node)) {
            for (const child of node.children) {
                const found = walk(child, depth + 1);
                if (found >= 0) return found;
            }
        }
        return -1;
    };
    return walk(root, 0);
}

export function countNodes(node: LayeredAssistantNode, type: 'router' | 'leaf'): number {
    const self = (type === 'router' && isRouterNode(node)) || (type === 'leaf' && isLeafNode(node)) ? 1 : 0;
    return self + (isRouterNode(node) ? node.children.reduce((sum, c) => sum + countNodes(c, type), 0) : 0);
}

/** Every router in tree order (root first). */
export function allRouters(root: RouterNode): RouterNode[] {
    const out: RouterNode[] = [];
    const walk = (node: LayeredAssistantNode) => {
        if (isRouterNode(node)) {
            out.push(node);
            node.children.forEach(walk);
        }
    };
    walk(root);
    return out;
}

export function allLeaves(root: RouterNode): LeafNode[] {
    const out: LeafNode[] = [];
    const walk = (node: LayeredAssistantNode) => {
        if (isLeafNode(node)) out.push(node);
        else node.children.forEach(walk);
    };
    walk(root);
    return out;
}

/** Ids of every assistant already used as a leaf anywhere in the tree. */
export function assignedLeafIds(root: RouterNode): Set<string> {
    return new Set(allLeaves(root).map((leaf) => leaf.assistantId));
}

/** `{ assistantId: displayName }` for every leaf — lets dashboards show names instead of ids. */
export function leafNameMap(root: RouterNode): Record<string, string> {
    const map: Record<string, string> = {};
    allLeaves(root).forEach((leaf) => { map[leaf.assistantId] = leaf.name; });
    return map;
}

// ── Immutable edits ────────────────────────────────────────────────────────────

/** Replace one node (by id) with `updater(node)`; returns a new root. Unknown id returns `root`. */
export function updateNode(
    root: RouterNode,
    id: string,
    updater: (node: LayeredAssistantNode) => LayeredAssistantNode,
): RouterNode {
    const walk = (node: LayeredAssistantNode): LayeredAssistantNode => {
        if (node.id === id) return updater(node);
        if (isRouterNode(node)) return { ...node, children: node.children.map(walk) };
        return node;
    };
    return walk(root) as RouterNode;
}

/** Remove a node (and its subtree). The root cannot be removed. */
export function removeNode(root: RouterNode, id: string): RouterNode {
    if (root.id === id) return root;
    const walk = (router: RouterNode): RouterNode => ({
        ...router,
        children: router.children
            .filter((c) => c.id !== id)
            .map((c) => (isRouterNode(c) ? walk(c) : c)),
    });
    return walk(root);
}

/** Insert `node` into `parentId`'s children at `index` (clamped). */
export function insertNode(root: RouterNode, parentId: string, node: LayeredAssistantNode, index: number): RouterNode {
    const walk = (router: RouterNode): RouterNode => {
        if (router.id === parentId) {
            const children = [...router.children];
            children.splice(Math.max(0, Math.min(index, children.length)), 0, node);
            return { ...router, children };
        }
        return { ...router, children: router.children.map((c) => (isRouterNode(c) ? walk(c) : c)) };
    };
    return walk(root);
}

export function setRouterContext(root: RouterNode, leafId: string, field: RouterContextField, on: boolean): RouterNode {
    return updateNode(root, leafId, (node) => {
        if (!isLeafNode(node)) return node;
        const current = node.routerContext ?? [];
        const next = on ? (current.includes(field) ? current : [...current, field]) : current.filter((f) => f !== field);
        return { ...node, routerContext: next };
    });
}

// ── Adding members ─────────────────────────────────────────────────────────────

export function canAddChildren(node: LayeredAssistantNode | null | undefined): boolean {
    return !!node && isRouterNode(node);
}

/** "Parent 3": numbered by how many parents exist, matching the old builder. */
export function nextParentName(root: RouterNode): string {
    return `Parent ${countNodes(root, 'router') + 1}`;
}

export type AddResult = { ok: true; root: RouterNode; id: string } | { ok: false; reason: string };

export const SUB_PARENT_NEEDS_LEAF =
    'Add at least one assistant first before adding a Sub-Parent — a parent needs assistants, not just more parents.';

/** A router must hold an assistant before it may hold another router. */
export function addSubParent(root: RouterNode, parentId: string): AddResult {
    const target = findNode(root, parentId);
    if (!target || !isRouterNode(target.node)) return { ok: false, reason: 'Select a parent to add a Sub-Parent.' };
    if (!target.node.children.some(isLeafNode)) return { ok: false, reason: SUB_PARENT_NEEDS_LEAF };
    const created = createRouterNode(nextParentName(root));
    return { ok: true, id: created.id, root: insertNode(root, parentId, created, target.node.children.length) };
}

/** The minimum of an assistant a leaf needs; matches `Prompt` structurally so tests need no React. */
export interface AssistantLike {
    id: string;
    name: string;
    description?: string;
    data?: { assistant?: { definition?: { assistantId?: string; description?: string } & Record<string, any> } } & Record<string, any>;
}

/** The id a leaf stores: the root assistant id, falling back to the prompt id (old builder). */
export function assistantRefId(assistant: AssistantLike): string {
    return assistant.data?.assistant?.definition?.assistantId || assistant.id;
}

export function leafFromAssistant(assistant: AssistantLike): LeafNode {
    const description = assistant.data?.assistant?.definition?.description || assistant.description || '';
    return createLeafNode(assistantRefId(assistant), assistant.name, description);
}

export function addLeaf(root: RouterNode, parentId: string, assistant: AssistantLike): AddResult {
    const target = findNode(root, parentId);
    if (!target || !isRouterNode(target.node)) return { ok: false, reason: 'Select a parent to add an assistant to.' };
    const leaf = leafFromAssistant(assistant);
    return { ok: true, id: leaf.id, root: insertNode(root, parentId, leaf, target.node.children.length) };
}

/** Delete a node; the root stays. Returns the new root and which node to select next (the parent). */
export function deleteNode(root: RouterNode, id: string): { root: RouterNode; selectId: string } | null {
    const found = findNode(root, id);
    if (!found || !found.parent) return null;
    return { root: removeNode(root, id), selectId: found.parent.id };
}

// ── Moving (drag-and-drop and keyboard) ────────────────────────────────────────

/**
 * Which drop position a pointer at `relativeY` (0 = top of the row, 1 = bottom) means for `targetId`,
 * or `null` when the drop can't be valid.
 *   top quarter → before · bottom quarter → after · middle → inside
 *   a leaf can't take "inside" (nearest edge instead) · the root only takes "inside"
 *   a router can't land in its own subtree · nothing drops on itself
 */
export function normalizeDropPosition(
    root: RouterNode,
    dragId: string,
    targetId: string,
    relativeY: number,
): DropPosition | null {
    if (dragId === targetId || dragId === root.id) return null;
    const drag = findNode(root, dragId);
    const target = findNode(root, targetId);
    if (!drag || !target) return null;
    if (isRouterNode(drag.node) && isProperAncestor(root, dragId, targetId)) return null;

    let position: DropPosition = relativeY < 0.25 ? 'before' : relativeY > 0.75 ? 'after' : 'inside';
    if (isLeafNode(target.node) && position === 'inside') position = relativeY < 0.5 ? 'before' : 'after';
    if (targetId === root.id) position = 'inside';
    return position;
}

/** Where a drop lands: `{ parentId, index }` into the tree as it is *now* (before the dragged node is removed). */
export function resolveDropDestination(
    root: RouterNode,
    targetId: string,
    position: DropPosition,
): { parentId: string; index: number } | null {
    const target = findNode(root, targetId);
    if (!target) return null;
    if (position === 'inside') {
        return isRouterNode(target.node) ? { parentId: targetId, index: target.node.children.length } : null;
    }
    if (!target.parent) return null;
    return { parentId: target.parent.id, index: position === 'before' ? target.index : target.index + 1 };
}

/**
 * Move `dragId` to `position` relative to `targetId`. Returns the new root, or `null` when the move
 * is invalid or would leave the node exactly where it is.
 */
export function moveNode(root: RouterNode, dragId: string, targetId: string, position: DropPosition): RouterNode | null {
    if (dragId === root.id || dragId === targetId) return null;
    const drag = findNode(root, dragId);
    if (!drag || !drag.parent) return null;
    if (position === 'inside') {
        const target = findNode(root, targetId);
        if (!target || !isRouterNode(target.node)) return null;
    }
    if (isRouterNode(drag.node) && isProperAncestor(root, dragId, targetId)) return null;

    const dest = resolveDropDestination(root, targetId, position);
    if (!dest) return null;

    // Same parent and same effective slot: nothing to do (indices shift once the node is lifted out).
    if (drag.parent.id === dest.parentId) {
        const effective = drag.index < dest.index ? dest.index - 1 : dest.index;
        if (effective === drag.index) return null;
    }

    const without = removeNode(root, dragId);
    const fresh = resolveDropDestination(without, targetId, position);
    if (!fresh) return null;
    return insertNode(without, fresh.parentId, drag.node, fresh.index);
}

/** Move a node one slot up or down among its siblings. */
export function moveNodeStep(root: RouterNode, id: string, direction: 'up' | 'down'): RouterNode | null {
    const found = findNode(root, id);
    if (!found || !found.parent) return null;
    const siblings = found.parent.children;
    const target = direction === 'up' ? found.index - 1 : found.index + 1;
    if (target < 0 || target >= siblings.length) return null;
    return moveNode(root, id, siblings[target].id, direction === 'up' ? 'before' : 'after');
}

/** Make a node the last child of the router sibling just above it ("indent"). */
export function indentNode(root: RouterNode, id: string): RouterNode | null {
    const found = findNode(root, id);
    if (!found || !found.parent || found.index === 0) return null;
    const previous = found.parent.children[found.index - 1];
    if (!isRouterNode(previous)) return null;
    return moveNode(root, id, previous.id, 'inside');
}

/** Move a node out to follow its parent as a sibling ("outdent"). The root's direct children stay put. */
export function outdentNode(root: RouterNode, id: string): RouterNode | null {
    const found = findNode(root, id);
    if (!found || !found.parent || found.parent.id === root.id) return null;
    return moveNode(root, id, found.parent.id, 'after');
}

/** What the keyboard-move buttons may do for the selected node (to disable the rest). */
export function moveOptions(root: RouterNode, id: string): { up: boolean; down: boolean; indent: boolean; outdent: boolean } {
    return {
        up: !!moveNodeStep(root, id, 'up'),
        down: !!moveNodeStep(root, id, 'down'),
        indent: !!indentNode(root, id),
        outdent: !!outdentNode(root, id),
    };
}

// ── Validation ─────────────────────────────────────────────────────────────────

/** Soft problems: the user may still save ("Save anyway"). */
export function collectWarnings(root: RouterNode): string[] {
    const warnings: string[] = [];
    const walk = (node: LayeredAssistantNode) => {
        if (!node.name.trim()) warnings.push(`A ${isRouterNode(node) ? 'parent' : 'assistant'} node has no name.`);
        if (!isRouterNode(node)) return;
        const label = node.name || 'Unnamed';
        if (node.children.length === 0) {
            warnings.push(`Parent "${label}" has no members — add at least 2 assistants.`);
        } else {
            if (node.children.length === 1) {
                warnings.push(`Parent "${label}" has only 1 member — routing needs at least 2 options.`);
            }
            if (!node.instructions.trim() && node.children.length > 1) {
                warnings.push(`Parent "${label}" has no Decision Guide — the AI won't know how to route.`);
            }
            if (node.children.every(isRouterNode)) {
                warnings.push(`Parent "${label}" only contains sub-parents with no direct assistants.`);
            }
        }
        node.children.forEach(walk);
    };
    walk(root);
    return warnings;
}

export interface SaveValidation {
    /** Hard stop — saving is not allowed until fixed. */
    error: string | null;
    warnings: string[];
}

/**
 * `knownIds`, when given, lets the check also warn about assistants that can't be found (deleted, not
 * shared with you, or an AI placeholder) — routing to those fails at chat time.
 */
export function validateForSave(
    la: { name: string; rootNode: RouterNode },
    { knownIds }: { knownIds?: ReadonlySet<string> } = {},
): SaveValidation {
    if (!la.name.trim()) return { error: 'Give your layered assistant a name before saving.', warnings: [] };
    const warnings = collectWarnings(la.rootNode);
    if (knownIds) {
        unresolvedLeaves(la.rootNode, knownIds as Set<string>).forEach((leaf) =>
            warnings.push(`Assistant "${leaf.name || 'Unnamed'}" can't be found — it may have been deleted or not shared with you, so routing to it will fail.`),
        );
    }
    return { error: null, warnings };
}

/** Leaves whose assistant isn't among `knownIds` (deleted, not shared with you, or an AI placeholder). */
export function unresolvedLeaves(root: RouterNode, knownIds: Set<string>): LeafNode[] {
    return allLeaves(root).filter((leaf) => !knownIds.has(leaf.assistantId));
}

// ── Router context ─────────────────────────────────────────────────────────────

export interface ContextOption {
    field: RouterContextField;
    label: string;
}

/** Which "extra details for the router" a linked assistant can actually offer. */
export function routerContextOptions(
    definition: { dataSources?: unknown[]; data?: Record<string, any> } | null | undefined,
): ContextOption[] {
    if (!definition) return [];
    const data = definition.data ?? {};
    const options: ContextOption[] = [];
    if ((definition.dataSources?.length ?? 0) > 0 || !!data.integrationDriveData) {
        options.push({ field: 'dataSources', label: 'Data source names' });
    }
    if ((data.operations?.length ?? 0) > 0 || (data.builtInOperations?.length ?? 0) > 0) {
        options.push({ field: 'tools', label: 'Available tools' });
    }
    if (data.workflowTemplateId) options.push({ field: 'workflow', label: 'Workflow template steps' });
    return options;
}

export { LayeredNodeType };
