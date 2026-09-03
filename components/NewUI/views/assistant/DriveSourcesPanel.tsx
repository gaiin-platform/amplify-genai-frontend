/**
 * DriveSourcesPanel — new-UI shell around AssistantDriveDataSources (OneDrive /
 * SharePoint file selection) in the assistant editor.
 *
 * That component is old-UI and off-limits (components/Promptbar/**), and it is a
 * deep stack — ExpansionComponent + IntegrationTabs + a MantineReactTable file
 * browser — so it is wrapped rather than rebuilt. Two jobs:
 *
 *  1. Auto-open its accordion. AssistantDriveDataSources renders its content inside
 *     an ExpansionComponent that defaults to collapsed and takes no "open" prop, so
 *     picking "OneDrive / SharePoint" used to reveal nothing but a second thing to
 *     click. A MutationObserver waits for the toggle to mount (integrations load
 *     async) and clicks it once.
 *
 *  2. Provide the [data-new-ui-drive] scope that conversation-view.css uses to
 *     restyle the old chrome with design tokens.
 *
 * `data-drive-expanded` is only set once the accordion's content is actually in the
 * DOM, and the CSS that hides the redundant toggle is scoped to that attribute — if
 * the auto-open ever fails, the toggle stays visible and the panel is still usable.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

/** id ExpansionComponent puts on its toggle. Shared across many old components — */
/** always query it from inside this wrapper, never from document. */
const EXPANDER_ID = 'expandComponent';

export interface DriveSourcesPanelProps {
    children: React.ReactNode;
}

export const DriveSourcesPanel: React.FC<DriveSourcesPanelProps> = ({ children }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const autoOpenedRef = useRef(false);
    const [expanded, setExpanded] = useState(false);

    /** ExpansionComponent renders the content as the toggle's next sibling. */
    const syncExpansion = useCallback(() => {
        const root = rootRef.current;
        if (!root) return;
        const toggle = root.querySelector<HTMLButtonElement>(`#${EXPANDER_ID}`);
        if (!toggle) return;

        const isOpen = Boolean(toggle.nextElementSibling);
        if (isOpen) {
            setExpanded(true);
            return;
        }
        if (!autoOpenedRef.current) {
            autoOpenedRef.current = true;
            toggle.click();
        }
    }, []);

    useEffect(() => {
        syncExpansion();
        const root = rootRef.current;
        if (!root) return;
        // The toggle appears only after the integrations request resolves, and the
        // content appears a render later — watch until both have happened.
        const observer = new MutationObserver(syncExpansion);
        observer.observe(root, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [syncExpansion]);

    return (
        <div
            ref={rootRef}
            data-new-ui-drive="true"
            data-drive-expanded={expanded ? 'true' : 'false'}
            // Old components inherit text colour; without this they are invisible
            // on light surfaces (NEW_UI_GUIDE standing rule 7).
            className="text-neutral-900 dark:text-white"
            style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 12,
                background: 'var(--bg-app)',
            }}
        >
            {children}
        </div>
    );
};

export default DriveSourcesPanel;
