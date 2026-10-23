/**
 * SignInRequiredNote — the one-line reminder under every field where a user
 * types another person's email to share with, grant access to, or delegate to.
 *
 * The backend validates recipients against the Amplify user table
 * (`are_valid_amplify_users`), and that table is only populated when someone
 * signs in. A teammate who has never signed in is rejected for an API-key
 * delegate, and silently dropped from a share (the share still reports success
 * if anyone else on the list was valid). Say so where the address is typed.
 *
 * `EmailChipsInput` is deliberately NOT where this renders: each host already
 * has its own hint line and spacing, so the host places the note.
 *
 * Location: components/NewUI/shared/SignInRequiredNote.tsx
 */

import React from 'react';

export type SignInRequiredAction = 'share' | 'access' | 'delegate' | 'add';

export const SIGN_IN_REQUIRED_COPY: Record<SignInRequiredAction, string> = {
    share: 'Recipients must have signed in to Amplify at least once, or the share won’t reach them.',
    access: 'People must have signed in to Amplify at least once to be given access.',
    delegate: 'Your delegate must have signed in to Amplify at least once, or the key can’t be delegated to them.',
    add: 'People must have signed in to Amplify at least once to be added.',
};

interface SignInRequiredNoteProps {
    action: SignInRequiredAction;
    /** 12 for roomy forms; 11 in the assistant modal's compact panels. */
    fontSize?: number;
}

export const SignInRequiredNote: React.FC<SignInRequiredNoteProps> = ({
    action,
    fontSize = 12,
}) => (
    <p
        style={{
            margin: '6px 0 0',
            fontSize,
            lineHeight: 1.4,
            color: 'var(--text-muted)',
        }}
    >
        {SIGN_IN_REQUIRED_COPY[action]}
    </p>
);

export default SignInRequiredNote;
