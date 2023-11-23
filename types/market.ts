
export enum MarketItemType {
    ASSISTANT = 'assistant',
    PROMPT = 'prompt',
    AUTOMATION = 'automation',
    ROOT = 'root',
    COLLECTION = 'collection',
}

export interface MarketCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    tags: string[];
    image: string;
    categories?: MarketCategory[];
    items?: MarketItem[];
}

export interface MarketItem {
    id: string;
    name: string;
    description: string;
    author: string;
    lastUpdated: string;
    created: string;
    tags: string[];
    category: string;
    sourceUrl: string;
    type: string;
    image?: string;
}