

export interface AttachedDocumentMetadata {
    totalTokens: number;
    [key:string]:any;
}

export interface AttachedDocument {
    id:string;
    name:string;
    raw:any|null;
    type:string;
    data:any|null;
    /** Original browser File size, retained after upload processing clears raw. */
    size?: number;
    key?:string;
    metadata?:AttachedDocumentMetadata;
    groupId?:string;
}
