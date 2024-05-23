import { AttachedDocument } from "./attacheddocument";


export enum QiSummaryType {
    CONVERSATION = 'conversation',
  }

export interface QiSummary {
    type: QiSummaryType;
    summary:string;
    purpose:string;
    additionalComments?:string;
    numberOfDataSources?:number;
}