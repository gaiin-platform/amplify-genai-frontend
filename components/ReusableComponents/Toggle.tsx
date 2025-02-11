import { FC } from 'react';

interface ToggleProps {
    label?: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    size?: 'small' | 'medium' | 'large';
}

export const Toggle: FC<ToggleProps> = ({
    label,
    enabled,
    onChange,
    size = 'medium'
}) => {
    const sizes = {
        small: { toggle: 'w-8 h-4', circle: 'h-3 w-3' },
        medium: { toggle: 'w-11 h-6', circle: 'h-5 w-5' },
        large: { toggle: 'w-14 h-7', circle: 'h-6 w-6' }
    };

    return (
        <div className="flex items-center">
            {label && (
                <span className="mr-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                    {label}
                </span>
            )}
            <button
                type="button"
                className={`
          ${sizes[size].toggle}
          ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
          relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 
          focus:ring-blue-500 focus:ring-offset-2
        `}
                role="switch"
                aria-checked={enabled}
                onClick={() => onChange(!enabled)}
            >
                <span
                    className={`
            ${sizes[size].circle}
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
            pointer-events-none inline-block transform rounded-full bg-white shadow 
            ring-0 transition duration-200 ease-in-out
          `}
                />
            </button>
        </div>
    );
};