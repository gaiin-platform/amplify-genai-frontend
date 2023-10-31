import React, {FC, useState} from 'react';

interface Props {
    starRating: number;
    setStars: (rating: number) => void;
}

export const Stars: FC<Props> = ({ starRating, setStars }) => {
    const stars = [1, 2, 3, 4, 5];

    const [currentStars, setCurrentStars] = useState<number>(starRating);

    const handleStarClick = (selectedRating: number) => {
        setStars(selectedRating);
    };

    return (
        <div className="flex items-center invisible group-hover:visible focus:visible mt-4">
            Rating:
            {stars.map((star) => (
                <button
                    key={star}
                    className={`mx-1 ${star <= currentStars ? 'text-gray-300' : 'text-gray-800'}`}
                    onClick={() => {
                        setCurrentStars(star);
                        handleStarClick(star)
                    }}
                >
                    &#9733;
                </button>
            ))}
        </div>
    );
};