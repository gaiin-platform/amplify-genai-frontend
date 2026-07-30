import { useContext, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { codeEdit, codeLive, codePreview } from '@uiw/react-md-editor/commands';
import HomeContext from '@/pages/api/home/home.context';

// The default entry point's code-block preview pulls in rehype-prism-plus,
// which needs refractor@5 — but this repo pins refractor to 3.6.0 (root
// package.json "overrides", predating this component) for react-syntax-
// highlighter's sake, and bumping that pin risks whatever build breakage it
// was added to fix. The /nohighlight entry point drops that dependency chain
// entirely — code blocks in note previews render as plain monospace instead
// of Prism-colored, but everything else (toolbar, live preview, GFM) is the
// same component.
const MDEditor = dynamic(
    () => import('@uiw/react-md-editor/nohighlight').then((mod) => mod.default),
    { ssr: false },
);

// Unlike upstream's wrapper, this doesn't add remark-math/rehype-katex to the
// preview. @uiw/react-markdown-preview bundles its own react-markdown@10 (the
// unified@11 plugin ecosystem), while this repo's remark-math/rehype-katex
// target unified@10 (react-markdown@8, used elsewhere in the app) — the two
// majors changed the transformer calling convention, so mixing plugins across
// that boundary risks silently no-op'ing or throwing at runtime, not just a
// type mismatch. GFM is still on by default here.
//
// Default extraCommands is [codeEdit, codeLive, codePreview, divider,
// fullscreen]. Fullscreen is dropped: it renders via `position: fixed`, and
// our Modal's content box has a `transform` utility class — any transform
// value (even identity) establishes a new containing block for fixed
// descendants per the CSS spec, so fullscreen would clip to the modal
// instead of filling the viewport like it does upstream.
const EXTRA_COMMANDS = [codeEdit, codeLive, codePreview];

interface Props {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    height?: number;
    textareaId?: string;
}

// Ported from open-notebook-vanderbilt's components/ui/markdown-editor.tsx —
// live-preview markdown editor (toolbar + GFM) in place of a plain textarea.
// data-color-mode tracks this app's theme instead of upstream's hardcoded
// "light".
export const MarkdownEditor = ({ value, onChange, placeholder, height = 380, textareaId }: Props) => {
    const {
        state: { lightMode },
    } = useContext(HomeContext);

    // The editor's fixed height (340-380px) was set assuming a tall enough
    // viewport; nested inside a modal's own fixed-height scroll container
    // (#modalScroll), a short/small-window viewport could end up with the
    // editor taller than the space the modal has for it, producing a
    // scrollbar on the editor's own internal textarea/preview AND a second
    // one on the modal's outer scroll container. Shrink to fit whatever's
    // actually available on short viewports instead of a constant value.
    const [effectiveHeight, setEffectiveHeight] = useState(height);
    useEffect(() => {
        const recompute = () => {
            // Leaves ~260px for the rest of the dialog's chrome (title,
            // labels, other fields, footer buttons) above/below the editor —
            // an approximation, not an exact measurement, since the editor
            // doesn't know its sibling content's height.
            const available = window.innerHeight * 0.9 - 260;
            setEffectiveHeight(Math.max(160, Math.min(height, available)));
        };
        recompute();
        window.addEventListener('resize', recompute);
        return () => window.removeEventListener('resize', recompute);
    }, [height]);

    return (
        <div data-color-mode={lightMode}>
            <MDEditor
                value={value}
                onChange={(v) => onChange(v ?? '')}
                height={effectiveHeight}
                preview="live"
                extraCommands={EXTRA_COMMANDS}
                textareaProps={{ placeholder: placeholder || 'Write your note…', id: textareaId }}
            />
        </div>
    );
};

export default MarkdownEditor;
