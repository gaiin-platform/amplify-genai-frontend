/**
 * LayeredAiGenerator — describe what the layered assistant is for, pick the assistants it should route
 * to, and let AI draft the whole tree.
 *
 * Rendered by the builder *instead of* its panels (Guide §5 rule 2: one modal at a time), so the
 * builder's state is untouched until "Use this tree". Prompting and parsing live in `layeredAiModel`.
 * A request that finishes after the user has left, or after a newer one started, is discarded.
 */

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconLoader2, IconSparkles } from '@tabler/icons-react';
import HomeContext from '@/components/Home/home.context';
import { Prompt } from '@/types/prompt';
import { AssistantDefinition } from '@/types/assistant';
import { DefaultModels } from '@/types/model';
import { LayeredAssistant } from '@/types/layeredAssistant';
import { MessageType, newMessage } from '@/types/chat';
import { promptForData } from '@/utils/app/llm';
import { CheckboxControl, TextAreaControl } from '@/components/NewUI/shared/FormControls';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import { TagChipsInput } from '@/components/NewUI/shared/TagChipsInput';
import { assistantRefId } from '../layeredTreeModel';
import { GeneratorAssistant, buildTreePrompt, extractJson, parseTree } from '../layeredAiModel';

export interface LayeredAiGeneratorProps {
    assistants: Prompt[];
    onBack: () => void;
    onApply: (generated: LayeredAssistant) => void;
}

const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 };
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';

export const LayeredAiGenerator: React.FC<LayeredAiGeneratorProps> = ({ assistants, onBack, onApply }) => {
    const { state: { chatEndpoint, defaultAccount }, getDefaultModel } = useContext(HomeContext);
    const [purpose, setPurpose] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [categories, setCategories] = useState<string[]>([]);
    const [extraContext, setExtraContext] = useState('');
    const [term, setTerm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestSeq = useRef(0);
    useEffect(() => () => { requestSeq.current++; }, []);

    const visible = useMemo(() => {
        const q = term.trim().toLowerCase();
        return q ? assistants.filter((a) => a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q)) : assistants;
    }, [assistants, term]);

    const toggle = (id: string, on: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (on) next.add(id); else next.delete(id);
            return next;
        });

    const generate = async () => {
        if (!purpose.trim() && selected.size === 0) {
            setError('Describe the purpose or select at least one assistant.');
            return;
        }
        if (!chatEndpoint) {
            setError('AI generation isn’t available right now.');
            return;
        }
        const seq = ++requestSeq.current;
        setBusy(true);
        setError(null);
        try {
            const chosen: GeneratorAssistant[] = assistants
                .filter((a) => selected.has(assistantRefId(a)))
                .map((a) => {
                    const def = a.data?.assistant?.definition as AssistantDefinition | undefined;
                    return { id: assistantRefId(a), name: a.name, description: def?.description || a.description, tags: def?.tags };
                });
            const prompt = buildTreePrompt({ purpose, assistants: chosen, categories, extraContext });
            const messages = [newMessage({ role: 'user', content: prompt, type: MessageType.PROMPT })];
            const response = await promptForData(
                chatEndpoint, messages, getDefaultModel(DefaultModels.ADVANCED),
                'Respond with only a valid JSON object.', defaultAccount, undefined, 6000,
            );
            if (seq !== requestSeq.current) return;
            const known = assistants.map((a) => ({ id: assistantRefId(a), name: a.name }));
            onApply(parseTree(extractJson(response), known));
        } catch (e: any) {
            if (seq !== requestSeq.current) return;
            console.error('Layered assistant generation failed:', e);
            setError(e?.message || 'Generation failed. Please try again.');
        } finally {
            if (seq === requestSeq.current) setBusy(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" onClick={onBack} disabled={busy} className={`${FOCUS} disabled:opacity-50`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    <IconArrowLeft size={15} aria-hidden="true" /> Back to editor
                </button>
                <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Generate a tree with AI</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        You’ll review the result before it replaces anything.
                    </p>
                </div>
            </div>

            {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--text-error)' }}>{error}</p>}

            <div>
                <label htmlFor="la-gen-purpose" style={label}>What is this layered assistant for?</label>
                <TextAreaControl id="la-gen-purpose" rows={3} value={purpose} placeholder="e.g. Answer student questions and send each to the right campus service." onChange={(e) => setPurpose(e.target.value)} />
            </div>

            <div>
                <span style={label}>Assistants to route to ({selected.size} selected)</span>
                <SearchInput fullWidth value={term} onChange={setTerm} onClear={() => setTerm('')} placeholder="Search assistants…" aria-label="Search assistants" />
                <div role="group" aria-label="Assistants to route to" style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-app)' }}>
                    {visible.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>{assistants.length === 0 ? 'No assistants available.' : 'No matches.'}</p>}
                    {visible.map((a) => {
                        const id = assistantRefId(a);
                        return (
                            <CheckboxControl
                                key={a.id}
                                id={`la-gen-${a.id}`}
                                label={<span>{a.name}{a.description ? <span style={{ color: 'var(--text-muted)' }}> — {a.description}</span> : null}</span>}
                                checked={selected.has(id)}
                                onChange={(on) => toggle(id, on)}
                            />
                        );
                    })}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>None selected? The AI will invent placeholder assistants you can replace later.</p>
            </div>

            <div>
                <span style={label}>Topic areas (optional)</span>
                <TagChipsInput tags={categories} onChange={setCategories} ariaLabel="Topic areas" placeholder="e.g. Admissions, Financial aid" />
            </div>

            <div>
                <label htmlFor="la-gen-context" style={label}>Anything else the AI should know? (optional)</label>
                <TextAreaControl id="la-gen-context" rows={3} value={extraContext} onChange={(e) => setExtraContext(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={generate} disabled={busy} aria-busy={busy} className={`${FOCUS} disabled:opacity-60`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>
                    {busy ? <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin motion-reduce:animate-none" /> : <IconSparkles size={15} aria-hidden="true" />}
                    {busy ? 'Generating…' : 'Generate tree'}
                </button>
            </div>
        </div>
    );
};
