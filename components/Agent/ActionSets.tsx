import { FC, useEffect, useState } from 'react';
import { IconLoader2, IconTrash } from '@tabler/icons-react';
import { ActionSet, deleteActionSet, listActionSets } from '@/services/actionSetsService';
import { getOperationIcon } from '@/utils/app/integrations';
import Search from '../Search';

interface LoadActionSetModalProps {
  onLoad: (actionSet: ActionSet) => void;
}

const getIcon = (name: string | undefined) => {
  const IconComponent = getOperationIcon(name);
  return <IconComponent size={14} stroke={1.5} />;
};

const formatName = (name: string): string => {
  return name
    .split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    .replace(/([A-Z])/g, ' $1').trim()
    .replace(/\s+/g, ' ');
};

export const ActionSetList: FC<LoadActionSetModalProps> = ({ onLoad }) => {
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
    e.stopPropagation();
    if (!id) return;
    if (confirm('Are you sure you want to delete this action set?')) {
      try {
        setDeleting(id);
        const success = await deleteActionSet(id);
        if (success) {
          setActionSets(actionSets.filter(set => set.id !== id));
          if (selectedSetId === id) setSelectedSetId(null);
        } else {
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

  const filteredSets = actionSets.filter(set => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const nameMatch = typeof set?.name === 'string' && set.name.toLowerCase().includes(q);
    const setTagMatch = Array.isArray(set?.tags) && set.tags.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(q));
    const actionTagMatch = Array.isArray(set?.actions) && set.actions.some((action: any) => {
      const opTags: string[] = action?.operation?.tags ?? action?.tags ?? [];
      return opTags.some((tag: string) => typeof tag === 'string' && tag.toLowerCase().includes(q));
    });
    return nameMatch || setTagMatch || actionTagMatch;
  });

  return (
    <div>
      <div className="mb-4">
        <Search
          placeholder="Search action sets by name or tag..."
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          disabled={loading}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400 text-sm gap-2">
          <IconLoader2 size={16} className="animate-spin" />
          <span>Loading action sets...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-100 text-red-700 text-sm rounded border border-red-300 mb-4">
          {error}
          <button className="ml-4 underline" onClick={loadActionSets}>Retry</button>
        </div>
      ) : filteredSets.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          {searchTerm ? 'No action sets match your search' : 'No saved action sets found'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSets.map((set) => {
            const isSelected = selectedSetId === set.id;
            return (
              <div
                key={set.id}
                className={`group relative rounded-lg border cursor-pointer px-4 py-3 transition-colors
                  ${isSelected
                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                onClick={() => {
                  setSelectedSetId(set.id || null);
                  onLoad(set);
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {set.name || 'Unnamed Set'}
                  </span>
                  <button
                    onClick={(e) => handleDelete(set.id!, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 ml-2"
                    title="Delete action set"
                    disabled={!set.id}
                  >
                    {deleting === set.id
                      ? <IconLoader2 size={14} className="animate-spin" />
                      : <IconTrash size={14} stroke={1.8} />
                    }
                  </button>
                </div>

                {Array.isArray(set.actions) && set.actions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {set.actions.map((action, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
                        title={action.customDescription || action.operation?.description || ''}
                      >
                        <span className="text-gray-600 dark:text-gray-400">
                          {getIcon(action.name || action.operation?.name)}
                        </span>
                        {formatName(action.customName || action.name || action.operation?.name || 'Unnamed')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionSetList;
