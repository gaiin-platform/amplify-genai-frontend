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

export const LucideFileText: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10 9H8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
    </Svg>
);

export const LucideLink: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
);

export const LucideUpload: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M12 3v12" />
        <path d="m17 8-5-5-5 5" />
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </Svg>
);

export const LucideAlignLeft: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M15 12H3" />
        <path d="M17 18H3" />
        <path d="M21 6H3" />
    </Svg>
);

export const LucideTrash2: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" x2="10" y1="11" y2="17" />
        <line x1="14" x2="14" y1="11" y2="17" />
    </Svg>
);

export const LucideArrowUp: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m5 12 7-7 7 7" />
        <path d="M12 19V5" />
    </Svg>
);

export const LucideArrowDown: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
    </Svg>
);

export const LucideArrowUpDown: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m21 16-4 4-4-4" />
        <path d="M17 20V4" />
        <path d="m3 8 4-4 4 4" />
        <path d="M7 4v16" />
    </Svg>
);

export const LucideExternalLink: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Svg>
);

export const LucideDownload: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M12 15V3" />
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5" />
    </Svg>
);

export const LucideCopy: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Svg>
);

export const LucideCheck: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M20 6 9 17l-5-5" />
    </Svg>
);

export const LucideCheckCircle: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M21.801 10A10 10 0 1 1 17 3.335" />
        <path d="m9 11 3 3L22 4" />
    </Svg>
);

export const LucideYoutube: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <path d="m10 15 5-3-5-3z" />
    </Svg>
);

export const LucideMoreVertical: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
    </Svg>
);

export const LucideSparkles: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
        <path d="M4 17v2" />
        <path d="M5 18H3" />
    </Svg>
);

export const LucidePlus: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </Svg>
);

export const LucideLightbulb: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
    </Svg>
);

export const LucideDatabase: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5V19A9 3 0 0 0 21 19V5" />
        <path d="M3 12A9 3 0 0 0 21 12" />
    </Svg>
);

export const LucideAlertCircle: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
    </Svg>
);

export const LucideUser: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </Svg>
);

export const LucideSend: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
        <path d="m21.854 2.147-10.94 10.939" />
    </Svg>
);

// Consumers add the `animate-spin` class themselves (matches lucide's Loader2
// usage in the reference UI).
export const LucideLoader2: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Svg>
);

export const LucideClock: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M12 6v6l4 2" />
        <circle cx="12" cy="12" r="10" />
    </Svg>
);

export const LucideMessageSquare: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
);

export const LucideBookOpen: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Svg>
);

export const LucidePencil: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
        <path d="m15 5 4 4" />
    </Svg>
);

export const LucideX: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </Svg>
);

export const LucideMic: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M12 19v3" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <rect x="9" y="2" width="6" height="13" rx="3" />
    </Svg>
);

export const LucideSettings: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </Svg>
);

export const LucideMenu: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <path d="M4 6h16" />
    </Svg>
);

export const LucideChevronLeft: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m15 18-6-6 6-6" />
    </Svg>
);

export const LucideArrowLeft: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
    </Svg>
);

export const LucideMoreHorizontal: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
    </Svg>
);

export const LucideArchive: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <rect width="20" height="5" x="2" y="3" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
    </Svg>
);

export const LucideArchiveRestore: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <rect width="20" height="5" x="2" y="3" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h2" />
        <path d="M20 8v11a2 2 0 0 1-2 2h-2" />
        <path d="m9 15 3-3 3 3" />
        <path d="M12 12v9" />
    </Svg>
);

export const LucideStickyNote: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
        <path d="M15 3v4a2 2 0 0 0 2 2h4" />
    </Svg>
);

export const LucideRefreshCw: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
    </Svg>
);

export const LucideLayoutGrid: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
    </Svg>
);

export const LucideList: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
        <path d="M3 6h.01" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M8 6h13" />
    </Svg>
);

export const LucideChevronDown: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m6 9 6 6 6-6" />
    </Svg>
);

export const LucideChevronRight: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m9 18 6-6-6-6" />
    </Svg>
);

export const LucideListChecks: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m3 17 2 2 4-4" />
        <path d="m3 7 2 2 4-4" />
        <path d="M13 6h8" />
        <path d="M13 12h8" />
        <path d="M13 18h8" />
    </Svg>
);

export const LucideLink2: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M9 17H7A5 5 0 0 1 7 7h2" />
        <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
        <line x1="8" x2="16" y1="12" y2="12" />
    </Svg>
);

export const LucideUnlink: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" />
        <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" />
        <line x1="8" x2="8" y1="2" y2="5" />
        <line x1="2" x2="5" y1="8" y2="8" />
        <line x1="16" x2="16" y1="19" y2="22" />
        <line x1="19" x2="22" y1="16" y2="16" />
    </Svg>
);

export const LucideAlertTriangle: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
    </Svg>
);

export const LucideMessageCircleQuestion: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
    </Svg>
);

export const LucideEyeOff: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
        <path d="m2 2 20 20" />
    </Svg>
);

export const LucideSave: React.FC<IconProps> = (p) => (
    <Svg {...p}>
        <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
        <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </Svg>
);
