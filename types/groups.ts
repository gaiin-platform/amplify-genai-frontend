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
}



////////// Cognito Table Groups /////////////


// used for checking if a user is in specific amplify or cognito groups in the cognito users table 
// by calling fetchInCognitoGroup(amplifyGroups, congnitoGroups)


export enum AmplifyGroups {
  AST_ADMIN_INTERFACE= 'Ast_Admin_Interface',
  API = 'Amplify_Dev_Api'
}

export enum CognitoGroups {
}

export interface AmpCognGroups {
    amplifyGroups? : string[];
    cognitoGroups? : string[];

}
