import { Account } from "./accounts";
import { RateLimit } from "./rateLimit";

export interface ApiKey {
    api_owner_id: string;
    owner: string, 
    delegate:  string, 
    applicationName: string;
    applicationDescription: string;
    account: Account;
    rateLimit: RateLimit
    active: boolean;
    expirationDate: string | null;
    accessTypes: string[];
    systemId: string;
    lastAccessed: string;
}


export interface ApiKeyList {
    keyOwner: ApiKey[], 
    keyDelegate: ApiKey[]
}