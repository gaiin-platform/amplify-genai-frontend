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
    'text' , 'json' , 'csv' , 'react' , 'svg' , 'code' , '',
    // New UI first-class types
    'document', 'spreadsheet', 'visualization',
  ];

/** First-class NUI artifact types that drive rendering and download options. */
export type NUIArtifactType = 'document' | 'spreadsheet' | 'code' | 'visualization';

/** Mapping from the declared type string to the NUI rendering type. */
export function resolveNUIType(type: string | undefined): NUIArtifactType {
  if (!type) return 'document';
  switch (type.toLowerCase()) {
    case 'spreadsheet':
    case 'csv':
    case 'tsv':
      return 'spreadsheet';
    case 'code':
    case 'python':
    case 'javascript':
    case 'typescript':
    case 'sql':
    case 'java':
    case 'c':
    case 'cpp':
    case 'c++':
    case 'go':
    case 'rust':
    case 'ruby':
    case 'php':
    case 'swift':
    case 'kotlin':
    case 'scala':
    case 'r':
    case 'bash':
    case 'shell':
    case 'yaml':
    case 'toml':
      return 'code';
    case 'visualization':
    case 'html':
    case 'static':
    case 'svg':
      return 'visualization';
    case 'document':
    case 'text':
    case 'markdown':
    default:
      return 'document';
  }
}

/** Sniff content to determine type when the declared type is absent/empty. */
export function sniffContentType(content: string): NUIArtifactType {
  if (!content || content.length < 4) return 'document';
  const trimmed = content.trimStart();

  // SVG or HTML → visualization
  if (/^<svg[\s>]/i.test(trimmed)) return 'visualization';
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return 'visualization';

  // Consistent delimiter counts → spreadsheet
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 20);
  if (lines.length >= 2) {
    const commaCount = lines.map(l => (l.match(/,/g) || []).length);
    const tabCount   = lines.map(l => (l.match(/\t/g) || []).length);
    const consistent = (counts: number[]) =>
      counts[0] > 0 && counts.slice(1).every(c => Math.abs(c - counts[0]) <= 1);
    if (consistent(commaCount) || consistent(tabCount)) return 'spreadsheet';
  }

  return 'document';
}

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

// Pending artifact attached to input (before sending)
export interface PendingArtifact {
    key: string; // unique key from saved artifacts
    artifactId: string;
    name: string;
    description: string;
    artifact?: Artifact; // populated after loading
    loadingState: 'loading' | 'ready' | 'error';
}
