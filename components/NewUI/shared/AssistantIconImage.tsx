/**
 * AssistantIconImage — an assistant's uploaded icon, or `fallback` while it loads and whenever it
 * can't be shown (no icon, no access to the file, deleted, not decodable).
 *
 * Fills its box (`object-fit: cover`); the parent sets the size and clipping radius. The fallback is
 * what the surface showed before icons existed, so a failure looks exactly like "no icon was set".
 */

import React, { useEffect, useState } from 'react';
import type { AssistantIconRef } from '@/components/NewUI/views/assistant/assistantIconModel';
import { loadAssistantIconUrl } from './assistantIconLoader';

export interface AssistantIconImageProps {
    icon: AssistantIconRef | undefined;
    fallback: React.ReactNode;
    /** Accessible name; the default treats the image as decoration next to the assistant's name. */
    alt?: string;
    radius?: number | string;
}

export const AssistantIconImage: React.FC<AssistantIconImageProps> = ({ icon, fallback, alt = '', radius = 8 }) => {
    const key = icon ? `${icon.groupId ?? ''}::${icon.key}` : '';
    const [state, setState] = useState<{ key: string; url: string | null }>({ key: '', url: null });

    useEffect(() => {
        if (!icon) return;
        let current = true;
        loadAssistantIconUrl(icon).then((url) => {
            if (current) setState({ key, url });
        });
        return () => { current = false; };
        // `key` identifies the icon; the object itself is rebuilt on every render of the caller.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    // A url that belongs to a previous icon must never be shown for the current one.
    const url = state.key === key ? state.url : null;
    if (!icon || !url) return <>{fallback}</>;

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={url}
            alt={alt}
            draggable={false}
            onError={() => setState({ key, url: null })}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius, display: 'block' }}
        />
    );
};
