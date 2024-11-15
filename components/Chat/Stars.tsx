import React, {FC, useState} from 'react';
import {IconStar, IconStarFilled} from '@tabler/icons-react';
import styled from "styled-components";

const Star = styled(IconStar)`
  height: 15px;
  width: 15px;
`;

const FilledStar = styled(IconStarFilled)`
  height: 15px;
  width: 15px;
`;

interface Props {
    starRating: number;
    setStars: (rating: number) => void;
}

export const Stars: FC<Props> = ({ starRating, setStars }) => {
    const stars = [1, 2, 3, 4, 5];

    const [currentStars, setCurrentStars] = useState<number>(starRating);

    const handleStarClick = (selectedRating: number) => {
        setCurrentStars(selectedRating);
        setStars(selectedRating);
    };

    return (
        <div className="flex items-center invisible group-hover:visible focus:visible mt-4">
            Rating:
            {stars.map((star) => (
                <button
                    key={star}
                    className={`mx-1`}
                    style={{ fontSize: '0.6rem' }}
                    onClick={() => {
                        setCurrentStars(star);
                        handleStarClick(star)
                    }}
                    title="Rate Response"
                >
                    {star <= currentStars ? <FilledStar/> : <Star/>}
                </button>
            ))}
        </div>
    );
};