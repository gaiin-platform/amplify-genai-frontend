import { jsonrepair } from 'jsonrepair'
import toast from 'react-hot-toast';
import { promptForData } from './llm';
import { Message, MessageType, newMessage } from '@/types/chat';
import { Model } from '@/types/model';
import { Account } from '@/types/accounts';


const REPAIR_JSON_PROMPT = ``;
                                // shown only if jsonrepair fails, then it takes a second to get an answer back from chatjs
export const fixJsonString = async (model: Model, chatEndpoint:string, statsService: any, brokenJson: string, defaultAccount?: Account, messageToUser?:string) => {
        // error handling 
    console.log("Attempting to fix json");
    let repaired: string | null = repairJson(brokenJson);
    if (!repaired) {
        console.log("Attempting to fix with llm")
        if (messageToUser) toast(messageToUser);
        const messages:Message[] =  [newMessage({role: "user", content: `${brokenJson}`, type: MessageType.PROMPT})];
        const result = await promptForData(chatEndpoint, messages, model, REPAIR_JSON_PROMPT, defaultAccount, statsService);

        if (!result) return null;
        // ensure it is valid
        repaired = repairJson(result)
    } 
    // console.log("resturned: ", repaired);
    return repaired
}


const repairJson = (content: string) => {
    try {
        const repaired = jsonrepair(content);
        JSON.parse(repaired);
        console.log("jsonrepair successfully repaired the broken json");
        return repaired;
    } catch (err) {
        console.log(err);
        return null;
    }
}