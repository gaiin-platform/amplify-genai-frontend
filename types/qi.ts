import { AttachedDocument } from "./attacheddocument";


export enum QiSummaryType {
    CONVERSATION = 'conversation',
  }

export interface QiSummary {
    type: QiSummaryType;
    summary:string;
    description:string;
    feedbackImprovements:string;
    additionalComments?:string;
    dataSources?:AttachedDocument[];
}