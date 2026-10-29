/**
 * Layered-assistant AI helpers — the prompts and parsing behind "Generate with AI" (one field) and the
 * whole-tree generator. Ported from the old builder so the parsing can be tested; the network call
 * itself (`promptForData`) stays in the components.
 *
 * Differences from the old code, deliberately:
 *   • every generated node gets a fresh id — the model is told to invent ids and was free to repeat
 *     them, which breaks every id-keyed tree operation;
 *   • a malformed or empty response throws a message a person can act on.
 *
 * No React imports.
 */

import {
    LayeredAssistant,
    LayeredAssistantNode,
    LayeredNodeType,
    LeafNode,
    RouterNode,
    createLayeredAssistant,
    isLeafNode,
    isRouterNode,
} from '@/types/layeredAssistant';

export type AiField = 'description' | 'instructions';

/** The parts of an assistant definition the prompts mention. */
export interface AssistantDefinitionLike {
    name?: string;
    description?: string;
    instructions?: string;
    tags?: string[];
    dataSources?: { name?: string; id?: string }[];
    data?: Record<string, any>;
}

export function newNodeId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── One field ──────────────────────────────────────────────────────────────────

/** Multi-line summary of an assistant for a prompt (name, description, instructions excerpt, tags, files, tools). */
export function summarizeAssistant(def: AssistantDefinitionLike | null | undefined, fallbackName: string): string {
    if (!def) return `- Name: ${fallbackName}`;
    const lines = [`- Name: ${def.name || fallbackName}`];
    if (def.description) lines.push(`  Description: ${def.description}`);
    if (def.instructions) {
        lines.push(`  Instructions (summary): ${def.instructions.slice(0, 300)}${def.instructions.length > 300 ? '...' : ''}`);
    }
    if (def.tags?.length) lines.push(`  Tags: ${def.tags.join(', ')}`);
    if (def.dataSources?.length) lines.push(`  Data Sources: ${def.dataSources.map((d) => d.name || d.id).join(', ')}`);
    const ops: any[] = def.data?.operations ?? [];
    const builtIn: string[] = def.data?.builtInOperations ?? [];
    if (ops.length || builtIn.length) {
        const tools = [...ops.map((o) => o.name || o.operationId || '?'), ...builtIn].slice(0, 10);
        lines.push(`  Tools: ${tools.join(', ')}${tools.length === 10 ? '...' : ''}`);
    }
    if (def.data?.workflowTemplateId) lines.push(`  Workflow: ${def.data.workflowTemplateId}`);
    return lines.join('\n');
}

export interface FieldRequest {
    systemPrompt: string;
    userMessage: string;
}

/**
 * The prompt for generating one field of one node, or `null` when the combination isn't offered
 * (only a leaf's *description* is generated; a leaf has no decision guide).
 * `summaryFor(assistantId, name)` returns the summary text of the linked assistant.
 */
export function buildFieldRequest(
    node: LayeredAssistantNode,
    field: AiField,
    summaryFor: (assistantId: string, name: string) => string,
): FieldRequest | null {
    if (isRouterNode(node)) {
        const childSummaries = node.children
            .map((child) => {
                if (isLeafNode(child)) return summaryFor(child.assistantId, child.name);
                return `- Name: ${child.name} (sub-router with ${child.children.length} children)${child.description ? `\n  Description: ${child.description}` : ''}`;
            })
            .join('\n\n');
        if (field === 'description') {
            return {
                systemPrompt: 'You write short, plain-English descriptions for AI routing systems. Respond with ONLY the description text, no preamble, no quotes.',
                userMessage: `Write a 1-2 sentence description for a parent assistant router named "${node.name}".${node.description ? `\n\nCurrent draft (improve or refine it):\n${node.description}` : ''}\n\nIt routes between these assistants:\n\n${childSummaries || '(no children yet)'}\n\nExplain what kinds of questions or tasks this router handles in plain terms.`,
            };
        }
        return {
            systemPrompt: 'You write clear, concise decision guides for AI routing systems. Respond with ONLY the guide text — bullet points or short paragraphs. No preamble, no quotes.',
            userMessage: `Write a decision guide for a parent assistant router named "${node.name}".${node.description ? `\n  Description: ${node.description}` : ''}${node.instructions ? `\n\nCurrent draft (improve or refine it):\n${node.instructions}` : ''}\n\nIt chooses between:\n\n${childSummaries || '(no children yet)'}\n\nWrite clear guidance on when to pick each option. Be specific about signals in the user's message that indicate which assistant to route to.`,
        };
    }
    if (field !== 'description') return null;
    const leaf = node as LeafNode;
    const summary = summaryFor(leaf.assistantId, leaf.name);
    return {
        systemPrompt: 'You write short, plain-English descriptions that help AI routers understand when to pick an assistant. Respond with ONLY the description text, no preamble, no quotes.',
        userMessage: `Write a 1-2 sentence description for an assistant that will help a router decide when to use it.${leaf.description ? `\n\nCurrent draft (improve or refine it):\n${leaf.description}` : ''}\n\nAssistant details:\n${summary || `Name: ${leaf.name}`}\n\nFocus on what kinds of questions or tasks this assistant is best at, and what distinguishes it from other assistants.`,
    };
}

// ── Whole tree ─────────────────────────────────────────────────────────────────

export interface GeneratorAssistant {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
}

