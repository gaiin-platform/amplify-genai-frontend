export interface FolderInterface {
  id: string;
  date?: string;
  name: string;
  type: FolderType;
}

export type FolderType = 'chat' | 'prompt' | 'workflow';

export type SortType = 'date' | 'name';