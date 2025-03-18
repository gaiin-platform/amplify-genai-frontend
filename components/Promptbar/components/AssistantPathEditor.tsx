import React, { useContext, useRef, useState } from 'react';
import { IconLoader2, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { lookupAssistant } from '@/services/assistantService';
import HomeContext from '@/pages/api/home/home.context';

interface AssistantPathEditorProps {
    savedAstPath: string | undefined;
    astPath: string | null;
    setAstPath: (path: string | null) => void;
    assistantId?: string;
    onPathValidated?: (isValid: boolean, path: string | null, error: string | null) => void;
    disableEdit?: boolean;
    isCheckingPath: boolean;
    setIsCheckingPath: (isChecking: boolean) => void;
}

export const AssistantPathEditor: React.FC<AssistantPathEditorProps> = ({
    savedAstPath,
    astPath,
    setAstPath,
    assistantId,
    onPathValidated,
    isCheckingPath,
    setIsCheckingPath,
    disableEdit = false,
}) => {
    const { state: { featureFlags }} = useContext(HomeContext);
    const [pathError, setPathError] = useState<string | null>(null);
    const [isPathAvailable, setIsPathAvailable] = useState(false);
    const [pathAvailability, setPathAvailability] = useState({ available: false, message: "" });
    const featureEnabled = !!featureFlags?.assistantPathPublishing;
    const validatedPathCacheRef = useRef<string[] | undefined>(undefined);
    if (!validatedPathCacheRef.current) {
        validatedPathCacheRef.current = savedAstPath ? [savedAstPath.toLowerCase()] : []
    }

    const validatePath = async (path: string): Promise<boolean> => {
        // If the feature flag is disabled, don't validate paths
        if (!featureEnabled) {
            return false;
        }
        
        // If path is empty, it's not valid
        if (!path || path.trim() === '') {
            setPathError('Path cannot be empty');
            return false;
        }

        // Check if the path contains any invalid characters
        const invalidCharsRegex = /[^a-zA-Z0-9-_/]/;
        if (invalidCharsRegex.test(path)) {
            setPathError('Path can only contain letters, numbers, hyphens, underscores, and forward slashes');
            return false;
        }
        
        // Check path length
        if (path.length < 3) {
            setPathError('Path must be at least 3 characters long');
            return false;
        }
        
        if (path.length > 12) {
            setPathError('Path is too long (maximum 12 characters)');
            return false;
        }
        
        // Check for leading/trailing slashes
        if (path.startsWith('/') || path.endsWith('/')) {
            setPathError('Path cannot start or end with a slash');
            return false;
        }
        
        // Check for consecutive slashes
        if (path.includes('//')) {
            setPathError('Path cannot contain consecutive slashes');
            return false;
        }
        
        // Check for common inappropriate terms
        const inappropriateTerms = [
            'profanity', 'offensive', 'obscene', 'adult', 'xxx', 'porn', 
            'explicit', 'sex', 'nsfw', 'violence', 'hate', 'racist', 
            'discriminatory', 'illegal', 'hack', 'crack', 'warez',
            'bypass', 'pirate', 'torrent', 'steal', 'nude', 'naked'
        ];
        
        const lowerPath = path.toLowerCase();
        for (const term of inappropriateTerms) {
            if (lowerPath.includes(term)) {
                setPathError(`Path contains inappropriate term: ${term}`);
                return false;
            }
        }
        
        // Check for paths pretending to be system paths
        const systemPaths = ['admin', 'system', 'login', 'signin', 'signup', 'register', 
                           'auth', 'authenticate', 'reset', 'password', 'billing', 'payment'];
        
        const pathParts = lowerPath.split('/');
        for (const part of pathParts) {
            if (systemPaths.includes(part)) {
                setPathError(`Path contains restricted system term: ${part}`);
                return false;
            }
        }

        try {
            setIsCheckingPath(true);
            setPathError(null);
            
            // Look up the path
            const result = await lookupAssistant(path);
            // If lookup was successful, the path is already taken
            if (result.success) {
                // Get the current assistant's ID (from definition)
                
                // If the path is used by the same assistant we're editing, it's valid
                if (assistantId && result.assistantId === assistantId) {
                    console.log(`Path "${path}" is already assigned to this assistant`);
                    setPathError(null);
                    setIsPathAvailable(true);
                    setPathAvailability({ available: true, message: "Current path" });
                    if (onPathValidated) onPathValidated(true, path, null);
                    return true;
                }
                
                // Otherwise, the path is used by a different assistant
                setPathError('This path is already in use by another assistant');
                setIsPathAvailable(false);
                setPathAvailability({ available: false, message: "Path already in use" });
                if (onPathValidated) onPathValidated(false, path, 'This path is already in use by another assistant');
                return false;
            }


            validatedPathCacheRef?.current?.push(path.toLowerCase());
            
            // If lookup failed with a "not found" message, the path is available
            setIsPathAvailable(true);
            setPathAvailability({ available: true, message: "Path available" });
            if (onPathValidated) onPathValidated(true, path, null);
            return true;
        } catch (error) {
            console.error('Error validating path:', error);
            setPathError('Error checking path availability - please try again');
            setIsPathAvailable(false);
            setPathAvailability({ available: false, message: "Error" });
            if (onPathValidated) onPathValidated(false, path, 'Error checking path availability - please try again');
            return false;
        } finally {
            setIsCheckingPath(false);
        }
    };

    const handlePathBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        // Skip validation if the feature flag is disabled
        if (!featureEnabled) {
            return;
        }
        
        const path = e.target.value.trim();
        if (path) {
            // If the path is the same as the current assistant's path, just set it as valid
            // without making unnecessary API calls
            if (assistantId && validatedPathCacheRef?.current?.includes(path.toLowerCase())) {
                console.log(`Path found in cache, using existing path: ${path}`);
                setIsPathAvailable(true);
                setPathError(null);
                setPathAvailability({ available: true, message: "Current path" });
                if (onPathValidated) onPathValidated(true, path, null);
                return;
            }
            
            // Validate the path - this function will now set pathAvailability directly
            await validatePath(path);
            
            // No need to update pathAvailability here since validatePath now handles it
        } else {
            setIsPathAvailable(false);
            setPathError(null);
            setPathAvailability({ available: false, message: "" });
            if (onPathValidated) onPathValidated(false, null, null);
        }
    };

    if (!featureEnabled) {
        return null;
    }

    return (
        <>
            <div className="mt-4 text-sm font-bold text-black dark:text-neutral-200">
                Publish Assistant Path
            </div>
            {astPath && (
                <p className="text-xs text-black dark:text-neutral-200 mt-2 mb-1">
                    Assistants will be accessible at {window.location.origin}/assistants/{astPath.toLowerCase()}
                </p>
            )}
            <div className="relative">
                <input
                    className={`mt-2 w-full rounded-lg border ${pathError ? 'border-red-500' : isPathAvailable ? 'border-green-500' : 'border-neutral-500'} px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100`}
                    placeholder="Enter a name for the path where you want to publish your assistant"
                    value={astPath || ''}
                    onChange={(e) => {
                        setAstPath(e.target.value);
                        setPathError(null);
                        setIsPathAvailable(false);
                    }}
                    onBlur={handlePathBlur}
                    disabled={disableEdit}
                />
                {astPath && (
                    <div className="absolute right-3 mt-1 top-1/2 transform -translate-y-1/2">
                        {isCheckingPath ? (
                            <IconLoader2 className="animate-spin h-5 w-5 text-gray-400" />
                        ) : (<>
                            {pathError ? (
                                <div className="flex items-center text-red-500">
                                    <IconAlertTriangle className="h-5 w-5 mr-1" />
                                    <span className="text-xs">Error</span>
                                </div>
                            ) : isPathAvailable ? (
                                <div className="flex items-center text-green-500">
                                    <IconCheck className="h-5 w-5 mr-1" />
                                    <span className="text-xs">{pathAvailability.message || "Available"}</span>
                                </div>
                            ) : null}
                            </>)}
                        
                    </div>
                )}
            </div>
            {pathError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md">
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-start">
                        <IconAlertTriangle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                        <span className='mt-1'>{pathError}</span>
                    </p>
                    <ul className="text-xs text-red-600 dark:text-red-400 mt-1 ml-5 list-disc">
                        {pathError.includes('invalid characters') && (
                            <li>Use only letters, numbers, hyphens, underscores, and forward slashes</li>
                        )}
                        {pathError.includes('restricted system term') && (
                            <li>Choose a different name that doesn't include system-reserved terms</li>
                        )}
                        {pathError.includes('inappropriate term') && (
                            <li>Choose a business-appropriate path name</li>
                        )}
                        {pathError.includes('already in use') && (
                            <li>This path is already assigned to a different assistant</li>
                        )}
                    </ul>
                </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span className="font-medium">Path requirements:</span> 3-100 characters, letters, numbers, hyphens, underscores, and forward slashes.
                <br />No leading/trailing slashes or consecutive slashes. No reserved or inappropriate terms.
            </p>
        </>
    );
};

export default AssistantPathEditor; 