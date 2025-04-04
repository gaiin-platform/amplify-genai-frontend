export type MemoryType = 'user';

export interface BaseFact {
    content: string;
    taxonomy_path: string;
    reasoning?: string;
    conversation_id: string;
}

export interface ExtractedFact extends BaseFact {
    content: string;
    taxonomy_path: string;
    reasoning: string;
    conversation_id: string;
}

export interface MemoryItem {
    content: string;
    taxonomy_path: string;
    memory_type?: MemoryType;
    memory_type_id?: string;
    conversation_id?: string;
}

export interface Memory {
    id: string;
    content: string;
    user: string;
    timestamp: string;
    memory_type: MemoryType;
    memory_type_id: string;
    taxonomy_path: string;
    conversation_id?: string;
}

export interface MemoryTreeViewProps {
    memories: Memory[];
    onEditMemory?: (memory: Memory) => void;
    onDeleteMemory?: (id: string) => void;
    onViewConversation?: (conversationId: string) => void;
    processingMemoryId?: string | null;
}

export interface MemoryTreeNode {
    name: string;
    type: 'category' | 'subcategory' | 'memory';
    children?: MemoryTreeNode[];
    content?: string;
    id?: string;
    timestamp?: string;
    isExpanded?: boolean;
    conversation_id?: string;  // Added this field
}

// Response types for memory operations
export interface MemoryOperationResponse {
    statusCode: number;
    body: string;
}

export interface SaveMemoryResponse extends MemoryOperationResponse {
    body: string; // JSON string containing { message: string, id: string }
}

export interface ReadMemoryResponse extends MemoryOperationResponse {
    body: string; // JSON string containing { memories: Memory[] }
}

export interface ExtractFactsResponse extends MemoryOperationResponse {
    body: string; // JSON string containing { facts: ExtractedFact[] }
}

// Loading states for UI
export interface LoadingStates {
    [key: number]: 'saving' | 'deleting' | 'loading';
}

// Component Props
export interface MemoryDialogProps {
    open: boolean;
    onClose: () => void;
}

export interface MemoryTreeViewProps {
    memories: Memory[];
    onEditMemory?: (memory: Memory) => void;
    onDeleteMemory?: (memoryId: string) => void;
    processingMemoryId?: string | null;
}

export interface MemoryPresenterProps {
    isFactsVisible: boolean;
    setIsFactsVisible: (isVisible: boolean) => void;
}

// Taxonomy structure
export const TAXONOMY_STRUCTURE = {
    Identity: ['Role', 'Department', 'Area_of_Study', 'Preferences'],
    Projects: ['Name', 'Type', 'Status', 'Timeline', 'Requirements', 'Resources', 'Collaborators'],
    Academic_Content: ['Research', 'Teaching_Materials', 'Publications', 'Presentations', 'Data_Analysis', 'Code', 'Visual_Assets'],
    Relationships: ['Collaborators', 'Advisors_Advisees', 'Teams', 'Committees'],
    Time_Sensitive: ['Deadlines', 'Meetings', 'Events', 'Academic_Calendar'],
    Resources: ['Tools', 'Datasets', 'References', 'Documentation', 'Templates'],
    Knowledge: ['Subject_Matter', 'Methods', 'Procedures', 'Best_Practices', 'Institutional_Policies']
} as const;

export type TaxonomyCategory = keyof typeof TAXONOMY_STRUCTURE;
export type TaxonomySubcategory<T extends TaxonomyCategory> = typeof TAXONOMY_STRUCTURE[T][number];