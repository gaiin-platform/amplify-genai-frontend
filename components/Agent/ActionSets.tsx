import { FC, useEffect, useState } from 'react';
import { IconDeviceFloppy, IconLoader2, IconSearch, IconTag, IconTrash } from '@tabler/icons-react';
import { ActionSet, deleteActionSet, listActionSets } from '@/services/actionSetsService';
import Search from '../Search';

interface LoadActionSetModalProps {
  onLoad: (actionSet: ActionSet) => void;
}

export const ActionSetList: FC<LoadActionSetModalProps> = ({
  onLoad
}) => {
  const [actionSets, setActionSets] = useState<ActionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadActionSets();
  }, []);

  const loadActionSets = async () => {
    try {
      setLoading(true);
      setError('');
      
      const sets = await listActionSets();
      setActionSets(sets);
    } catch (error) {
      console.error('Error loading action sets:', error);
      setError('Failed to load action sets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the row when clicking delete
    
    if (!id) {
      console.error('Cannot delete action set without an ID');
      return;
    }
    
    if (confirm('Are you sure you want to delete this action set?')) {
      try {
        setDeleting(id);
        const success = await deleteActionSet(id);
        
        if (success) {
          setActionSets(actionSets.filter(set => set.id !== id));
          if (selectedSetId === id) {
            setSelectedSetId(null);
          }
        } else {
          console.error('Failed to delete action set', id);
          alert('Failed to delete action set. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting action set:', error);
        alert('Failed to delete action set. Please try again.');
      } finally {
        setDeleting(null);
      }
    }
  };

  const handleLoadSet = (actionSet: ActionSet) => {
    onLoad(actionSet);
  };

  // Filter action sets based on search term
  const filteredSets = actionSets.filter(set => {
    // Safely handle search by name
    const nameMatch = set?.name && typeof set.name === 'string' 
      ? set.name.toLowerCase().includes(searchTerm.toLowerCase()) 
      : false;
    
    // Safely handle search by tags
    const tagMatch = set?.tags && Array.isArray(set.tags)
      ? set.tags.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(searchTerm.toLowerCase()))
      : false;
      
    return nameMatch || tagMatch;
  });

  return (        
        <div>
          {/* Search input */}
          <div className="mb-4">
          <Search
              placeholder="Search action sets by name or tag..."
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
              disabled={loading}
            />
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 size={24} className="animate-spin text-gray-500 mr-2" />
              <span>Loading action sets...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 text-red-700 text-sm rounded border border-red-300 mb-4">
              {error}
              <button 
                className="ml-4 underline"
                onClick={loadActionSets}
              >
                Retry
              </button>
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm 
                ? 'No action sets match your search criteria' 
                : 'No saved action sets found'}
            </div>
          ) : (
            <div className="border border-gray-300 dark:border-gray-600 rounded">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/4">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/4">
                        Tags
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-2/4">
                        Actions
                      </th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '350px' }}>
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {filteredSets.map((set) => (
                    <tr 
                      key={set.id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${selectedSetId === set.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      onClick={() => {
                        setSelectedSetId(set.id || null);
                        handleLoadSet(set);
                        console.log('set', set);
                      }}
                    >
                      <td className="px-4 py-3 text-sm w-1/4">
                        {set.name || 'Unnamed Set'}
                      </td>
                      <td className="px-4 py-3 text-sm w-1/4">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(set.tags) && set.tags.length > 0 ? (
                            set.tags.map((tag, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs rounded-full"
                              >
                                <IconTag size={12} className="mr-1" />
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs">No tags</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm w-2/4">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(set.actions) && set.actions.length > 0 ? (
                            set.actions.map((action, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs rounded-full"
                                title={action.customDescription || action.operation?.description || ''}
                              >
                                {action.customName || action.name || action.operation?.name || 'Unnamed Action'}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs">No actions</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right w-10">
                        {deleting === set.id ? (
                          <IconLoader2 size={16} className="animate-spin" />
                        ) : (
                          <button
                            onClick={(e) => handleDelete(set.id!, e)}
                            className="text-gray-400 hover:text-red-600"
                            title="Delete action set"
                            disabled={!set.id}
                          >
                            <IconTrash size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
  );
};

export default ActionSetList;