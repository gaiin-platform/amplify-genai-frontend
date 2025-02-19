export interface Artifact {
    artifactId: string; // multiple artifacts can have the same id, its the version that separate them
    version: number;
    name: string;
    type: string;
    description: string;
    contents: number[]; // will be encoded
    tags: string[];
    createdAt: string;
    metadata?: {[key: string]: any};
}

//used for artifact block 
export interface ArtifactBlockDetail {
    artifactId: string;
    name: string;
    createdAt: string;
    description: string;
    version?: number;
}

// contents would be a list of ArtifactSegments 
export interface ArtifactSegments {
    content: number[]
    description: string;
}

export const validArtifactTypes: string[] = [
    'static', 'vanilla' , 'react' , 'vue' , 'node' , 'next' , 'angular', 
    'text' , 'json' , 'csv' , 'react' , 'svg' , 'code' , ''
  ];

// export interface Artifact {
//     id:string;
//     name: string;
//     type: ArtifactType;
//     description: string;
//     numOfSegments: number;
//     contents: number[]; // will be encoded
//     tags: string[];
// }


// conversation 
// id[versions]


export enum ArtifactMessageStatus {
    RUNNING = 'running',
    RETRY = 'retry',
    CANCELLED = 'cancelled',
    STOPPED = 'stopped',
    COMPLETE = 'complete',
  }
  