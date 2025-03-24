import {FC, useState, useRef, useEffect, useContext} from 'react';
import {
    IconCircleCheck,
    IconCircleX,
    IconCode,
    IconUpload,
    IconPlaystationCircle,
    IconPlus,
    IconTrash,
    IconLoader2
} from '@tabler/icons-react';
import {
    listUserFunctions,
    getFunctionCode,
    getFunctionMetadata,
    savePythonFunction,
    executePythonFunction
} from '@/services/softwareEngineerService';
import { createRoot } from 'react-dom/client';
import PromptTextArea from "@/components/PromptTextArea/PromptTextArea";
import {ChatBody, Message, newMessage} from "@/types/chat";
import {Model} from "@/types/model";
import {useChatService} from "@/hooks/useChatService";
import HomeContext from "@/pages/api/home/home.context";
import {filterModels} from "@/utils/app/models";
import {getSettings} from "@/utils/app/settings";


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
        `;

    return await doPrompt([newMessage({content: prompt})]);
}



export const PythonFunctionModal: FC<Props> = ({
                                                   onSave,
                                                   onCancel,
                                                   title = 'Manage Custom APIs',
                                                   width = '900px',
                                                   height = '80vh',
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

    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [schema, setSchema] = useState('');
    const [testJson, setTestJson] = useState('');
    const [validated, setValidated] = useState<boolean | null>(null);
    const [userFunctions, setUserFunctions] = useState<any[]>([]);
    const [loadingFunctions, setLoadingFunctions] = useState(true);
    const [selectedFnId, setSelectedFnId] = useState<string | null>(null);
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

    const [testCases, setTestCases] = useState<any[]>([]);

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
        listUserFunctions().then((response) => {
            if (response.success){
                setUserFunctions(response.data);
            }
            setLoadingFunctions(false);
        });
    }, []);

    const modalRef = useRef<HTMLDivElement>(null);

    const loadFunctionDetails = async (fn: any) => {

        setSelectedFnId(fn.uuid);
        setName(fn.name);
        setDescription(fn.description)
        setSchema(JSON.stringify(fn.inputSchema ?? {}, null, 2));
        setTestCases(fn.testCases || []);

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

            const res = await savePythonFunction({
                functionName: name,
                functionUuid: selectedFnId || undefined,
                code,
                description,
                inputSchema: parsedSchema,
                outputSchema: {},
                params: [],
                tags,
                testCases: parsedTestCases
            });

            if (!res.success) throw new Error(res.error || 'Failed to save function.');
            setHasUnsavedChanges(false);
            const fnUuid = res.uuid || selectedFnId;
            const index = userFunctions.findIndex(f => f.uuid === fnUuid);
            if (index !== -1) {
                const newFunctions = [...userFunctions];
                newFunctions[index] = {
                    ...userFunctions[index],
                    name,
                    description,
                    inputSchema: JSON.parse(schema),
                    testCases: parsedTestCases,
                    tags
                };
                setUserFunctions(newFunctions);
            }
            onSave({ name, code, schema, testJson });
        } catch (err: any) {
            setErrorMsg(err.message || 'An unknown error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    const handleNew = () => {
        setSelectedFnId(null);
        setName('');
        setCode('');
        setSchema('');
        setTestJson('');
        setValidated(null);
        setErrorMsg(null);
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
                          <div className="text-xl font-semibold">{title}</div>
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
                                    <div className="text-sm text-gray-500 dark:text-neutral-400">Loading...</div>
                                ) : (
                                    userFunctions.map((fn, i) => (
                                        <div
                                            key={i}
                                            className={`p-2 rounded cursor-pointer text-sm ${selectedFnId === fn.uuid ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
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
                                    ))
                                )}
                            </div>
                            <div className="w-2/3 p-4 overflow-y-auto">
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
- name: short lowercase-with-dashes identifier
- description: a one-sentence summary of the function
- code: a full Python function following the standard described below
- schema: a JSON schema matching the expected input for the function
- tags: array of keywords

For the code, write a Python script that follows this exact pattern:
\t•\tIt must define a main(event: dict) -> dict function. This function contains the core logic and returns a dictionary.
\t•\tThe script must accept a JSON string as a command-line argument, parse it into a Python dictionary called event, and pass it to the main function.
\t•\tIt must redirect sys.stdout to an in-memory buffer using io.StringIO() before calling main.
\t•\tAny output printed inside main() (e.g., for logging/debugging) should be captured.
\t•\tAfter calling main, the script must:
\t1.\tAdd a new key "stdout" to the result dictionary, whose value is the captured printed output (stripped of trailing whitespace).
\t2.\tPrint the final dictionary as a JSON string to standard output.
\t•\tFinally, sys.stdout must be restored to its original state.

The structure or the code must look exactly like this:

\`\`\`python
#...other imports here...
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

Only the contents of main() should change depending on the task.

The function should:
${whatToDo}

Output only a markdown code block like this:
\`\`\`json
{
  "name": "summarize-text",
  "description": "This function summarizes text into 3 bullet points.",
  "code": "<the full Python function code using the rules described above>",
  "schema": { "type": "object", "properties": { ... } },
  "tags": ["text", "summary"]
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

                                <div className="mt-6 text-sm font-bold">Description</div>
                                <PromptTextArea
                                    rootPromptText={`Generate a helpful description for the following Python function that starts with 'This function...':\n\n${code}`}
                                    generateButtonText="Generate Description from Code"
                                    promptTemplateString={`Write a short, helpful description for this Python function:\n\n{{code}}`}
                                    temperature={0.7}
                                    value={description}
                                    onChange={(val) => {setDescription(val);setHasUnsavedChanges(true);}}
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
                                                                    <pre className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
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
