import { IconCircleCheck, IconCircleX, IconCode, IconLoader2, IconPlaystationCircle, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { FC, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';



import { useChatService } from "@/hooks/useChatService";



import { getAvailableIntegrations } from "@/services/oauthIntegrationsService";
import {
    deletePythonFunction,
    executePythonFunction,
    getFunctionCode,
    getFunctionMetadata,
    listUserFunctions,
    publishFunction,
    savePythonFunction
} from '@/services/softwareEngineerService';



import { filterModels } from "@/utils/app/models";
import { getSettings } from "@/utils/app/settings";



import { ChatBody, Message, newMessage } from "@/types/chat";
import { Model } from "@/types/model";



import HomeContext from "@/pages/api/home/home.context";



import PromptTextArea from "@/components/PromptTextArea/PromptTextArea";
import {getSession} from "next-auth/react";
import toast from 'react-hot-toast';


interface Props {
    onSave: (fn: { name: string; code: string; schema: string; testJson: string }) => void;
    onCancel: () => void;
    title?: string;
    width?: string;
    height?: string;
    blackoutBackground?: boolean;
    translateY?: string;
}


const promptForTestCase = async (doPrompt: any, fn: any, notes="") => {
    const prompt = `
This is the function I need you to write a new test case for:
\`\`\`python
${fn.code}
\`\`\`

These are the existing test cases:
${fn.testCases.map((tc: any) => JSON.stringify(tc)).join('\n')}

${notes}

Output your description below in a \`\`\`json markdown block using the same format as the
other test cases. Make sure your description is detailed and at least 3 sentences. Also,
try to build a new test case that doesn't overlap with the prior ones. 

Your test case must follow this schema:

\`\`\`json
{
  "name": "Test Case Name",
  "description": "A detailed description of the test case.",
  "inputJson": {},
  "expectedOutput": {},
  "matchType": "exact"
}
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TestCase",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "inputJson": {
      "type": "object"
    },
    "expectedOutput": {
      "type": "object"
    },
    "matchType": {
      "type": "string",
      "enum": ["exact"]
    }
  },
  "required": ["name", "description", "inputJson", "expectedOutput", "matchType"],
  "additionalProperties": false
}
\`\`\`

        `;

    return await doPrompt([newMessage({content: prompt})]);
}



export const PythonFunctionModal: FC<Props> = ({
                                                   onSave,
                                                   onCancel,
                                                   title = 'Manage Custom APIs',
                                                   width = '900px',
                                                   height = '76vh',
                                                   blackoutBackground = true,
                                                   translateY
                                               }) => {


    const { routeChatRequest } = useChatService();
    const abortRef = useRef<boolean>(false);
    const abortController: AbortController = new AbortController();

    const { state: { featureFlags, availableModels } } = useContext(HomeContext);
    const filteredModels = filterModels(availableModels, getSettings(featureFlags).hiddenModelIds);

    const model = filteredModels.find(x => x.id === "gpt-4o") || filteredModels[0];

    const doPrompt = async (messages: Message[], generateStarted=()=>{}, generateEnded=(v: string|null)=>{}, generateChunk=(v:string)=>{}, rootPromptText="", temperature=1.0)=>{

        const chatBody: ChatBody = {
            model: model,
            messages: messages,
            key: '',
            prompt: rootPromptText,
            temperature: temperature,
        };

        generateStarted();

        const response = await routeChatRequest(chatBody, abortController.signal);

        if (response.ok) {
            const data = response.body;
            if (data) {
                const reader = data.getReader();
                const decoder = new TextDecoder();

                let done = false;
                let text = '';

                while (!done) {
                    if (abortRef.current) {
                        generateEnded(null);
                        break;
                    }

                    const { value, done: doneReading } = await reader.read();
                    done = doneReading;
                    const chunkValue = decoder.decode(value);
                    text += chunkValue;
                    generateChunk(chunkValue);
                }

                generateEnded(text);
                return text;
            }
        } else {
            generateEnded(null);
        }

        return null;
    }

    const codeGenPrompt = `
Write a Python script that follows this exact pattern:
\t•\tIt must define a main(event: dict) -> dict function. This function contains the core logic and returns a dictionary.
\t•\tThe script must accept a JSON string as a command-line argument, parse it into a Python dictionary called event, and pass it to the main function.
\t•\tIt must redirect sys.stdout to an in-memory buffer using io.StringIO() before calling main.
\t•\tAny output printed inside main() (e.g., for logging/debugging) should be captured.
\t•\tAfter calling main, the script must:
\t1.\tAdd a new key "stdout" to the result dictionary, whose value is the captured printed output (stripped of trailing whitespace).
\t2.\tPrint the final dictionary as a JSON string to standard output.
\t•\tFinally, sys.stdout must be restored to its original state.

The structure or your output must look exactly like this:

\`\`\`python
# <Insert your thoughts here as a comment>

import json
import sys
import io

def main(event: dict) -> dict:
    # main logic here
    print("...log stuff to stdout inside of the main logic...")
    ...
    # All scripts must return a dict with keys containing the key outputs
    return {...some dict with keys...}

if __name__ == "__main__":
    output = main(event)
    
\`\`\`

Only the contents of main() should change depending on the task. Only output code. You can
put any commentary for the user as comments. You MUST output the code in a \`\`\`python block.
    `

    const postProcessPythonFunction = (s: string) => {
        // Step 1: Strip any existing "if __name__ == '__main__'" block using a robust regex
        s = s.replace(
            /(?:(?:\n|\r)\s*)?if\s+__name__\s*==\s*['"]__main__['"]\s*:(?:\n|\r)([\t ]+.+(?:\n|\r)?)+/g,
            ''
        ).trim();

        // Step 2: Define the standard main block to append
        const mainBlock = `
##############################################
#  Standard Execution Harness
#  DO NOT MODIFY UNLESS YOU 
#  ABSOLUTELY NEED TO. 
#  Most modifications should go in main()
##############################################        
if __name__ == "__main__":
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    output = {}

    try:
        event = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        output = main(event)
    except Exception as e:
        import traceback
        output = {
            "error": True,
            "traceback": traceback.format_exc(),
            "exception": str(e)
        }

    try:
        output["stdout"] = sys.stdout.getvalue().strip()
    except Exception as e:
        output["stdout"] = f"Unable to capture stdout: {e}"
        output["error"] = True

    sys.stdout = old_stdout
    print(json.dumps({"result": output}))
`;

        // Step 3: Ensure clean formatting and append
        return `${s.trim()}\n\n${mainBlock.trim()}\n`;
    };

    const notPublished = {
        "published": false,
        "function_version": "",
        "function_name": "",
        "path": "",
        "uri": ""
    };

    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [schema, setSchema] = useState('');
    const [publicationData, setPublicationData] = useState(notPublished);
    const [testJson, setTestJson] = useState('');
    const [validated, setValidated] = useState<boolean | null>(null);
    const [userFunctions, setUserFunctions] = useState<any[]>([]);
    const [loadingFunctions, setLoadingFunctions] = useState(true);
    const [selectedFnId, setSelectedFnId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [pendingFnToLoad, setPendingFnToLoad] = useState<any | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState('');
    const [testResults, setTestResults] = useState<{ [key: number]: { loading?: boolean, result?: any, isPass?: boolean } }>({});
    const [runningAllTests, setRunningAllTests] = useState(false);
    const [isGeneratingTestCase, setIsGeneratingTestCase] = useState(false);
    const [isGeneratingFunction, setIsGeneratingFunction] = useState(false);
    const runAllAbortRef = useRef(false);
    const [showInputPrompt, setShowInputPrompt] = useState(false);
    const [inputPromptMessage, setInputPromptMessage] = useState('');
    const [inputPromptResolve, setInputPromptResolve] = useState<((v: string|null) => void) | null>(null);
    const [inputPromptText, setInputPromptText] = useState('');
    const [availableIntegrations, setAvailableIntegrations] = useState<any[]>([]);
    const [publishPath, setPublishPath] = useState('');
    const [publishVersion, setPublishVersion] = useState('v1');
    const [assistantAccessible, setAssistantAccessible] = useState(true);
    const [access, setAccess] = useState<'public' | 'private'>('private');
    const [isPublishing, setIsPublishing] = useState(false);
    const [allowedGroups, setAllowedGroups] = useState<string[]>([]);
    const [newGroupInput, setNewGroupInput] = useState('');
    const [testCases, setTestCases] = useState<any[]>([]);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [groupedFunctions, setGroupedFunctions] = useState<Record<string, any[]>>({});
    const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({});
    const [loadingFunctionDetails, setLoadingFunctionDetails] = useState(false);
    const [dependencies, setDependencies] = useState('');

    useEffect(() => {
        getSession().then((session) => {
            // @ts-ignore
            setAccessToken(session.accessToken || null);
        });
    }, []);

    useEffect(() => {
      const groups: Record<string, any[]> = { All: [...userFunctions] };

      for (const fn of userFunctions) {
        const appTags = (fn.tags || []).filter((t: string) => t.startsWith("app:"));
        for (const tag of appTags) {
          const appName = tag.slice(4).trim();
          if (!groups[appName]) groups[appName] = [];
          groups[appName].push(fn);
        }
      }

      setGroupedFunctions(groups);
    }, [userFunctions]);

    const refreshUserIntegrations = async () => {
        const integrationSupport = await getAvailableIntegrations();
        if (integrationSupport && integrationSupport.success && integrationSupport.data) {

            const flatIntegrations = Object.entries(integrationSupport.data).flatMap(([provider, list]) =>
                // @ts-ignore
                list.map((item: any) => `${provider}/${item.name}`)
            );

            setAvailableIntegrations(flatIntegrations);
        }  else {
            alert("Unable to retrieve available integrations at this time. Please try again later.");
        }
    }

    useEffect(() => {
       refreshUserIntegrations();
    }, []);

    const [envVars, setEnvVars] = useState([{ type: 'Variable', key: '', value: '' }]);

    const getUserInput = (message: string): Promise<string | null> => {
        return new Promise((resolve) => {
            setInputPromptMessage(message);
            setInputPromptText('');
            setShowInputPrompt(true);
            setInputPromptResolve(() => resolve);
        });
    };
    const [newTestCase, setNewTestCase] = useState({
        name: '',
        description: '',
        inputJson: '',
        expectedOutput: '',
        matchType: 'exact' // 'exact' or 'llm'
    });
    const [editingTestCaseIndex, setEditingTestCaseIndex] = useState<number | null>(null);


    const updateNewTestCase = (newTestCase: any) => {
        setNewTestCase(newTestCase);
        setHasUnsavedChanges(true);
    }

    useEffect(() => {
        const loadFuncs = async () => {
            const response = await listUserFunctions();
            if (response.success) {
                const initialized = response.data.map((f: any) => ({...f, deleting: false}));
                setUserFunctions(initialized);

                const groups: Record<string, any[]> = { All: [...initialized] };

                for (const fn of initialized) {
                    const appTags = (fn.tags || []).filter((t: string) => t.startsWith("app:"));
                    for (const tag of appTags) {
                        const appName = tag.slice(4).trim(); // removes 'app:' prefix
                        if (!groups[appName]) groups[appName] = [];
                        groups[appName].push(fn);
                    }
                }

                setGroupedFunctions(groups);
                setExpandedApps(Object.fromEntries(Object.keys(groups).map(app => [app, true])));
                if (initialized.length > 0) {
                   await loadFunctionDetails(initialized[0]);
                }
            }
            setLoadingFunctions(false);
        }

        loadFuncs();
    }, []);



    const modalRef = useRef<HTMLDivElement>(null);

    const loadFunctionDetails = async (fn: any) => {
        setLoadingFunctionDetails(true);
        try {
            setSelectedFnId(fn.uuid);
            setName(fn.name);
            setDescription(fn.description)
            setSchema(JSON.stringify(fn.inputSchema ?? {}, null, 2));
            setTestCases(fn.testCases || []);
            setTags(fn.tags || [])

            setAllowedGroups(fn.metadata?.allowed_groups || []);
            setDependencies(fn.metadata?.dependencies || '');

            if(fn.metadata && fn.metadata.published){
                setPublicationData(fn.metadata.published);

                // version
                const apiPrefix = "/amp/api";
                const fullPath = fn.metadata.published.path || "";
                let path = fullPath;
                let version = "v1"
                if(fullPath && fullPath.indexOf(apiPrefix) > -1){
                    const start = fullPath.indexOf(apiPrefix) + apiPrefix.length;
                    const splitPath = fullPath.indexOf("/", start)
                    const splitPath2 = fullPath.indexOf("/", splitPath + 1)
                    version = fullPath.substring(splitPath, splitPath2);
                    path = fullPath.substring(splitPath2);

                    if(path.startsWith("/")){
                        path = path.substring(1);
                    }
                    if(version.startsWith("/")){
                        version = version.substring(1);
                    }

                    //alert("Version: " + version + " Path: " + path)
                }

                setPublishPath(path);
                setPublishVersion(version);
            } else {
                setPublicationData(notPublished);
            }

            try {

                const codeRes = await getFunctionCode(fn.uuid);
                if (codeRes.success && codeRes.data?.code !== undefined) {
                    setCode(codeRes.data.code);

                } else {
                    setCode('// Error: No code returned from backend.');
                }

            } catch (err) {
                setCode('// Error: Failed to fetch code.');
            }

            const envVarsFromMetadata: { type: string, key: string, value: string }[] = [];

            const envMeta = fn.metadata?.environment ?? {};
            const secrets = envMeta.secrets ?? {};
            const oauth = envMeta.oauth ?? {};
            const variables = envMeta.variables ?? {};

            for (const key in secrets) {
                envVarsFromMetadata.push({ type: 'Secret', key: key, value: secrets[key] });
            }
            for (const key in oauth) {
                envVarsFromMetadata.push({ type: 'OAuth Token', key, value: oauth[key] });
            }
            for (const key in variables) {
                envVarsFromMetadata.push({ type: 'Variable', key, value: variables[key] });
            }

            setEnvVars(envVarsFromMetadata.length > 0 ? envVarsFromMetadata : [{ type: 'Variable', key: '', value: '' }]);
        } finally {
            setLoadingFunctionDetails(false);
        }
    };


    const handleTest = () => {
        alert(`Simulating test run with input: ${testJson}`);
    };

    const handleSave = async () => {
        setSaving(true);
        setErrorMsg(null);
        try {
            const parsedSchema = JSON.parse(schema);
            const parsedTestCases = testCases.map(tc => {
                let inputJson = tc.inputJson;
                if (typeof inputJson === 'string') {
                    try {
                        inputJson = JSON.parse(inputJson);
                    } catch (e) {}
                }
                return {
                    name: tc.name,
                    description: tc.description,
                    inputJson,
                    expectedOutput: tc.expectedOutput,
                    matchType: tc.matchType || 'exact'
                };
            });

            type EnvStructure = {
                secrets: Record<string, string>;
                oauth: Record<string, string>;
                variables: Record<string, string>;
            };

            const env: EnvStructure = {
                secrets: {},
                oauth: {},
                variables: {}
            };
            envVars.forEach(({ type, key, value }) => {
                if (!key) return;
                if (type === 'Secret') {
                    env.secrets[key] = value;
                } else if (type === 'OAuth Token') {
                    env.oauth[key] = value;
                } else if (type === 'Amplify Variable') {
                    env.variables[key] = value;
                } else {
                    env.variables[key] = value;
                }
            });

            const cleanDependencies = dependencies.trim() === '' ? null : dependencies;

            const metadata = {
                environment: env,
                published: publicationData,
                allowed_groups: allowedGroups,
                dependencies: cleanDependencies
            };

            const oldFnId = selectedFnId;

            const res = await savePythonFunction({
                functionName: name,
                functionUuid: selectedFnId?.startsWith('new-') ? undefined : selectedFnId ?? undefined,
                code,
                description,
                inputSchema: parsedSchema,
                outputSchema: {},
                params: [],
                tags,
                testCases: parsedTestCases,
                metadata
            });

            if (!res.success) throw new Error(res.error || 'Failed to save function.');
            setHasUnsavedChanges(false);

            const fnUuid = res.data.uuid;

            // setUserFunctions(prev => prev.map(f => {
            //     if (f.uuid === oldFnId) {
            //         return {
            //             ...f,
            //             uuid: fnUuid
            //         };
            //     }
            //     return f;
            // }));
            setUserFunctions(prev =>
                prev.map(f => {
                    if (f.uuid === oldFnId) {
                        return {
                            ...f,
                            uuid: res.data.uuid,
                            name,
                            description,
                            inputSchema: JSON.parse(schema),
                            testCases,
                            tags,
                            metadata: {
                                ...f.metadata,
                                environment: metadata.environment,
                                published: metadata.published,
                                allowed_groups: metadata.allowed_groups,
                                dependencies: metadata.dependencies,
                            }
                        };
                    }
                    return f;
                })
            );

            setSelectedFnId(fnUuid);

            onSave({ name, code, schema, testJson });
        } catch (err: any) {
            setErrorMsg(err.message || 'An unknown error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    const handleNew = () => {
    const tempId = `new-${Date.now()}`;
    setSelectedFnId(tempId);
    const newFunction = {
        name: 'untitledFunction',
        description: '',
        inputSchema: {},
        testCases: [],
        tags: [],
        deleting: false,
        uuid: tempId
    };
    setUserFunctions(prev => [...prev, newFunction]);
        setName('untitledFunction');
        setDescription('');
        setCode('');
        setSchema('{"type":"object","properties":{}}');
        setTestCases([]);
        setTags([]);
        setTestJson('{}');
        setValidated(null);
        setErrorMsg(null);
        setHasUnsavedChanges(true);
    };

    return (
        <div className={`fixed inset-0 flex items-center justify-center ${blackoutBackground ? 'bg-black bg-opacity-50 z-50' : ''}`}>
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true" />
                    <div
                        className={`text-black dark:text-neutral-200 inline-block overflow-hidden ${blackoutBackground ? 'rounded-lg border border-gray-300 dark:border-neutral-600' : ''} bg-white pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#22232b] sm:my-8 sm:align-middle`}
                        ref={modalRef}
                        role="dialog"
                        style={{ transform: translateY ? `translateY(${translateY})` : '0', width }}
                    >
                        <div className="flex items-center justify-between px-6 pb-2">
                          <div id="pythonFunctionModalTitle" className="text-xl font-semibold">{title}</div>
                          <button
                            onClick={onCancel}
                            className="text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                            title="Close"
                          >
                            <span className="text-2xl leading-none">&times;</span>
                          </button>
                        </div>
                        <div className="flex" style={{ height }}>
                            <div className="w-1/3 border-r border-gray-300 dark:border-neutral-600 p-4 overflow-y-auto">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-sm font-bold">Functions</div>
                                    <button onClick={handleNew} title="Add New Function" className="hover:text-blue-600">
                                        <IconPlus size={18} />
                                    </button>
                                </div>
                                {loadingFunctions ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400">
                                        <IconLoader2 size={16} className="animate-spin" />
                                        Loading...
                                    </div>
                                ) : (<>
                                    {Object.entries(groupedFunctions).map(([appName, functions]) => (
                                            <div key={appName} className="mb-2">
                                                <div
                                                    className="flex justify-between items-center cursor-pointer font-semibold px-2 py-1 bg-gray-200 dark:bg-neutral-700 rounded"
                                                    onClick={() => setExpandedApps(prev => ({ ...prev, [appName]: !prev[appName] }))}
                                                >
                                                    <span>{appName}</span>
                                                    <span>{expandedApps[appName] ? "▾" : "▸"}</span>
                                                </div>
                                                {expandedApps[appName] && (
                                                    <div className="mt-1 ml-2">
                                                        {functions.map((fn:any, i:number) => (
                                                            <div
                                                                key={i}
                                                                className={`p-2 rounded cursor-pointer text-sm relative ${selectedFnId === fn.uuid ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                            >
                                                                <div
                                                                    onClick={() => {
                                                                        if (hasUnsavedChanges) {
                                                                            setPendingFnToLoad(fn);
                                                                        } else {
                                                                            loadFunctionDetails(fn);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="font-semibold">{fn.name}</div>
                                                                    <div className="text-xs text-gray-600 dark:text-gray-400">{fn.description}</div>
                                                                    {fn.params && fn.params.length > 0 && (
                                                                        <ul className="mt-1 ml-2 text-xs list-disc text-gray-500 dark:text-gray-400">
                                                                            {fn.params.map((p: any, idx: number) => (
                                                                                <li key={idx}><b>{p.name}</b>: {p.description}</li>
                                                                            ))}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                                {selectedFnId === fn.uuid && (
                                                                    confirmDeleteId === fn.uuid ? (
                                                                        <div className="absolute top-1 right-1 flex gap-1">
                                                                            <button
                                                                                className="text-green-600 hover:text-green-800"
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();
                                                                                    setHasUnsavedChanges(false);
                                                                                    if (fn.uuid && fn.uuid.startsWith("new-")) {
                                                                                        if (selectedFnId === fn.uuid) {
                                                                                            if (userFunctions.length > 1) {
                                                                                                await loadFunctionDetails(userFunctions[0]);
                                                                                            } else {
                                                                                                setSelectedFnId(null);
                                                                                                setDescription("")
                                                                                                setName("")
                                                                                                setEnvVars([])
                                                                                                setCode("")
                                                                                                setTestCases([])
                                                                                            }
                                                                                        }
                                                                                        setUserFunctions(prev => prev.filter(f => f.uuid !== fn.uuid));
                                                                                } else {
                                                                                        setUserFunctions(prev =>
                                                                                            prev.map(f =>
                                                                                                f.uuid === fn.uuid ? { ...f, deleting: true } : f
                                                                                            )
                                                                                        );
                                                                                        setConfirmDeleteId(null);
                                                                                        try {
                                                                                            const res = await deletePythonFunction(fn.uuid);
                                                                                            if (res.success) {
                                                                                                if (selectedFnId === fn.uuid) {
                                                                                                    if (userFunctions.length > 1) {
                                                                                                        await loadFunctionDetails(userFunctions[0]);
                                                                                                    } else {
                                                                                                        setSelectedFnId(null);
                                                                                                        setDescription("")
                                                                                                        setName("")
                                                                                                        setEnvVars([])
                                                                                                        setCode("")
                                                                                                        setTestCases([])
                                                                                                    }
                                                                                                }
                                                                                                setUserFunctions((prev) => prev.filter(f => f.uuid !== fn.uuid));
                                                                                            } else {
                                                                                                alert(res.error || 'Failed to delete function.');
                                                                                            }
                                                                                        } catch (err) {
                                                                                            alert('Error occurred while deleting.');
                                                                                            setUserFunctions(prev =>
                                                                                                prev.map(f =>
                                                                                                    f.uuid === fn.uuid ? { ...f, deleting: false } : f
                                                                                                )
                                                                                            );
                                                                                        }
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <IconCircleCheck size={18} />
                                                                            </button>
                                                                            <button
                                                                                className="text-red-600 hover:text-red-800"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setConfirmDeleteId(null);
                                                                                }}
                                                                            >
                                                                                <IconCircleX size={18} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                                                            title="Delete function"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setConfirmDeleteId(fn.uuid);
                                                                            }}
                                                                        >
                                                                            {fn.deleting ? (
                                                                                <IconLoader2 size={16} className="animate-spin" />
                                                                            ) : (
                                                                                <IconTrash size={16} />
                                                                            )}
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </>)}
                            </div>

                            <div className="w-2/3 p-4 overflow-y-auto">
                                {loadingFunctions || loadingFunctionDetails || selectedFnId === null ? (
                                <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-neutral-400 gap-2">
                                        <IconLoader2 size={16} className="animate-spin" />
                                        Loading function details...
                                </div>
                                ) : (
                                    <>
                                {errorMsg && <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded border border-red-300">{errorMsg}</div>}

                                <div className="flex justify-between items-center">
                                  <div className="text-sm font-bold">Function Name</div>
                                  <button
                                    className="px-3 py-2 border rounded text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                    disabled={isGeneratingFunction}
                                    onClick={async () => {
                                      setIsGeneratingFunction(true);
                                      const whatToDo = await getUserInput("What do you want the function to do?");
                                      if (whatToDo === null) {
                                        setIsGeneratingFunction(false);
                                        return;
                                      }

                                      const prompt = `
You're helping a developer create a Python function using this workflow UI.
Generate the following fields in a markdown code block in JSON format:
- name: short camel case identifier
- description: a 3-5 sentence summary of the function with key details listed
- code: a full Python function following the standard described below
- schema: a JSON schema matching the expected input for the function
- dependencies: a string in requirements.txt format of any needed dependencies
- tags: array of keywords
- environment: a JSON object with secrets, oauth, and variables as keys. Each one is a dict with key-value pairs. The keys are the names of the variables. Any secrets that you need should go into the secrets object. Any oauth tokens you will need should go into the oauth object. Any other variables should go into the oauth. If the user specifies things like a queue name, etc. that might change but aren't input, they should go into variables. Only fill in the values for variables.

For the code, write a Python script that follows this exact pattern:
\t•\tIt must define a main(event: dict) -> dict function. This function contains the core logic and returns a dictionary.
\t•\tThe script must accept a JSON string as a command-line argument, parse it into a Python dictionary called event, and pass it to the main function.
\t•\tIt must read any needed secrets, variables, or oauth tokens from os.environ['name_of_key'].

The harness that invokes the code will do this, so be aware of it:
\t•\tIt will redirect sys.stdout to an in-memory buffer using io.StringIO() before calling main.
\t•\tAny output printed inside main() (e.g., for logging/debugging) will be captured.
\t•\tAfter calling main, the script will:
\t1.\tAdd a new key "stdout" to the result dictionary, whose value is the captured printed output (stripped of trailing whitespace).
\t2.\tPrint the final dictionary as a JSON string to standard output.
\t•\tFinally, sys.stdout will be restored to its original state.


The structure or the code must look exactly like this:

\`\`\`python
#...other imports here...
import json
import sys
import io
import os

def main(event: dict) -> dict:
    # get any needed secrets / variables / oauth tokens from 
    # some_secret = os.environ['some_secret_key']
    # main logic here
    print("...log stuff to stdout inside of the main logic...")
    ...
    # All scripts must return a dict with keys containing the key outputs
    return {...some dict with keys...}

if __name__ == "__main__":
    output = main(event)
    
\`\`\`

Only the contents of main() should change depending on the task.

The function should:
${whatToDo}

Output only a markdown code block like this:
\`\`\`json
{
  "name": "<camel case name like 'summarizeText'>",
  "description": "This function summarizes text into 3 bullet points.",
  "code": "<the full Python function code using the rules described above>",
  "schema": { "type": "object", "properties": { ... } },
  "dependencies": "dep1\ndep2\n\etc\nrequirementstxtformat",
  "tags": ["text_manipulation","nlp","knowledge_extraction"],
}
\`\`\`
`;

                                      const raw = await doPrompt([newMessage({ content: prompt })]);
                                      const match = raw?.match(/```json([\s\S]*?)```/);
                                      if (!match) {
                                        alert("AI Generation failed. Please try again.");
                                        setIsGeneratingFunction(false);
                                        return;
                                      }

                                      try {

                                        const parsed = JSON.parse(match[1]);

                                        const code = postProcessPythonFunction(parsed.code || "");
                                        setName(parsed.name || '');
                                        setDescription(parsed.description || '');
                                        setCode(code);
                                        setSchema(JSON.stringify(parsed.schema ?? {}, null, 2));
                                        setTags(Array.isArray(parsed.tags) ? parsed.tags : []);
                                        setDependencies(parsed.dependencies);
                                        setHasUnsavedChanges(true);

                                        const environment = parsed.environment;
                                        const envVarsFromGenerated:
                                          | ((
                                              prevState: {
                                                type: string;
                                                key: string;
                                                value: string;
                                              }[],
                                            ) => {
                                              type: string;
                                              key: string;
                                              value: string;
                                            }[])
                                          | {
                                              type: string;
                                              key: string;
                                              value: any;
                                            }[] = [];
                                      
                                        Object.entries(environment.secrets || {}).forEach(([key]) => {
                                          envVarsFromGenerated.push({ type: 'Secret', key, value: environment.secrets[key] });
                                        });

                                        Object.entries(environment.oauth || {}).forEach(([key]) => {
                                          envVarsFromGenerated.push({ type: 'OAuth Token', key, value: environment.oauth[key] });
                                        });

                                        Object.entries(environment.variables || {}).forEach(([key]) => {
                                          envVarsFromGenerated.push({ type: 'Variable', key, value: environment.variables[key] });
                                        });

                                        setEnvVars(envVarsFromGenerated.length > 0 ? envVarsFromGenerated : [{ type: 'Variable', key: '', value: '' }]);
                                        setHasUnsavedChanges(true);

                                      } catch (e) {
                                        alert("Failed to parse response.");
                                      }

                                      setIsGeneratingFunction(false);
                                    }}
                                  >
                                    {isGeneratingFunction && <IconLoader2 className="animate-spin" size={16} />}
                                    AI Generate Function
                                  </button>
                                </div>
                                <input
                                    className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 shadow dark:bg-[#40414F] dark:text-neutral-100"
                                    placeholder='Name of the function'
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setHasUnsavedChanges(true);
                                    }}
                                    disabled={saving}
                                />
                            {selectedFnId && (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Function ID: {selectedFnId}
                              </div>
                            )}
                                {publicationData && publicationData.published && (
                                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Published API: {publicationData.uri}
                                    </div>
                                )}
                                <div className="mt-4">
                                    <div className="text-sm font-bold mb-1">Tags</div>
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
                                                        setHasUnsavedChanges(true);
                                                    }
                                                    setNewTagInput('');
                                                }
                                            }}
                                        />
                                        <button
                                            className="text-gray-600 hover:text-black dark:hover:text-white"
                                            onClick={() => {
                                                if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
                                                    setTags([...tags, newTagInput.trim()]);
                                                    setHasUnsavedChanges(true);
                                                }
                                                setNewTagInput('');
                                            }}
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
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                >
                                                    <IconCircleX size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="text-sm font-bold mb-1">Groups That Can Invoke</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Add a group..."
                                            className="flex-grow rounded-lg border border-neutral-500 px-3 py-1 dark:bg-[#40414F] dark:text-neutral-100"
                                            value={newGroupInput}
                                            onChange={(e) => setNewGroupInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newGroupInput.trim()) {
                                                    e.preventDefault();
                                                    if (!allowedGroups.includes(newGroupInput.trim())) {
                                                        setAllowedGroups([...allowedGroups, newGroupInput.trim()]);
                                                        setHasUnsavedChanges(true);
                                                    }
                                                    setNewGroupInput('');
                                                }
                                            }}
                                        />
                                        <button
                                            className="text-gray-600 hover:text-black dark:hover:text-white"
                                            onClick={() => {
                                                if (newGroupInput.trim() && !allowedGroups.includes(newGroupInput.trim())) {
                                                    setAllowedGroups([...allowedGroups, newGroupInput.trim()]);
                                                    setHasUnsavedChanges(true);
                                                }
                                                setNewGroupInput('');
                                            }}
                                        >
                                            <IconPlus size={20} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap mt-2 gap-2">
                                        {allowedGroups.map((group, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center bg-gray-200 dark:bg-neutral-600 text-sm font-medium px-3 py-1 rounded-full"
                                            >
                                                <span>{group}</span>
                                                <button
                                                    className="ml-2 text-gray-700 hover:text-red-600 dark:text-white dark:hover:text-red-400"
                                                    onClick={() => {
                                                        setAllowedGroups(allowedGroups.filter((g) => g !== group));
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                >
                                                    <IconCircleX size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-6 text-sm font-bold">Description</div>
                                <PromptTextArea
                                    rootPromptText={`Generate a helpful description for the following Python function that starts with 'This function...':\n\n${code}`}
                                    generateButtonText="Generate Description from Code"
                                    promptTemplateString={`Write a short, helpful description for this Python function:\n\n{{code}}`}
                                    temperature={0.7}
                                    value={description}
                                    onChange={(val) => {setDescription(val);setHasUnsavedChanges(true);}}
                                />

                                <div className="mt-6 text-sm font-bold">Dependencies (requirements.txt)</div>
                                <textarea
                                    className="w-full border rounded p-2 text-sm dark:bg-neutral-800 dark:text-white"
                                    value={dependencies}
                                    onChange={(e) => {
                                        setDependencies(e.target.value);
                                        setHasUnsavedChanges(true);
                                    }}
                                    rows={4}
                                    placeholder="e.g. requests==2.28.1"
                                    spellCheck={false}
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                />

                                <div className="mt-6 text-sm font-bold">Python Code</div>
                                <PromptTextArea
                                    rootPromptText={`${codeGenPrompt} \nWhat the main function should do:\n${description}`}
                                    generateButtonText="Generate Code from Description"
                                    promptTemplateString={`${codeGenPrompt} \nWhat the main function should do:\n${description}`}
                                    temperature={0.7}
                                    placeholder='Paste your Python function here'
                                    value={code}
                                    rows={10}
                                    postProcessor={postProcessPythonFunction}
                                    codeLanguage="python"
                                    markdownBlockType="python"
                                    onChange={(e) => {setCode(e);setHasUnsavedChanges(true);}}
                                />
                                <button
                                  className="mt-2 px-3 py-2 border rounded text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                  disabled={!selectedFnId}
                                  onClick={async () => {
                                      alert("Add a test case below to try out the function.")
                                  }}
                                >
                                  Try It
                                </button>

                                <div className="mt-6 text-sm font-bold">JSON Schema</div>
                                <PromptTextArea
                                    rootPromptText={`You must output the schema in a json markdown block.`}
                                    generateButtonText="Generate Schema from Code"
                                    promptTemplateString={`Generate a json schema in a \`\`\`json markdown block that matches the expected input for the main function:\n\n${code}`}
                                    temperature={0.7}
                                    placeholder='Paste your Python function here'
                                    value={schema}
                                    rows={6}
                                    codeLanguage="json"
                                    markdownBlockType="json"
                                    onChange={(e) => {setSchema(e);setHasUnsavedChanges(true);}}
                                />


                                <div className="mt-6">
                                    <div className="text-sm font-bold mb-2">Environment Variables</div>

                                    {envVars.map((env, index) => (
                                        <div key={index} className="grid grid-cols-3 gap-2 mb-2 items-center">

                                            <div className="flex flex-row">
                                            <button
                                                className="text-gray-600 hover:text-red-600 dark:text-white dark:hover:text-red-400 ml-2"
                                                onClick={() => {
                                                    const newVars = envVars.filter((_, i) => i !== index);
                                                    setEnvVars(newVars);
                                                    setHasUnsavedChanges(true);
                                                }}
                                                title="Remove"
                                            >
                                                <IconCircleX size={24} />
                                            </button>

                                            <select
                                                className="ml-2 border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                                value={env.type}
                                                onChange={(e) => {
                                                    const newVars = [...envVars];
                                                    newVars[index].type = e.target.value;
                                                    newVars[index].value = ''; // reset value on type change
                                                    setEnvVars(newVars);
                                                    setHasUnsavedChanges(true);
                                                }}
                                            >
                                                <option value="OAuth Token">OAuth Token</option>
                                                <option value="Secret">Secret</option>
                                                <option value="Variable">Variable</option>
                                                <option value="Amplify Variable">Amplify Variable</option>
                                            </select>
                                            </div>
                                            <input
                                                className="border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                                placeholder="Key"
                                                value={env.key}
                                                onChange={(e) => {
                                                    const newVars = [...envVars];
                                                    newVars[index].key = e.target.value;
                                                    setEnvVars(newVars);
                                                    setHasUnsavedChanges(true);
                                                }}
                                            />
                                    {env.type === 'OAuth Token' ? (
                                      <select
                                        className="border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                        value={env.value}
                                        onChange={(e) => {
                                          const newVars = [...envVars];
                                          newVars[index].value = e.target.value;
                                          setEnvVars(newVars);
                                          setHasUnsavedChanges(true);
                                        }}
                                      >
                                        <option value="">Select Integration</option>
                                        {availableIntegrations.map((intg, i) => (
                                          <option key={i} value={intg}>{intg}</option>
                                        ))}
                                      </select>
                                    ) : env.type === 'Amplify Variable' ? (
                                      <select
                                        className="border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                        value={env.value}
                                        onChange={(e) => {
                                          const newVars = [...envVars];
                                          newVars[index].value = e.target.value;
                                          setEnvVars(newVars);
                                          setHasUnsavedChanges(true);
                                        }}
                                      >
                                        <option value="">Select Amplify Variable</option>
                                        <option value="@amp_current_user">Current User</option>
                                        <option value="@amp_access_token">Amplify Token</option>
                                        <option value="@amp_session_id">Session ID</option>
                                        <option value="@amp_conversation_id">Conversation ID</option>
                                        <option value="@amp_assistant_id">Assistant ID</option>
                                      </select>
                                    ) : env.type === 'Secret' ? (
                                      <input
                                        type="password"
                                        className="border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                        placeholder="Secret value"
                                        value={env.value}
                                        onChange={(e) => {
                                          const newVars = [...envVars];
                                          newVars[index].value = e.target.value;
                                          setEnvVars(newVars);
                                          setHasUnsavedChanges(true);
                                        }}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        className="border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                        placeholder="Value"
                                        value={env.value}
                                        onChange={(e) => {
                                          const newVars = [...envVars];
                                          newVars[index].value = e.target.value;
                                          setEnvVars(newVars);
                                          setHasUnsavedChanges(true);
                                        }}
                                      />
                                    )}

                                        </div>
                                    ))}
                                    <button
                                        className="mt-1 text-sm text-blue-600 hover:underline"
                                        onClick={() => {
                                            setEnvVars([...envVars, { type: 'Variable', key: '', value: '' }]);
                                            setHasUnsavedChanges(true);
                                        }}
                                    >
                                        + Add Environment Variable
                                    </button>
                                </div>
                                <div className="mt-6 text-sm font-bold">Test Case</div>
                                <div className="mt-2 grid grid-cols-2 gap-4">
                                    <input
                                        className="col-span-2 rounded-lg border border-neutral-500 px-4 py-2 shadow dark:bg-[#40414F] dark:text-neutral-100"
                                        placeholder="Test case name"
                                        value={newTestCase.name}
                                        onChange={(e) => updateNewTestCase({ ...newTestCase, name: e.target.value })}
                                    />
                                    <textarea
                                        className="col-span-2 rounded-lg border border-neutral-500 px-4 py-2 shadow dark:bg-[#40414F] dark:text-neutral-100"
                                        placeholder="Description"
                                        rows={2}
                                        value={newTestCase.description}
                                        onChange={(e) => updateNewTestCase({ ...newTestCase, description: e.target.value })}
                                    />
                                    <textarea
                                        className="col-span-2 rounded-lg border border-neutral-500 px-4 py-2 shadow dark:bg-[#40414F] dark:text-neutral-100 font-mono"
                                        placeholder="Input JSON"
                                        rows={3}
                                        value={newTestCase.inputJson}
                                        onChange={(e) => updateNewTestCase({ ...newTestCase, inputJson: e.target.value })}
                                    />
                                    <div className="col-span-2 flex gap-4 items-center">
                                        <label className="text-sm font-semibold">Match Type:</label>
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                value="exact"
                                                checked={newTestCase.matchType === 'exact'}
                                                onChange={() => updateNewTestCase({ ...newTestCase, matchType: 'exact' })}
                                            />
                                            Exact match
                                        </label>
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                value="llm"
                                                checked={newTestCase.matchType === 'llm'}
                                                onChange={() => updateNewTestCase({ ...newTestCase, matchType: 'llm' })}
                                            />
                                            Check with LLM
                                        </label>
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                value="subset"
                                                checked={newTestCase.matchType === 'subset'}
                                                onChange={() => updateNewTestCase({ ...newTestCase, matchType: 'subset' })}
                                            />
                                            Subset match
                                        </label>
                                    </div>
                                    <textarea
                                        className="col-span-2 rounded-lg border border-neutral-500 px-4 py-2 shadow dark:bg-[#40414F] dark:text-neutral-100 font-mono"
                                        placeholder="Expected output (JSON or prompt text)"
                                        rows={3}
                                        value={newTestCase.expectedOutput}
                                        onChange={(e) => updateNewTestCase({ ...newTestCase, expectedOutput: e.target.value })}
                                    />
                                    <div className="col-span-2 flex flex-wrap gap-2">
                                        <button
                                            className="px-3 py-2 border rounded text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                            onClick={() => {
                                                setHasUnsavedChanges(true);
                                                if (editingTestCaseIndex !== null) {
                                                    const updatedCases = [...testCases];
                                                    updatedCases[editingTestCaseIndex] = newTestCase;
                                                    setTestCases(updatedCases);
                                                } else {
                                                    setTestCases([...testCases, newTestCase]);
                                                }

                                                let inputJson = '';
                                                try {
                                                    const parsedSchema = JSON.parse(schema);
                                                    if (parsedSchema?.type === 'object' && parsedSchema?.properties) {
                                                        const skeleton: any = {};
                                                        for (const key of Object.keys(parsedSchema.properties)) {
                                                            const prop = parsedSchema.properties[key];
                                                            if (prop.type === 'string') skeleton[key] = '';
                                                            else if (prop.type === 'number' || prop.type === 'integer') skeleton[key] = 0;
                                                            else if (prop.type === 'boolean') skeleton[key] = false;
                                                            else if (prop.type === 'array') skeleton[key] = [];
                                                            else if (prop.type === 'object') skeleton[key] = {};
                                                            else skeleton[key] = null;
                                                        }
                                                        inputJson = JSON.stringify(skeleton, null, 2);
                                                    }
                                                } catch (e) {
                                                    inputJson = '';
                                                }

                                                setNewTestCase({
                                                    name: '',
                                                    description: '',
                                                    inputJson,
                                                    expectedOutput: '',
                                                    matchType: 'exact'
                                                });
                                                setEditingTestCaseIndex(null);
                                            }}
                                        >
                                            {editingTestCaseIndex !== null ? 'Save Test Case' : 'Add Test Case'}
                                        </button>
                                        {editingTestCaseIndex !== null && (
                                            <button
                                                className="px-3 py-2 border rounded text-sm text-red-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                                onClick={() => {
                                                    setEditingTestCaseIndex(null);
                                                    let inputJson = '';
                                                    try {
                                                        const parsedSchema = JSON.parse(schema);
                                                        if (parsedSchema?.type === 'object' && parsedSchema?.properties) {
                                                            const skeleton: any = {};
                                                            for (const key of Object.keys(parsedSchema.properties)) {
                                                                const prop = parsedSchema.properties[key];
                                                                if (prop.type === 'string') skeleton[key] = '';
                                                                else if (prop.type === 'number' || prop.type === 'integer') skeleton[key] = 0;
                                                                else if (prop.type === 'boolean') skeleton[key] = false;
                                                                else if (prop.type === 'array') skeleton[key] = [];
                                                                else if (prop.type === 'object') skeleton[key] = {};
                                                                else skeleton[key] = null;
                                                            }
                                                            inputJson = JSON.stringify(skeleton, null, 2);
                                                        }
                                                    } catch (e) {
                                                        inputJson = '';
                                                    }

                                                    setNewTestCase({
                                                        name: '',
                                                        description: '',
                                                        inputJson,
                                                        expectedOutput: '',
                                                        matchType: 'exact'
                                                    });
                                                }}
                                            >
                                                Cancel Edit
                                            </button>
                                        )}
                                        <button
                                            className="px-3 py-2 border rounded text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                            disabled={isGeneratingTestCase}
                                            onClick={() => {

                                                const testCaseCreator = async () => {
                                                    setIsGeneratingTestCase(true);

                                                    const whatToDo = await getUserInput("What do you want the test case to do? Leave this blank if you want me to think up the test on my own.");

                                                    if(whatToDo === null) {
                                                        setIsGeneratingTestCase(false);
                                                        return;
                                                    }

                                                    const raw = await promptForTestCase(doPrompt, { code, testCases }, whatToDo);
                                                    if (!raw) {
                                                        setIsGeneratingTestCase(false);
                                                        return;
                                                    }

                                                    const match = raw.match(/```json([\s\S]*?)```/);
                                                    if (!match) {
                                                        alert("No JSON block found in response.");
                                                        setIsGeneratingTestCase(false);
                                                        return;
                                                    }

                                                    try {
                                                        const parsed = JSON.parse(match[1]);

                                                        setNewTestCase({
                                                            name: parsed.name || '',
                                                            description: parsed.description || '',
                                                            inputJson: typeof parsed.inputJson === 'string' ? parsed.inputJson : JSON.stringify(parsed.inputJson, null, 2),
                                                            expectedOutput: typeof parsed.expectedOutput === 'string' ? parsed.expectedOutput : JSON.stringify(parsed.expectedOutput, null, 2),
                                                            matchType: parsed.matchType || 'exact'
                                                        });
                                                        setEditingTestCaseIndex(null);
                                                    } catch (e) {
                                                        alert("Failed to parse JSON test case.");
                                                    }

                                                    setIsGeneratingTestCase(false);
                                                };
                                                testCaseCreator();
                                            }}
                                        >
                                            {isGeneratingTestCase && <IconLoader2 className="animate-spin" size={16} />}
                                            AI Generate Test Case
                                        </button>
                                    </div>
                                </div>
                                {testCases.length > 0 && (
                                    <div className="mt-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="text-sm font-bold">Test Cases</div>
                                            <button
                                                className="px-3 py-1 border rounded text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                                onClick={async () => {
                                                    if (runningAllTests) {
                                                        runAllAbortRef.current = true;
                                                        return;
                                                    }
                                                    setRunningAllTests(true);
                                                    runAllAbortRef.current = false;
                                                    for (let idx = 0; idx < testCases.length; idx++) {
                                                        if (runAllAbortRef.current) break;
                                                        const tc = testCases[idx];
                                                        setTestResults(prev => ({ ...prev, [idx]: { loading: true } }));
                                                        try {
                                                            const response = await executePythonFunction({
                                                                function_uuid: selectedFnId!,
                                                                payload: typeof tc.inputJson === 'string'
                                                                    ? JSON.parse(tc.inputJson)
                                                                    : tc.inputJson
                                                            });

                                                            let actualResult = {};
                                                            if (!response.data || !response.data.result) {
                                                                actualResult = response;
                                                            } else {
                                                                actualResult = response.data.result;
                                                            }

                                                            const expected = tc.expectedOutput;
                                                            let isPass = false;

                                                            if (tc.matchType === 'exact') {
                                                                try {
                                                                    isPass = JSON.stringify(actualResult) === JSON.stringify(JSON.parse(expected));
                                                                } catch (e) {
                                                                    isPass = false;
                                                                }
                                                            } else if (tc.matchType === 'subset') {
                                                                try {
                                                                    const expectedObj = typeof expected === 'string' ? JSON.parse(expected) : expected;
                                                                    isPass = Object.entries(expectedObj).every(([k, v]) =>
                                                                        // @ts-ignore
                                                                        JSON.stringify(actualResult?.[k]) === JSON.stringify(v)
                                                                    );
                                                                } catch (e) {
                                                                    isPass = false;
                                                                }
                                                            }

                                                            setTestResults(prev => ({ ...prev, [idx]: { result: response, isPass } }));
                                                        } catch (err) {
                                                            setTestResults(prev => ({ ...prev, [idx]: { result: { error: 'Execution failed' }, isPass: false } }));
                                                        }
                                                    }
                                                    setRunningAllTests(false);
                                                }}
                                            >
                                                {runningAllTests ? (
                                                    <>
                                                        <IconLoader2 className="animate-spin" size={16} />
                                                        Stop
                                                    </>
                                                ) : (
                                                    'Run All'
                                                )}
                                            </button>
                                        </div>
                                        {testCases.map((tc, idx) => (
                                            <div key={idx} className="border border-neutral-400 rounded p-2 mb-2 dark:bg-[#333]">
                                            <div className="font-semibold">{tc.name}</div>
                                            <div className="text-xs text-gray-500 mt-1">{tc.description}</div>
                                                <div className="mt-1 text-xs whitespace-pre-wrap">
                                                    <b>Input:</b> <pre>{typeof tc.inputJson === 'string' ? tc.inputJson : JSON.stringify(tc.inputJson, null, 2)}</pre>
                                                    <b>Expected Output ({
                                                        tc.matchType === 'llm' ? 'LLM check' :
                                                        tc.matchType === 'subset' ? 'Subset match' :
                                                        'Exact match'
                                                    }):</b>
                                                    <pre>{tc.expectedOutput}</pre>
                                                </div>
                                                {testResults[idx]?.loading ? (
                                                    <div className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                                                        <IconLoader2 className="animate-spin" size={16} /> Running test...
                                                    </div>
                                                ) : testResults[idx]?.result && (
                                                    <div className="mt-2 text-sm">
                                                        {(() => {

                                                            return (
                                                                <>
                                                                    {(tc.matchType === 'exact' || tc.matchType === 'subset') && testResults[idx]?.isPass !== null && (
                                                                        <div className={`flex items-center gap-2 font-semibold ${testResults[idx].isPass ? 'text-green-600' : 'text-red-600'}`}>
                                                                            {testResults[idx].isPass ? <IconCircleCheck size={18} /> : <IconCircleX size={18} />}
                                                                            {testResults[idx].isPass ? 'Passed' : 'Failed'}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between items-center">
                                                                      <div className="font-semibold">Result:</div>
                                                                      {testResults[idx]?.result && (
                                                                        <button
                                                                          className="text-xs text-blue-600 hover:underline"
                                                                          onClick={() => {
                                                                            const newTestCases = [...testCases];
                                                                            const newExpected = JSON.stringify(testResults[idx].result.data?.result ?? testResults[idx].result, null, 2);
                                                                            newTestCases[idx] = {
                                                                              ...newTestCases[idx],
                                                                              expectedOutput: newExpected,
                                                                              matchType: 'exact'
                                                                            };
                                                                            setTestCases(newTestCases);
                                                                            setHasUnsavedChanges(true);
                                                                          }}
                                                                        >
                                                                          Make Expected
                                                                        </button>
                                                                      )}
                                                                    </div>
                                                                    <pre className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded whitespace-pre-wrap break-words">
            {JSON.stringify(testResults[idx].result.data?.result ?? testResults[idx].result, null, 2)}
        </pre>
                                                                </>
                                                            );
                                                        })()}

                                                        {testResults[idx].result.data?.result?.stdout && (
                                                            <details className="mt-2">
                                                                <summary className="cursor-pointer text-blue-500">View Logs</summary>
                                                                <pre className="bg-black text-white p-2 rounded mt-1 whitespace-pre-wrap text-xs">
                    {testResults[idx].result.data.result.stdout}
                </pre>
                                                            </details>
                                                        )}

                                                        {testResults[idx].result.data?.result?.error && typeof testResults[idx].result.data.result.error === 'string' && (
                                                            <div className="text-red-500 text-xs mt-1">
                                                                {testResults[idx].result.data.result.error}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex justify-end mt-2 gap-2">
                                                    <button
                                                        className="text-xs text-green-600 hover:underline"
                                                        onClick={async () => {
                                                            setTestResults(prev => ({ ...prev, [idx]: { loading: true } }));
                                                            try {
                                                                const response = await executePythonFunction({
                                                                    function_uuid: selectedFnId!,
                                                                    payload: typeof tc.inputJson === 'string'
                                                                        ? JSON.parse(tc.inputJson)
                                                                        : tc.inputJson
                                                                });


                                                                let actualResult = {};
                                                                // Check if "data" key is missing from result
                                                                if (!response.data || !response.data.result) {
                                                                   actualResult = response;
                                                                }
                                                                else {
                                                                    actualResult = response.data.result;
                                                                }


                                                                const expected = tc.expectedOutput;
                                                                let isPass = false;

                                                                if (tc.matchType === 'exact') {
                                                                    try {
                                                                        isPass = JSON.stringify(actualResult) === JSON.stringify(JSON.parse(expected));
                                                                    } catch (e) {
                                                                        isPass = false;
                                                                    }
                                                                } else if (tc.matchType === 'subset') {
                                                                    try {
                                                                        const expectedObj = typeof expected === 'string' ? JSON.parse(expected) : expected;


                                                                        isPass = Object.entries(expectedObj).every(([k, v]) =>
                                                                            // @ts-ignore
                                                                            JSON.stringify(actualResult?.[k]) === JSON.stringify(v)
                                                                        );
                                                                    } catch (e) {
                                                                        isPass = false;
                                                                    }
                                                                }

                                                                setTestResults(prev => ({ ...prev, [idx]: { result: response, isPass } }));
                                                            } catch (err) {
                                                                setTestResults(prev => ({ ...prev, [idx]: { result: { error: 'Execution failed' }, isPass: false } }));
                                                            }
                                                        }}
                                                    >
                                                        Run
                                                    </button>
                                                    {publicationData && publicationData.published && (
                                                        <button
                                                            className="text-xs text-blue-600 hover:underline ml-2"
                                                    onClick={() => {
                                                        if (!accessToken) {
                                                            alert("Access token not available.");
                                                            return;
                                                        }
                                                        const input = typeof tc.inputJson === 'string' ? JSON.parse(tc.inputJson) : tc.inputJson;
                                                        const curlCommand = `curl -X POST '${publicationData.uri}' \\
 -H 'Authorization: Bearer ${accessToken}' \\
 -H 'Content-Type: application/json' \\
 -d '${JSON.stringify({ data: input }, null, 2)}'`;
                                                        navigator.clipboard.writeText(curlCommand)
                                                            .then(() => alert("cURL command copied to clipboard!"))
                                                            .catch((err) => {
                                                                alert("Failed to copy cURL command.");
                                                                console.error(err);
                                                            });
                                                    }}
                                                                >
                                                                Copy cURL
                                                        </button>
                                                                )}
                                                    <button
                                                        className="text-xs text-blue-600 hover:underline"
                                                    onClick={() => {
                                                        setNewTestCase({
                                                            ...tc,
                                                            inputJson: typeof tc.inputJson === 'string' ? tc.inputJson : JSON.stringify(tc.inputJson, null, 2)
                                                        });
                                                        setEditingTestCaseIndex(idx);
                                                    }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="text-xs text-red-600 hover:underline"
                                                        onClick={() => {
                                                            setHasUnsavedChanges(true);
                                                            setTestCases(testCases.filter((_, i) => i !== idx));
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <h2 className="text-md font-semibold mt-4 mb-2">Publish Function</h2>
                                <div className="border rounded p-4 space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Path</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                            placeholder="e.g. cars/list"
                                            value={publishPath}
                                            onChange={(e) => setPublishPath(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Version</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                            value={publishVersion}
                                            onChange={(e) => setPublishVersion(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={assistantAccessible}
                                            onChange={(e) => setAssistantAccessible(e.target.checked)}
                                        />
                                        <label className="text-sm">Assistant Accessible</label>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Access</label>
                                        <select
                                            className="w-full border rounded p-2 dark:bg-[#40414F] dark:text-white"
                                            value={access}
                                            //@ts-ignore
                                            onChange={(e) => setAccess(e.target.value)}
                                            
                                        >   {featureFlags.publicizePythonFunctionApis && 
                                              <option value="public">Public</option>
                                            }
                                              <option value="private">Private</option>
                                           
                                        </select>
                                    </div>

                                    <button
                                        className="mt-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                        disabled={isPublishing}
                                        onClick={async () => {
                                            if (!selectedFnId || !publishPath) {
                                                alert("Please ensure the function has been saved with a path name and is selected.");
                                                return;
                                            }
                                            setIsPublishing(true);
                                            try {

                                                let fpath = publishPath.replace(/[^a-zA-Z0-9\/\-_]/g, '');
                                                if(publishPath.startsWith("/")){
                                                    fpath = publishPath.substring(1)
                                                }
                                                // Remove all non alphanumeric characters
                                                let fv = publishVersion.replace(/[^a-zA-Z0-9]/g, '');

                                                const pubinfo = await publishFunction(selectedFnId, fpath, fv, assistantAccessible, access);
                                                if(pubinfo.success) {
                                                    setPublicationData({...pubinfo.data, published: true})

                                                    await handleSave();

                                                    toast("Function published successfully.");
                                                }
                                                else {
                                                    alert("Failed to publish function: "+ pubinfo.message);
                                                }
                                            } catch (err) {
                                                //@ts-ignore
                                                alert("Failed to publish: " + (err?.message || err.toString()));
                                            } finally {
                                                setIsPublishing(false);
                                            }
                                        }}
                                    >
                                        {isPublishing ? "Publishing..." : "Publish Function"}
                                    </button>
                                </div>
                                </>)}
                            </div>
                        </div>

                        <div className="flex flex-row items-center justify-end p-4 bg-white dark:bg-[#22232b]">
                            <button
                                className="px-4 py-2 border rounded-lg shadow text-neutral-900 hover:bg-neutral-100 dark:bg-white dark:text-black dark:hover:bg-neutral-300 disabled:opacity-50 flex items-center gap-2"
                                onClick={handleSave}
                                disabled={saving || !hasUnsavedChanges}
                            >
                                {saving ? <IconLoader2 className="animate-spin" size={16} /> : null}
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {hasUnsavedChanges && pendingFnToLoad && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-[#333] p-6 rounded-lg shadow-md text-center w-full max-w-md mx-auto border border-gray-300 dark:border-neutral-700">
                        <p className="mb-4 text-sm text-gray-800 dark:text-white">
                            You have unsaved changes. Do you want to discard them and switch functions?
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                onClick={() => {
                                    setHasUnsavedChanges(false);
                                    loadFunctionDetails(pendingFnToLoad);
                                    setPendingFnToLoad(null);
                                }}
                            >
                                Discard and Switch
                            </button>
                            <button
                                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400"
                                onClick={() => setPendingFnToLoad(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showInputPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-[#333] p-6 rounded-lg shadow-md text-center w-full max-w-md mx-auto border border-gray-300 dark:border-neutral-700">
                        <p className="mb-4 text-sm text-gray-800 dark:text-white">{inputPromptMessage}</p>
                        <textarea
                            className="w-full h-24 border border-gray-300 dark:border-gray-600 rounded p-2 mb-4 dark:bg-neutral-800 dark:text-white"
                            placeholder="Enter your message here..."
                            value={inputPromptText}
                            onChange={(e) => setInputPromptText(e.target.value)}
                        />
                        <div className="flex justify-center gap-4">
                            <button
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                onClick={() => {
                                    inputPromptResolve?.(inputPromptText);
                                    setShowInputPrompt(false);
                                }}
                            >
                                Send
                            </button>
                            <button
                                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400"
                                onClick={() => {
                                    inputPromptResolve?.(null);
                                    setShowInputPrompt(false);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
