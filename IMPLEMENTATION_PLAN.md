# Large Text Paste Preferences - Implementation Plan

## Summary
We need to replace in-memory session choices with persistent Settings-based preferences.

## Changes Required

### 1. ✅ COMPLETED: Add to Settings interface
```typescript
// types/settings.ts
largeTextPastePreferences?: { [key: string]: 'file' | 'block' | 'plain' };
```

### 2. ✅ COMPLETED: Update getSettings()
```typescript
// utils/app/settings.ts
largeTextPastePreferences: {}
```

### 3. TODO: Update LargeTextModal to include checkbox

Add props:
- `hasExistingPreference?: boolean` - Shows if preference already exists for this type
- `onConfirm: (choice, rememberChoice) => void` - Updated signature

Add to modal:
```tsx
const [rememberChoice, setRememberChoice] = useState(true); // Default checked

// In modal content, after options:
<div className="mt-4 pt-4 border-t border-neutral-300 dark:border-neutral-600">
  <label className="flex items-center cursor-pointer">
    <input
      type="checkbox"
      checked={rememberChoice}
      onChange={(e) => setRememberChoice(e.target.checked)}
      className="mr-2"
    />
    <span className="text-sm text-neutral-700 dark:text-neutral-300">
      Remember my choice for this type of content
    </span>
  </label>
  {hasExistingPreference && (
    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
      You previously chose a preference for this type. This will update it.
    </p>
  )}
</div>
```

### 4. TODO: Update ChatInput handlePaste logic

Replace session memory with Settings:

```typescript
// Get current preferences from Settings
const currentSettings = getSettings(featureFlags);
const preferences = currentSettings.largeTextPastePreferences || {};

// Check for remembered preference
const sessionKey = generateSessionKey(textSize, detectedType.extension);
const rememberedChoice = preferences[sessionKey];

// FIX THE BUG: Always use remembered choice if it exists
if (rememberedChoice) {
    userChoice = rememberedChoice;
} else if (needsModal) {
    const result = await showModalAndWait({...});
    userChoice = result.choice;

    // Save preference if user checked "remember"
    if (result.rememberChoice) {
        const updatedSettings = {
            ...currentSettings,
            largeTextPastePreferences: {
                ...preferences,
                [sessionKey]: userChoice
            }
        };
        saveSettings(updatedSettings);
    }
} else {
    // Auto-decide
}
```

### 5. TODO: Update modal handlers

```typescript
const handleModalConfirm = useCallback((choice: 'file' | 'block' | 'plain', rememberChoice: boolean) => {
    if (pendingPasteData) {
        pendingPasteData.resolve({ choice, rememberChoice });
    }
    setShowLargeTextModal(false);
    setPendingPasteData(null);
}, [pendingPasteData]);
```

### 6. TODO: Add Reset button to Settings dialog

In `components/Settings/SettingDialog.tsx`, Features tab, add:

```tsx
// After feature flags section
{initSettingsRef.current?.largeTextPastePreferences &&
 Object.keys(initSettingsRef.current.largeTextPastePreferences).length > 0 && (
  <div className="mt-4 p-3 border border-neutral-300 dark:border-neutral-600 rounded">
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-sm">Large Text Paste Preferences</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
          You have {Object.keys(initSettingsRef.current.largeTextPastePreferences).length} saved preference(s)
        </div>
      </div>
      <button
        onClick={() => {
          const updatedSettings = {
            ...initSettingsRef.current,
            largeTextPastePreferences: {}
          };
          saveSettings(updatedSettings);
          initSettingsRef.current = updatedSettings;
          toast.success('Large text preferences cleared');
        }}
        className="px-3 py-1.5 text-sm border rounded border-neutral-400 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
      >
        Reset Preferences
      </button>
    </div>
  </div>
)}
```

### 7. TODO: Remove sessionChoices from useLargeTextManager hook

The hook no longer needs to manage session state since we're using Settings.

## Testing Plan

1. **Test preference save**: Paste large text, check "remember", verify saved in localStorage
2. **Test preference apply**: Paste similar text again, verify auto-applies without modal
3. **Test Reset button**: Clear preferences in Settings, verify modal appears again
4. **Test different types**: JSON vs CSV vs TXT should have separate preferences
5. **Test different sizes**: 10KB vs 120KB should have separate preferences
6. **Test unchecked**: Paste without "remember" checked, verify not saved

## Files to Modify

1. ✅ `types/settings.ts` - Add interface property
2. ✅ `utils/app/settings.ts` - Add default value
3. `components/Chat/LargeTextModal.tsx` - Add checkbox
4. `components/Chat/ChatInput.tsx` - Replace session memory with Settings
5. `components/Settings/SettingDialog.tsx` - Add Reset button
6. `hooks/useLargeTextManager.ts` - Remove sessionChoices (optional cleanup)
