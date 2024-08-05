import { noRateLimit, RateLimit } from "./rateLimit";

export interface Account {
    id: string;
    name: string;
    isDefault?: boolean;
    rateLimit: RateLimit;

}

export const noCoaAccount: Account = { id: 'general_account', name: 'No COA On File' , rateLimit: noRateLimit};