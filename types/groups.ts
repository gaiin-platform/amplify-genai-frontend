import { AttachedDocument } from "@/types/attacheddocument";
import { Prompt } from "@/types/prompt";
////////////// Ast Admin Groups /////////////////

export enum GroupUpdateType {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
  UPDATE = 'UPDATE' 
}

export enum GroupAccessType {
    ADMIN = 'admin',
    WRITE = 'write',
    READ = 'read' 
}

interface GroupTypeData {
  additionalInstructions: string;
  dataSources: AttachedDocument[];
  documentState: { [key: string]: number };
  isDisabled: boolean;
  disabledMessage: string;
}


// Define the GroupTypes interface using the GroupEntry type
export interface AstGroupTypeData {
  [key: string]: GroupTypeData;
}

export interface Members { 
  [key: string]: GroupAccessType;
}

export interface Group {
  id: string;
  name: string;
  members: Members;
  assistants: Prompt[];
  groupTypes: string[];
  trackCoversations?: boolean;
  supportConvAnalysis?: boolean;
  amplifyGroups: string[];
  systemUsers: string[];
}

