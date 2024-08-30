export interface FolderInterface {
  id: string;
  date?: string;
  name: string;
  type: FolderType;
  isGroupFolder?: boolean;
}

export type FolderType = 'chat' | 'prompt' | 'workflow';

export type SortType = 'date' | 'name';