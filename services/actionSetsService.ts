import { OpBindings } from '@/types/op';
import { createAppDataClient } from './userDataService';

// Constants for ActionSets storage
const APP_ID = 'amplify-action-sets';
const ENTITY_TYPE = 'action-sets';

// Define ActionSet type
export interface ActionItem {
  name: string;
  customName?: string;
  customDescription?: string;
  operation?: any;
  parameters?: OpBindings;
}

export interface ActionSet {
  id?: string;
  name: string;
  tags: string[];
  actions: ActionItem[];
  createdAt?: string;
  updatedAt?: string;
}

// Create a client for the action sets app
const actionSetsClient = createAppDataClient(APP_ID).collection(ENTITY_TYPE);

/**
 * Save an action set
 * 
 * @param actionSet The action set to save
 * @returns The saved action set with generated ID if it's a new set
 */
export const saveActionSet = async (actionSet: ActionSet): Promise<ActionSet> => {
  try {
    const now = new Date().toISOString();
    
    // Create a new action set with a unique ID if it doesn't have one
    const setToSave: ActionSet = {
      ...actionSet,
      id: actionSet.id || `set-${Date.now()}`,
      updatedAt: now,
      createdAt: actionSet.createdAt || now
    };

    if(!setToSave.name || !setToSave.id) {
        alert('Action set must have a name and ID');
        throw new Error('Action set must have a name and ID');
    }

    // Save the action set
    const response = await actionSetsClient.put(setToSave.id, setToSave);
    
    if (response.success) {
      return setToSave;
    } else {
      throw new Error(response.error || 'Failed to save action set');
    }
  } catch (error) {
    console.error('Error saving action set:', error);
    throw error;
  }
};

/**
 * Get an action set by ID
 * 
 * @param id The ID of the action set to retrieve
 * @returns The action set if found
 */
export const getActionSet = async (id: string): Promise<ActionSet | null> => {
  try {
    const response = await actionSetsClient.get(id);
    
    if (response.success && response.data) {
      return response.data as ActionSet;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting action set:', error);
    throw error;
  }
};

/**
 * List all action sets
 * 
 * @param limit Optional limit on the number of action sets to return
 * @returns Array of action sets
 */
export const listActionSets = async (limit?: number): Promise<ActionSet[]> => {
  try {
    const response = await actionSetsClient.queryAll(limit);
    
    if (response.success && response.data) {
      // Based on the response format, we need to extract the actual action sets
      const actionSetsData = Array.isArray(response.data) ? response.data : [];
      
      // Transform data to match the ActionSet interface
      return actionSetsData
        .filter((item: unknown): item is Record<string, any> => Boolean(item) && typeof item === 'object')
        .map((item: Record<string, any>): ActionSet => {
          // The actual action set data is inside the data property
          const actionSetData = item.data || {};
          
          return {
            id: actionSetData.id || item.uuid || `set-${Date.now()}`,
            name: actionSetData.name || 'Unnamed Action Set',
            tags: Array.isArray(actionSetData.tags) ? actionSetData.tags : [],
            actions: Array.isArray(actionSetData.actions) ? actionSetData.actions : [],
            createdAt: actionSetData.createdAt || new Date(item.createdAt).toISOString(),
            updatedAt: actionSetData.updatedAt || new Date().toISOString()
          };
        });
    }
    return [];
  } catch (error) {
    console.error('Error listing action sets:', error);
    throw error;
  }
};

/**
 * Delete an action set
 * 
 * @param id The ID of the action set to delete
 * @returns True if deletion was successful
 */
export const deleteActionSet = async (id: string): Promise<boolean> => {
  try {
    const response = await actionSetsClient.delete(id);
    
    return response.success || false;
  } catch (error) {
    console.error('Error deleting action set:', error);
    throw error;
  }
};

/**
 * Search action sets by tag
 * 
 * @param tag The tag to search for
 * @param limit Optional limit on the number of action sets to return
 * @returns Array of action sets with the specified tag
 */
export const searchActionSetsByTag = async (tag: string, limit?: number): Promise<ActionSet[]> => {
  try {
    const allSets = await listActionSets(limit);
    return allSets.filter(set => set.tags.includes(tag));
  } catch (error) {
    console.error('Error searching action sets by tag:', error);
    throw error;
  }
};