export interface TreePromptInput {
    purpose: string;
    assistants: GeneratorAssistant[];
    categories: string[];
    extraContext: string;
}

export function buildTreePrompt({ purpose, assistants, categories, extraContext }: TreePromptInput): string {
    const astList = assistants.length > 0
        ? assistants
            .map((a) => {
                const lines = [`  - name: "${a.name}"`];
                if (a.description) lines.push(`    description: "${a.description}"`);
                if (a.tags?.length) lines.push(`    tags: [${a.tags.map((t) => `"${t}"`).join(', ')}]`);
                return lines.join('\n');
            })
            .join('\n')
        : '  (No specific assistants pre-selected — infer sensible leaf names from the purpose)';
    const catList = categories.length > 0
        ? categories.map((c) => `  - "${c}"`).join('\n')
        : '  (None specified — infer from purpose)';

    return `You are an expert at designing Layered Assistant routing trees. A Layered Assistant is a decision tree where:
- RouterNodes route user requests to the correct child (another router or a leaf assistant)
- LeafNodes reference specific assistants and describe when to pick them

Your task: generate a complete Layered Assistant tree as strict JSON.

─── USER'S PURPOSE ───
${purpose.trim() || '(not specified — design a sensible general-purpose routing tree)'}

─── ASSISTANTS TO USE AS LEAVES ───
${astList}

─── ROUTING CATEGORIES / TOPIC AREAS ───
${catList}

─── EXTRA CONTEXT ───
${extraContext.trim() || '(none)'}

─── OUTPUT FORMAT (strict JSON, nothing else) ───
{
  "name": "string — concise layered assistant name",
  "description": "string — one sentence describing what this routes",
  "rootNode": {
    "type": "router",
    "id": "root",
    "name": "string",
    "description": "string — what kinds of requests hit this router",
    "instructions": "string — detailed decision guide: when to pick each child. Use bullet points. Be specific about signals in the user message.",
    "children": [
      {
        "type": "router" | "leaf",
        "id": "unique-string",
        "name": "string",
        ...
      }
    ]
  }
}

RouterNode schema:
{
  "type": "router",
  "id": "unique-string (short, kebab-case)",
  "name": "string",
  "description": "string",
  "instructions": "string — thorough routing decision guide with bullet points per child",
  "children": [ ...RouterNode | LeafNode ]
}

LeafNode schema:
{
  "type": "leaf",
  "id": "unique-string (short, kebab-case)",
  "assistantId": "string — MUST match exactly one of the assistant names listed above (use the name as the id if no explicit id was given)",
  "name": "string — same as the assistant name",
  "description": "string — when should the router pick this assistant? Be specific.",
  "routerContext": []
}

─── RULES ───
1. Every RouterNode MUST have at least 2 children
2. Every LeafNode assistantId MUST match an assistant from the list above (use the assistant's name if no explicit ID was given)
3. If fewer than 2 assistants were provided, still create a valid tree — use the provided assistant(s) plus invent sensible placeholder leaf names
4. RouterNode instructions MUST explicitly mention each child by name and describe when to route to it
5. Keep the tree depth ≤ 3 levels unless the categories clearly require more
6. Output ONLY the JSON object — no markdown fences, no explanation

Generate the JSON now:`;
}

/** Pull the JSON object out of a model reply (it may be fenced or wrapped in prose). */
export function extractJson(response: string | null | undefined): any {
    if (!response || !response.trim()) throw new Error('No response from AI.');
    const cleaned = response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not contain a JSON object.');
    try {
        return JSON.parse(match[0]);
    } catch {
        throw new Error('AI response was not valid JSON. Please try again.');
    }
}

/**
 * Turn the model's JSON into a layered assistant. Leaf references (a name or an id, in any case) are
 * resolved against `known`; anything unresolved is kept as written so the builder can flag it.
 */
export function parseTree(raw: any, known: { id: string; name: string }[]): LayeredAssistant {
    const byRef = new Map<string, string>();
    known.forEach((a) => {
        byRef.set(a.name.toLowerCase(), a.id);
        byRef.set(a.id.toLowerCase(), a.id);
    });
    const resolve = (value: string) => byRef.get(value.toLowerCase()) ?? value;

    // Model output is untrusted: a number or object where a string belongs would crash the first
    // `.trim()` during render, so every text field is coerced.
    const text = (value: unknown, fallback = ''): string =>
        typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

    const parseNode = (n: any): LayeredAssistantNode => {
        if (n && n.type === 'router') {
            return {
                type: LayeredNodeType.ROUTER,
                id: newNodeId(),
                name: text(n.name) || 'Router',
                description: text(n.description),
                instructions: text(n.instructions),
                children: Array.isArray(n.children) ? n.children.map(parseNode) : [],
            } as RouterNode;
        }
        return {
            type: LayeredNodeType.LEAF,
            id: newNodeId(),
            assistantId: resolve(text(n?.assistantId) || text(n?.name)),
            name: text(n?.name) || 'Assistant',
            description: text(n?.description),
            routerContext: [],
        } as LeafNode;
    };

    const root = parseNode(raw?.rootNode || raw);
    if (!isRouterNode(root)) throw new Error('The generated tree must start with a parent (router).');
    return {
        ...createLayeredAssistant(),
        name: text(raw?.name) || 'Generated Layered Assistant',
        description: text(raw?.description),
        rootNode: root,
    };
}
