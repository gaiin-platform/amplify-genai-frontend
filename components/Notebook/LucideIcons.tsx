import React from 'react';

interface IconProps {
    size?: number;
    className?: string;
}

const Svg: React.FC<React.PropsWithChildren<IconProps>> = ({ size = 24, className, children }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {children}
    </svg>
);

export const LucideBook: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </Svg>
);

export const LucideBot: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
    </Svg>
);

export const LucideShuffle: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m18 14 4 4-4 4" />
        <path d="m18 2 4 4-4 4" />
        <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
        <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
        <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
    </Svg>
);

export const LucideWrench: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
);

export const LucideSearch: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m21 21-4.34-4.34" />
        <circle cx="11" cy="11" r="8" />
    </Svg>
);
