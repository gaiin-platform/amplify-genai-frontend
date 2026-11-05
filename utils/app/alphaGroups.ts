/** The letter a name is filed under in an A–Z list: accents dropped ("Émile" → E), anything not a letter → "#". */
export const alphaGroupKey = (name: string): string => {
    const first = (name ?? '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
    return /^[A-Z]$/.test(first) ? first : '#';
};
