

export interface Features {
    [key: string]: boolean;
}


export const resolveRagEnabled = (featureFlags: Features, ragOn: boolean) => { 
    return featureFlags.ragEnabled && (featureFlags.cachedDocuments ? ragOn : true)
}