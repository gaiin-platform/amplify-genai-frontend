import { FC, ReactNode, useRef, useEffect } from 'react';

export interface MasonryProps {
    children: ReactNode[];
    cardWidth?: number;
    gap?: number;
    className?: string;
    animate?: boolean;
}

/**
 * JavaScript-based Masonry layout with proper resize handling
 * Based on the awesome GroupAssistantsGallery masonry logic
 */
export const Masonry: FC<MasonryProps> = ({
    children,
    cardWidth = 280,
    gap = 20,
    className = '',
    animate = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
    const cardColumnMap = useRef<Map<number, number>>(new Map());
    const hasAnimatedRef = useRef(false);

    // 🧮 THE MATH MAGIC - Calculate masonry positions with transforms!
    useEffect(() => {
        const calculateMasonryPositions = () => {
            if (!containerRef.current || cardsRef.current.length === 0) return;

            const cards = cardsRef.current.filter(card => card !== null) as HTMLDivElement[];
            if (cards.length === 0) return;

            // Get container width to calculate columns
            const containerWidth = containerRef.current.offsetWidth;

            // Calculate how many columns we can fit
            const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
            // Track the bottom position of each column
            const columnBottoms = new Array(columns).fill(0);
            const columnLefts = Array.from({ length: columns }, (_, i) => i * (cardWidth + gap));

            // For each card, place it in its LOCKED column (or assign one on first run)
            cards.forEach((card, index) => {
                // Get locked column, or assign to shortest column on first run
                let assignedColumn = cardColumnMap.current.get(index);
                if (assignedColumn === undefined) {
                    // First time seeing this card - assign to shortest column
                    assignedColumn = columnBottoms.indexOf(Math.min(...columnBottoms));
                    cardColumnMap.current.set(index, assignedColumn);
                }

                // Calculate position using the LOCKED column
                const targetLeft = columnLefts[assignedColumn];
                const targetTop = columnBottoms[assignedColumn];

                // Apply absolute positioning
                card.style.position = 'absolute';
                card.style.top = `${targetTop}px`;
                card.style.width = `${cardWidth}px`;

                // Only animate on FIRST load if animate is enabled
                if (animate && !hasAnimatedRef.current) {
                    // Start off-screen to the LEFT, then swoop in
                    card.style.left = `${targetLeft - 100}px`;
                    card.style.opacity = '0';

                    // Trigger animation with slight delay for stagger effect
                    setTimeout(() => {
                        card.style.left = `${targetLeft}px`;
                        card.style.opacity = '1';
                    }, index * 50); // Stagger by 50ms per card
                } else {
                    // Already animated or animation disabled, just position immediately
                    card.style.left = `${targetLeft}px`;
                    card.style.opacity = '1';
                }

                // Update this column's bottom position
                columnBottoms[assignedColumn] = targetTop + card.offsetHeight + gap;
            });

            // Set container height to tallest column
            const maxHeight = Math.max(...columnBottoms);
            containerRef.current.style.height = `${maxHeight}px`;

            // Mark that we've done the initial animation
            hasAnimatedRef.current = true;
        };

        // Run after layout
        const timer = setTimeout(calculateMasonryPositions, 100);

        // Recalculate on window resize
        const handleResize = () => {
            calculateMasonryPositions();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, [children, cardWidth, gap, animate]);

    return (
        <div
            ref={containerRef}
            className={`relative ${className}`}
            style={{
                position: 'relative',
                width: '100%',
            }}
        >
            {children.map((child, index) => (
                <div
                    key={index}
                    ref={(el) => (cardsRef.current[index] = el)}
                    style={{
                        transition: animate && !hasAnimatedRef.current ? 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'all 0.3s ease',
                    }}
                >
                    {child}
                </div>
            ))}
        </div>
    );
};
