import { LucideEyeOff, LucideFileText, LucideLightbulb } from './LucideIcons';

type Mode = 'off' | 'insights' | 'full';

interface Props<TMode extends Mode> {
    mode: TMode;
    // Sources can cycle through 'insights'; notes (no insights concept)
    // never do — leave false for notes.
    hasInsights?: boolean;
    onChange: (mode: TMode) => void;
    className?: string;
}

const MODE_CONFIG = {
    off: {
        Icon: LucideEyeOff,
        label: 'Not included',
        color: 'text-gray-400 dark:text-gray-500',
        hover: 'hover:bg-gray-100 dark:hover:bg-neutral-700',
    },
    insights: {
        Icon: LucideLightbulb,
        label: 'Insights only',
        color: 'text-amber-600 dark:text-amber-400',
        hover: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
    },
    full: {
        Icon: LucideFileText,
        label: 'Full content',
        color: 'text-purple-600 dark:text-purple-400',
        hover: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
    },
} as const;

// Single icon that cycles through context modes on click — off → (insights
// →) full → off. Ported from open-notebook's ContextToggle: one compact
// control per card instead of a row of labeled buttons.
export function ContextToggle<TMode extends Mode>({
    mode,
    hasInsights = false,
    onChange,
    className = '',
}: Props<TMode>) {
    const { Icon, label, color, hover } = MODE_CONFIG[mode];
    const availableModes = (hasInsights ? ['off', 'insights', 'full'] : ['off', 'full']) as TMode[];

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const i = availableModes.indexOf(mode);
        onChange(availableModes[(i + 1) % availableModes.length]);
    };

    return (
        <button
            onClick={handleClick}
            title={`${label} — click to cycle`}
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-md transition-colors ${hover} ${className}`}
        >
            <Icon size={16} className={color} />
        </button>
    );
}

export default ContextToggle;
