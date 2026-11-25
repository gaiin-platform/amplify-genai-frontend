// @vitest-environment jsdom
/**
 * LayeredBuilderHost mounts the Layered Assistant Builder in the new UI. The builder registers its
 * save fn with the host on every edit (the fn changes with the draft). The host must start no
 * timers per registration, and the header Save button must still show save progress.
 */
import React, { useEffect, useRef, useState } from 'react';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';

/** Stand-in builder: each "edit" re-registers a new save fn, the way the real builder does. */
vi.mock('@/components/LayeredAssistants/LayeredAssistantBuilder', () => ({
    LayeredAssistantBuilder: ({ onRegisterSave, onSavingChange }: any) => {
        const [edits, setEdits] = useState(0);
        const savingRef = useRef(false);
        useEffect(() => {
            onRegisterSave?.(() => {}, savingRef);
        }, [edits, onRegisterSave]);
        return (
            <div>
                <button data-testid="edit" onClick={() => setEdits((n) => n + 1)} />
                <button
                    data-testid="start-save"
                    onClick={() => { savingRef.current = true; onSavingChange?.(true); }}
                />
                <button
                    data-testid="end-save"
                    onClick={() => { savingRef.current = false; onSavingChange?.(false); }}
                />
            </div>
        );
    },
}));

import { LayeredBuilderHost } from '@/components/NewUI/shared/LayeredBuilderHost';

let host: HTMLElement;
let root: Root;
let active: Set<unknown>;
let realSetInterval: typeof window.setInterval;
let realClearInterval: typeof window.clearInterval;

const click = (testId: string) =>
    act(() => {
        (document.querySelector(`[data-testid="${testId}"]`) as HTMLElement).click();
    });

const saveButton = () =>
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Save') as HTMLButtonElement;

const openBuilder = () =>
    act(() => {
        window.dispatchEvent(new CustomEvent('openLayeredBuilderTrigger', { detail: { isOpen: true, data: {} } }));
    });

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    // Track live intervals so a leaked one is visible.
    active = new Set();
    realSetInterval = window.setInterval;
    realClearInterval = window.clearInterval;
    (window as any).setInterval = (...args: any[]) => {
        const id = (realSetInterval as any)(...args);
        active.add(id);
        return id;
    };
    (window as any).clearInterval = (id: any) => {
        active.delete(id);
        realClearInterval(id);
    };
    (globalThis as any).setInterval = window.setInterval;
    (globalThis as any).clearInterval = window.clearInterval;

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<LayeredBuilderHost />));
});

afterEach(() => {
    act(() => root.unmount());
    active.forEach((id) => realClearInterval(id as any));
    (window as any).setInterval = realSetInterval;
    (window as any).clearInterval = realClearInterval;
    (globalThis as any).setInterval = realSetInterval;
    (globalThis as any).clearInterval = realClearInterval;
    document.body.innerHTML = '';
});

describe('LayeredBuilderHost', () => {
    it('leaves no interval running after repeated edits, closing, and unmount', () => {
        openBuilder();
        for (let i = 0; i < 5; i++) click('edit');
        expect(active.size).toBe(0);

        act(() => {
            window.dispatchEvent(new CustomEvent('openLayeredBuilderTrigger', { detail: { isOpen: false } }));
        });
        expect(active.size).toBe(0);

        openBuilder();
        click('edit');
        act(() => root.unmount());
        root = createRoot(host); // afterEach unmounts again
        expect(active.size).toBe(0);
    });

    it('disables the header Save button while the builder reports a save in progress', () => {
        openBuilder();
        expect(saveButton().disabled).toBe(false);

        click('start-save');
        expect(saveButton().disabled).toBe(true);

        click('end-save');
        expect(saveButton().disabled).toBe(false);
    });
});
