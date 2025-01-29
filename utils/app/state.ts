

export function deepMerge(target: Record<string, any>, ...sources: Record<string, any>[]): Record<string, any> {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key] as Record<string, any>, source[key]);
            } else if (Array.isArray(source[key])) {
                if (!Array.isArray(target[key])) target[key] = [];
                mergeUniqueArrays(target[key], source[key]);
                // target[key] = target[key].concat(source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}

export function isObject(item: any): item is Record<string, any> {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

function mergeUniqueArrays(targetArray: any[], sourceArray: any[]) {
    for (const sourceItem of sourceArray) {
        if (!targetArray.some(targetItem => JSON.stringify(targetItem) === JSON.stringify(sourceItem) )) {
            targetArray.push(sourceItem);
        }
    }
}
