import { useContext } from 'react';
import HomeContext from '@/pages/api/home/home.context';

// Admin-managed feature flag controlling whether a user may pick a chat model
// in the notebook (chat panels + the Ask tab) instead of just running on the
// deployment default.
//
// Flags are dynamic in Amplify — an admin creates this one by name under
// Admin -> Feature Flags and grants it to specific users/groups. Absent flag
// reads as `undefined` => falsy => nobody gets a picker, which is the intended
// default: everyone runs on the allowlisted model and simply sees which model
// answered.
//
// NOTE: this only controls what the UI *offers*. The fork enforces its own
// allowlist server-side (open-notebook `open_notebook/ai/model_policy.py`,
// checked by the chat, source-chat and ask/search routers), and that check has
// no notion of Amplify feature flags — so a model offered here but rejected
// there still comes back 403. Relaxing the UI and the server policy has to be
// done together.
export const NOTEBOOK_MODEL_SELECT_FLAG = 'notebookModelSelect';

export const useCanSelectNotebookModel = (): boolean => {
    const {
        state: { featureFlags },
    } = useContext(HomeContext);
    return !!featureFlags?.[NOTEBOOK_MODEL_SELECT_FLAG];
};
