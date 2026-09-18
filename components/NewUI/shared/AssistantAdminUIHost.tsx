/**
 * AssistantAdminUIHost — mounts the AssistantAdminUI modal at the new-UI root
 * so that gear-icon clicks in GroupAssistantsTab actually open the admin interface.
 *
 * WHY THIS EXISTS
 * ---------------
 * `openAstAdminInterfaceTrigger` is dispatched by GroupAssistantsTab (and other
 * callers) to open the assistant admin modal.  Its only listener lives in
 * `components/Layout/UserMenu.tsx`, which is rendered only in the classic-UI branch
 * of `home.tsx`.  In the new UI the event fires into the void.
 *
 * This host provides the missing listener for the new-UI branch, following the
 * same pattern as `LayeredBuilderHost` and `PromptTemplateDialogHost`.
 *
 * AssistantAdminUI closes itself by dispatching the same event with isOpen:false,
 * so the host just toggles its own open state in response — no extra close handler
 * needed.
 */

import React, { useContext, useEffect, useRef, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { AssistantAdminUI } from '@/components/Admin/AssistantAdminUI';
import { Group } from '@/types/groups';
import { Prompt } from '@/types/prompt';
import { LayeredAssistant } from '@/types/layeredAssistant';

interface AstAdminEventData {
    group?: Group;
    assistant?: Prompt;
    layeredAssistant?: LayeredAssistant;
    tabToOpen?: string;
}

export const AssistantAdminUIHost: React.FC = () => {
    const { state: { featureFlags } } = useContext(HomeContext);

    // Keep featureFlags in a ref so the stable event handler always sees the
    // latest value without needing to be re-registered.
    const featureFlagsRef = useRef(featureFlags);
    useEffect(() => { featureFlagsRef.current = featureFlags; }, [featureFlags]);

    const [showAdmin, setShowAdmin] = useState(false);
    const [modalData, setModalData] = useState<AstAdminEventData | undefined>(undefined);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (!featureFlagsRef.current.assistantAdminInterface) return;
            if (detail.isOpen) {
                setModalData({
                    ...detail.data,
                    tabToOpen: detail.data?.tabToOpen,
                });
                setShowAdmin(true);
            } else {
                setShowAdmin(false);
                setModalData(undefined);
            }
        };

        window.addEventListener('openAstAdminInterfaceTrigger', handler);
        return () => window.removeEventListener('openAstAdminInterfaceTrigger', handler);
    }, []);

    if (!showAdmin || !featureFlags.assistantAdminInterface) return null;

    return (
        <div className="text-neutral-900 dark:text-white">
            <AssistantAdminUI
                open={showAdmin}
                openToGroup={modalData?.group}
                openToAssistant={modalData?.assistant}
                openToLayeredAssistant={modalData?.layeredAssistant}
                tabToOpen={modalData?.tabToOpen}
            />
        </div>
    );
};

export default AssistantAdminUIHost;
