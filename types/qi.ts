import { AttachedDocument } from "./attacheddocument";


export enum QiSummaryType {
    CONVERSATION = 'Conversation',
  }

export interface QiSummary {
    type: QiSummaryType;
    summary:string;
    purpose:string;
    includeUser:boolean;
    additionalComments?:string;
    numberOfDataSources?:number;
    dataSources?:AttachedDocument[];
    
}