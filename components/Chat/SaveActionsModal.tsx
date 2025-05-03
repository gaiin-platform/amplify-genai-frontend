import { FC, useState } from 'react';
import { IconCircleCheck, IconCircleX, IconDeviceFloppy, IconLoader2, IconPlus } from '@tabler/icons-react';
import { ActionItem, ActionSet, saveActionSet } from '@/services/actionSetsService';

interface SaveActionsModalProps {
  actions: ActionItem[];
  onSave: (name: string, tags: string[]) => void;
  onCancel: () => void;
  title?: string;
  width?: string;
}

export const SaveActionsModal: FC<SaveActionsModalProps> = ({
  actions,
  onSave,
  onCancel,
  title = 'Save Actions',
  width = '450px',
}) => {
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    // Reset previous errors
    setSaveError('');
    
    if (!name.trim()) {
      setNameError('A name is required');
      return;
    }
    
    try {
      setSaving(true);
      
      // Create the action set object
      const actionSet: ActionSet = {
        name: name.trim(),
        tags,
        actions
      };
      
      // Save to the database
      await saveActionSet(actionSet);
      
      // Call the onSave callback
      onSave(name, tags);
    } catch (error) {
      console.error('Error saving action set:', error);
      setSaveError('Failed to save action set. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white dark:bg-[#22232b] text-black dark:text-neutral-200 rounded-lg border border-gray-300 dark:border-neutral-600 shadow-xl" style={{ width }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300 dark:border-neutral-600">
          <div className="text-xl font-semibold">{title}</div>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            title="Close"
            disabled={saving}
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2" htmlFor="name">
              Action Set Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              className={`w-full rounded-lg border ${nameError ? 'border-red-500' : 'border-neutral-500'} px-4 py-2 shadow dark:bg-[#40414F] dark:text-neutral-100`}
              placeholder="Enter a name for this set of actions"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setNameError('');
              }}
              disabled={saving}
            />
            {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">
              Tags
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add a tag..."
                className="flex-grow rounded-lg border border-neutral-500 px-3 py-1 dark:bg-[#40414F] dark:text-neutral-100"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTagInput.trim()) {
                    e.preventDefault();
                    if (!tags.includes(newTagInput.trim())) {
                      setTags([...tags, newTagInput.trim()]);
                    }
                    setNewTagInput('');
                  }
                }}
                disabled={saving}
              />
              <button
                className="text-gray-600 hover:text-black dark:hover:text-white"
                onClick={() => {
                  if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
                    setTags([...tags, newTagInput.trim()]);
                  }
                  setNewTagInput('');
                }}
                disabled={saving}
              >
                <IconPlus size={20} />
              </button>
            </div>
            <div className="flex flex-wrap mt-2 gap-2">
              {tags.map((tag, index) => (
                <div
                  key={index}
                  className="flex items-center bg-gray-200 dark:bg-neutral-600 text-sm font-medium px-3 py-1 rounded-full"
                >
                  <span>{tag}</span>
                  <button
                    className="ml-2 text-gray-700 hover:text-red-600 dark:text-white dark:hover:text-red-400"
                    onClick={() => {
                      setTags(tags.filter((t) => t !== tag));
                    }}
                    disabled={saving}
                  >
                    <IconCircleX size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mb-2">
            <label className="block text-sm font-bold mb-2">
              Actions to Save
            </label>
            <div className="bg-gray-100 dark:bg-neutral-800 rounded p-2 text-sm">
              <ul className="list-disc pl-4">
                {actions.map((action, index) => (
                  <li key={index}>
                    {action.customName || action.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {saveError && (
            <div className="mt-4 p-2 bg-red-100 text-red-700 text-sm rounded border border-red-300">
              {saveError}
            </div>
          )}
        </div>
        
        <div className="flex justify-end p-4 border-t border-gray-300 dark:border-neutral-600">
          <button
            className="mr-2 px-4 py-2 border rounded text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <IconLoader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <IconDeviceFloppy size={16} />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveActionsModal;