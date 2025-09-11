import React, { useContext, useEffect, useRef, useState } from 'react';
import { IconLoader2, IconCheck, IconAlertTriangle, IconLock } from '@tabler/icons-react';
import { lookupAssistant } from '@/services/assistantService';
import HomeContext from '@/pages/api/home/home.context';
import { promptForData } from '@/utils/app/llm';
import { DefaultModels } from '@/types/model';
import { MessageType, newMessage } from '@/types/chat';
import { Filter } from 'bad-words';
import Checkbox from '@/components/ReusableComponents/CheckBox';
import ExpansionComponent from '@/components/Chat/ExpansionComponent';
import { AddEmailWithAutoComplete } from '@/components/Emails/AddEmailsAutoComplete';
import { useSession } from 'next-auth/react';
import { AmplifyGroupSelect } from '@/components/Admin/AdminUI';
import { getUserAmplifyGroups } from '@/services/adminService';
import { AttachFile } from '@/components/Chat/AttachFile';
import { FileList } from "@/components/Chat/FileList";
import { IMAGE_FILE_EXTENSIONS } from '@/utils/app/const';
import { AttachedDocument } from '@/types/attacheddocument';
import { deleteFile } from '@/services/fileService';

export interface AstPathData {
    isPublic: boolean;
    accessTo: {amplifyGroups: string[], users: string[]};
}

export const emptyAstPathData: AstPathData = {isPublic: true, accessTo: {amplifyGroups: [], users: []}};
interface AssistantPathEditorProps {
    assistantId?: string;
    savedAstPath: string | undefined;
    astPath: string | null;
    setAstPath: (path: string | null) => void;

    astIcon: AttachedDocument | undefined;
    setAstIcon: (icon: AttachedDocument | undefined) => void;

    isPathAvailable: boolean;
    setIsPathAvailable: (isAvailable: boolean) => void;

    isCheckingPath: boolean;
    setIsCheckingPath: (isChecking: boolean) => void;

    astPathData: AstPathData | null, 
    setAstPathData: (astPathData: AstPathData) => void;

    disableEdit?: boolean;
    groupId?: string;
    
}

export const AssistantPathEditor: React.FC<AssistantPathEditorProps> = ({
    assistantId, savedAstPath, astPath, setAstPath, astIcon, setAstIcon,
    isPathAvailable, setIsPathAvailable, isCheckingPath, setIsCheckingPath,
    astPathData, setAstPathData, disableEdit = false, groupId
}) => {
    const { state: { featureFlags, chatEndpoint, statsService, amplifyUsers, defaultAccount }, getDefaultModel} = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    
    const [pathError, setPathError] = useState<string | null>(null);
    const featureEnabled = !!featureFlags?.assistantPathPublishing;
    const validatedPathCacheRef = useRef<any | undefined>(undefined);
    const [amplifyGroups, setAmplifyGroups] = useState<string[] | null>(null);
    const [astImageData, setAstImageData] = useState<{ ds: AttachedDocument, state: number } | null>(astIcon ? { ds: astIcon, state: 100} :  null);
    const [isOpenAccessDropDown, setIsOpenAccessDropDown] = useState(!savedAstPath);

    if (!validatedPathCacheRef.current) {
        validatedPathCacheRef.current = { valid: savedAstPath ? {[savedAstPath.toLowerCase()] : "Current Path"} : {}, 
                                          invalid: {} }    
    }

    useEffect(() => {
        const fetchAmpGroups = async () => {
            const ampGroupsResult = await getUserAmplifyGroups();
            setAmplifyGroups(ampGroupsResult.success ? ampGroupsResult.data : []);
            if (!ampGroupsResult.success) console.log("Failed to retrieve user amplify groups");
        } 

        if (!amplifyGroups) fetchAmpGroups();
    }, []);

    const checkPathIsAppropriate = async (path: string) => {
        const prompt = "Analyze if the provided url path contains any inappropriate words, phrases, or characters. The standard of appropriateness is the same as the content of a PG-13 movie. Your response should be only YES or NO in all caps.";
        const messages = [newMessage({role: 'user', content : `Is the following path appropriate for a public assistant path: ${path} \n Respond with either YES or NO in all caps`, type: MessageType.PROMPT})];
        const updatedResponse = await promptForData(chatEndpoint ?? '', messages, getDefaultModel(DefaultModels.CHEAPEST), prompt, defaultAccount, statsService, 20);
        console.log("updatedResponse", updatedResponse);
        if (!updatedResponse) {
            console.log("Fallback to built in filter");
            const filter = new Filter();
            return filter.isProfane(path);
        } else {
            return !updatedResponse || (updatedResponse.includes("YES") || !updatedResponse.includes("NO"));
        }
    }

    const validatePath = async (path: string): Promise<{valid: boolean | null, error?: string}> => {
        // If the feature flag is disabled, don't validate paths
        if (!featureEnabled) return {valid: null};
        // start he async call
        const isAppropriateResult = checkPathIsAppropriate(path);
        // const isAppropriateResult = true;
        
        // If path is empty, it's not valid
        if (!path || path.trim() === '') return {valid: false, error: 'Path cannot be empty'};

        // Check if the path contains any invalid characters
        const invalidCharsRegex = /[^a-zA-Z0-9-_/]/;
        if (invalidCharsRegex.test(path)) return {valid: false, error: 'Path can only contain letters, numbers, hyphens, underscores, and forward slashes'};
        
        // Check path length
        if (path.length < 3) return {valid: false, error: 'Path must be at least 3 characters long'};
        
        if (path.length > 20) return {valid: false, error: 'Path is too long (maximum 20 characters)'};
        
        // Check for leading/trailing slashes
        if (path.startsWith('/') || path.endsWith('/')) return {valid: false, error: 'Path cannot start or end with a slash'};
        
        // Check for consecutive slashes
        if (path.includes('//')) return {valid: false, error: 'Path cannot contain consecutive slashes'};

        const lowerPath = path.toLowerCase();

        // Check for paths pretending to be system paths
        const systemPaths = ['admin', 'system', 'login', 'signin', 'signup', 'register', 
                           'auth', 'authenticate', 'reset', 'password', 'billing', 'payment'];
        
        const pathParts = lowerPath.split('/');
        for (const part of pathParts) {
            if (systemPaths.includes(part)) return {valid: false, error: `Path contains restricted system term: ${part}`};
        }
        const isAppropriate = await isAppropriateResult;
        if (!isAppropriate) return {valid: false, error: 'Path contains inappropriate term. Please choose a different path.'};
        

        try {
            setPathError(null);
            
            // Look up the path
            const result = await lookupAssistant(path);
            // If lookup was successful, the path is already taken
            if (result.success) {
                // If the path is used by the same assistant we're editing, it's valid
                if (assistantId && result.assistantId === assistantId) {
                    console.log(`Path "${path}" is already assigned to this assistant`);
                    setIsPathAvailable(true);
                    if (validatedPathCacheRef?.current?.valid) validatedPathCacheRef.current.valid[lowerPath] = "Current Path";
                    const accessTo = result.data.accessTo;
                    setAstPathData({isPublic: result.data.public ?? true, 
                                    accessTo: {amplifyGroups: accessTo.amplifyGroups ?? [], 
                                                users: accessTo.users ?? []}});
                    return {valid: true};
                }
                
                // Otherwise, the path is used by a different assistant
                setIsPathAvailable(false);
                return {valid: false, error: 'Path is already in use by another assistant'};
            }

            if (validatedPathCacheRef?.current?.valid) validatedPathCacheRef.current.valid[lowerPath] = "Path available";
            
            // If lookup failed with a "not found" message, the path is available
            setIsPathAvailable(true);
            return {valid: true};
        } catch (error) {
            console.error('Error validating path:', error);
            setIsPathAvailable(false);
            return {valid: null, error: 'Error checking path availability - please try again', };
        } 
    };

    const handlePathBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        // Skip validation if the feature flag is disabled
        if (!featureEnabled) return;
        setAstPathData(emptyAstPathData);
        
        const path = e.target.value.trim();
        if (path) {
            // If the path is the same as the current assistant's path, just set it as valid
            // without making unnecessary API calls
            const pathLower = path.toLowerCase();
            if (assistantId && pathLower in Object.keys(validatedPathCacheRef?.current?.valid ?? {})) {
                console.log(`Path found in cache, using existing path: ${path}`);
                setIsPathAvailable(true);
                setPathError(null);
                return;
            } 
            // check cache
            if (pathLower in Object.keys(validatedPathCacheRef?.current?.invalid ?? {})) {
                const error = validatedPathCacheRef?.current?.invalid[pathLower];
                if (error) setPathError(error);
                return;
            }
            setIsCheckingPath(true);
            const result = await validatePath(path);
            setIsCheckingPath(false);
            // if path is null, we werent able to check properly
            if (result.valid === false && validatedPathCacheRef?.current?.invalid) validatedPathCacheRef.current.invalid[pathLower] = result?.error;
            if (result.error) setPathError(result.error);

        } else {
            setIsPathAvailable(false);
            setPathError(null);
        }
    };

    // handle file upload functions //
    const onAttach = (doc: AttachedDocument) => {
        cleanUpImageFile();
        setAstImageData({ds: doc, state: 0});
    }

    const onUploadProgress = (doc: AttachedDocument, progress: number) => {
        setAstImageData({ds: doc, state: progress});
        if (progress === 100) setAstIcon(doc);
    }

    const cleanUpImageFile = async () => {
        const key = astImageData?.ds.key;
        if (key) await deleteFile(key);
    }

    const cleanUpAstImageData = () => {
        cleanUpImageFile();
        setAstImageData(null);
        setAstIcon(undefined);
    }

    if (!featureEnabled) {
        return null;
    }

    return (
        <>
            <div className="mt-4 flex flex-row">
                <div className="text-sm font-bold text-black dark:text-neutral-200">
                    Publish Assistant Path
                </div>
                {!isCheckingPath && astPathData &&
                <div className="ml-auto h-0 -mt-1">
                    { !disableEdit ?
                        (astPath ? 
                        <div>
                        { !groupId && 
                        <Checkbox
                            id="publish-to-all-users"
                            label="Publish to all users"
                            checked={astPathData.isPublic ?? true}
                            onChange={(checked) => {
                                if (!checked) setIsOpenAccessDropDown(true);
                                const newAstPathData = {...astPathData, isPublic: checked};
                                setAstPathData(newAstPathData);
                            }}/> }
                        <div title={`Upload an image to use as the assistant's icon. Supported formats: ${IMAGE_FILE_EXTENSIONS.map(ext => ext.toUpperCase()).join(', ')}`}
                             className="text-xs flex flex-row -mt-2 -ml-1.5">
                            <AttachFile id={"__attachFile_assistant_path"}
                                    allowedFileExtensions={IMAGE_FILE_EXTENSIONS}
                                    onAttach={onAttach}
                                    onSetMetadata={(doc: AttachedDocument, metadata: any) => {}}
                                    onSetKey={(doc: AttachedDocument, key: string) => {}}
                                    onUploadProgress={onUploadProgress}
                                    disableRag={false}
                                    props={{'type': 'assistant-icon'}}
                                    groupId={groupId}
                            />
                            {astImageData ?
                                <FileList 
                                documents={[astImageData?.ds]} 
                                documentStates={{[astImageData.ds.id] : astImageData.state}}
                                setDocuments={(docs:AttachedDocument[]) => cleanUpAstImageData()}  // only happens on removal of file    
                                onCancelUpload={(ds:AttachedDocument) => cleanUpAstImageData()}
                            /> : <span className="py-1.5 text-xs text-gray-500">Add Assistant Icon</span>}
                        </div>
                        </div> : null)  
                       : <label className={"mt-5 text-xs text-blue-500"}>
                        {astPathData.isPublic ? "Public Access" : "Restricted Access"}
                        </label>
                    }
                </div> }
                
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
                    id="pathNameInput"
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
                                    <span id="pathError" className="text-xs">Error</span>
                                </div>
                            ) : isPathAvailable ? (
                                <div className="flex items-center text-green-500">
                                    <IconCheck className="h-5 w-5 mr-1" />
                                    <span id="pathAvailable" className="text-xs">{(validatedPathCacheRef?.current?.valid ?? {})[astPath?.toLowerCase() ?? ''] || "Available"}</span>
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
                            <li>Choose a different name that doesn&apos;t include system-reserved terms</li>
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

            {!isCheckingPath && astPathData && !astPathData.isPublic && 
             <div className="mt-4">
                <ExpansionComponent
                    isOpened={isOpenAccessDropDown}
                    closedWidget={<IconLock size={16} />}
                    title="Manage user access to published assistant"
                    content={
                      <div className="flex flex-col gap-2 mt-2">
                        {amplifyGroups && amplifyGroups.length > 0 &&
                        <> 
                         Allow access via Amplify group membership
                         <AmplifyGroupSelect 
                            groups={amplifyGroups}
                            selected={astPathData.accessTo.amplifyGroups ?? []}
                            setSelected={(selected: string[]) => {
                                const updateAccessTo = {...astPathData.accessTo, amplifyGroups: selected};
                                setAstPathData({...astPathData, accessTo: updateAccessTo});
                            }}
                            isDisabled={disableEdit}
                         /> 
                        </>
                        }
                        Allow access to individual users
                        <AddEmailWithAutoComplete
                            id={`assistant-path`}
                            emails={astPathData.accessTo.users ?? []}
                            allEmails={amplifyUsers.filter((user: string) => user !== userEmail)}
                            handleUpdateEmails={(updatedEmails: Array<string>) => {
                                const updateAccessTo = {...astPathData.accessTo, users: updatedEmails};
                                setAstPathData({...astPathData, accessTo: updateAccessTo});
                            }}
                            displayEmails={true}
                            disableEdit={disableEdit}
                        />
                    
                       </div>
                    }
                />
             </div>
            }
        </>
    );
};

export default AssistantPathEditor; 


export const isAstPathDataChanged = (dataA: AstPathData | null | undefined, 
                                     dataB: AstPathData | null | undefined): boolean => {
    // If both are null/undefined, they're equal
    if (!dataA && !dataB) return false;
    
    // If only one is null/undefined, they're different
    if (!dataA || !dataB) return true;
    
    // Compare isPublic field
    if (dataA.isPublic !== dataB.isPublic) return true;
    
    // Compare accessTo.amplifyGroups
    const groupsA = dataA.accessTo?.amplifyGroups || [];
    const groupsB = dataB.accessTo?.amplifyGroups || [];
    if (groupsA.length !== groupsB.length) return true;
    if (!groupsA.every(group => groupsB.includes(group))) return true;
    
    // Compare accessTo.users
    const usersA = dataA.accessTo?.users || [];
    const usersB = dataB.accessTo?.users || [];
    if (usersA.length !== usersB.length) return true;
    if (!usersA.every(user => usersB.includes(user))) return true;
    
    return false; // No differences found
}