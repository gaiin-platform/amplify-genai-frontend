/**
 * RatingStars — five stars plus the number, for user/system ratings in the group insights views.
 * Filled stars use the accent; empty ones the subtle border colour. A missing rating reads "No rating"
 * rather than five empty stars, which would look like a real zero.
 */

import React from 'react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { filledStars, formatDecimal, normalizeRating } from './groupInsightsModel';

export interface RatingStarsProps {
    value: unknown;
    /** Show the numeric value after the stars. Default true. */
    showValue?: boolean;
    size?: number;
}

export const RatingStars: React.FC<RatingStarsProps> = ({ value, showValue = true, size = 14 }) => {
    const rating = normalizeRating(value);
    if (rating === null) {
        return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No rating</span>;
    }
    const filled = filledStars(rating);
    return (
        <span
            role="img"
            aria-label={`Rated ${formatDecimal(rating, 1)} out of 5`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
        >
            {[1, 2, 3, 4, 5].map((star) =>
                star <= filled ? (
                    <IconStarFilled key={star} size={size} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                ) : (
                    <IconStar key={star} size={size} aria-hidden="true" style={{ color: 'var(--border-subtle)' }} />
                ),
            )}
            {showValue && (
                <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatDecimal(rating, 1)}
                </span>
            )}
        </span>
    );
};
