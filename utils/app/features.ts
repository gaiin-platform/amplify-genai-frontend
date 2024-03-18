import {Features} from "@/types/features";

export const saveFeatures = (features: Features) => {
    localStorage.setItem('features', JSON.stringify(features));
};
