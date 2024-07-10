import { Account } from "./accounts";

export interface ApiKey {
    api_owner_id: string;
    owner: string, 
    delegate:  string, 
    applicationName: string;
    applicationDescription: string;
    account: Account;
    rateLimit: ApiRateLimit
    active: boolean;
    expirationDate: string | null;
    accessTypes: string[];
    systemId: string;
    lastAccessed: string;
}

export interface ApiRateLimit {
    period: string, 
    rate: number | null
}

export interface ApiKeyList {
    keyOwner: ApiKey[], 
    keyDelegate: ApiKey[]
}