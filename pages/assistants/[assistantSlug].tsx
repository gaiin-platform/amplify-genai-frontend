import React, { useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { getSession, useSession, signIn } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { IconMessage, IconSend, IconChevronUp, IconChevronDown, IconSquare, Icon3dCubeSphere, IconLoader2, IconBrain, IconAlertTriangle } from '@tabler/icons-react';
import { getAvailableModels } from '@/services/adminService';
import { sendDirectAssistantMessage, lookupAssistant } from '@/services/assistantService';
import { v4 as uuidv4 } from 'uuid';
import { getSettings } from '@/utils/app/settings';
import { LoadingDialog } from '@/components/Loader/LoadingDialog';
import Spinner from '@/components/Spinner';
import { Theme } from '@/types/settings';
import { Model as BaseModel } from '@/types/model';
import MainLayout from '@/components/Layout/MainLayout';
import SimpleSidebar from '@/components/Layout/SimpleSidebar';
import { ModelSelect } from '@/components/Chat/ModelSelect';
import { AssistantDefinition } from '@/types/assistant';
import { GroupTypeSelector } from '@/components/Chat/GroupTypeSelector';
import AssistantContentBlock from '@/components/StandAloneAssistant/AssistantContentBlock';
import ActionButton from '@/components/ReusableComponents/ActionButton';
import { 
  IconCopy, 
  IconDownload, 
  IconEdit, 
  IconTrash,
  IconMail
} from '@tabler/icons-react';
import styled from 'styled-components';
import { Account, noCoaAccount } from '@/types/accounts';
import { noRateLimit } from '@/types/rateLimit';
import { getAccounts } from '@/services/accountService';
import { AttachedDocument } from '@/types/attacheddocument';
import { getFileDownloadUrl } from '@/services/fileService';
import { fetchImageFromPresignedUrl } from '@/utils/app/files';
import { Logo } from '@/components/Logo/Logo';

// Extend the Model type to include isDefault property
interface Model extends BaseModel {
  isDefault?: boolean;
}

// Inline component for removed data sources in the standalone assistant page
const RemovedDataSourcesIndicator: React.FC<{ removed: any; total: number }> = ({ removed, total }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mt-3 max-w-full">
      <div className="border border-yellow-300 dark:border-yellow-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-left text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
        >
          <IconAlertTriangle size={16} className="flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
          <span>⚠️ {total} Data Source{total > 1 ? 's' : ''} Removed</span>
          <span className="ml-auto">{isOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}</span>
        </button>
        {isOpen && (
          <div className="px-3 py-2 bg-white dark:bg-[#2a2a35] text-sm flex flex-col gap-2">
            {removed.deniedAccess?.length > 0 && (
              <div>
                <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Access Denied ({removed.deniedAccess.length})</div>
                {removed.deniedAccess.map((src: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 my-1">
                    <IconAlertTriangle size={14} className="flex-shrink-0 text-red-500 mt-0.5" />
                    <div>
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">{src.name || src.objectId}</span>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {src.reason === 'no_permission_record' && "You don't have permission to access this file. If this is a file you have uploaded, please try to re-upload it. If this is a file that has been shared within an assistant or conversation, please contact the owner to request access or contact support."}
                        {src.reason === 'insufficient_privilege' && `Insufficient privilege level${src.userLevel ? ` (your level: ${src.userLevel})` : ''}.`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {removed.invalidIds?.length > 0 && (
              <div>
                <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Invalid Data Sources ({removed.invalidIds.length})</div>
                {removed.invalidIds.map((id: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 my-1">
                    <IconAlertTriangle size={14} className="flex-shrink-0 text-yellow-500 mt-0.5" />
                    <div>
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">{id}</span>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This file ID is not valid or the file no longer exists.</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {removed.invalidImageIds?.length > 0 && (
              <div>
                <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Invalid Images ({removed.invalidImageIds.length})</div>
                {removed.invalidImageIds.map((id: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 my-1">
                    <IconAlertTriangle size={14} className="flex-shrink-0 text-yellow-500 mt-0.5" />
                    <div>
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">{id}</span>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This image ID is not valid or the image no longer exists.</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface Props {
  chatEndpoint: string | null;
  assistantSlug: string;
}

const LoadingIcon = styled(Icon3dCubeSphere)`
  color: lightgray;
  height: 150px;
  width: 150px;
`;

const AssistantPage = ({
  chatEndpoint,
  assistantSlug,
}: Props) => {
  const { t } = useTranslation('chat');
  const { data: session } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantId, setAssistantId] = useState('');
  const [assistantName, setAssistantName] = useState('Loading Assistant...');
  const [assistantDefinition, setAssistantDefinition] = useState<AssistantDefinition | undefined>(undefined);
  const [lightMode, setLightMode] = useState<Theme>('dark');
  const [defaultModel, setDefaultModel] = useState<any>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [requiredGroupType, setRequiredGroupType] = useState<boolean>(false);
  const [groupType, setGroupType] = useState<string | undefined>(undefined);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [isHoveringSettings, setIsHoveringSettings] = useState(false);
  const [messageState, setMessageState] = useState<any>({});
  const messageStateRef = useRef<any>({});
  const [responseStatus, setResponseStatus] = useState<string>('');
  const [astResponding, setAstResponding] = useState<string>('');
  const [reasoningText, setReasoningText] = useState<string>('');
  const reasoningTextRef = useRef<string>(''); // Use ref for immediate updates
  const [messageReasoning, setMessageReasoning] = useState<{ [key: number]: string }>({});
  const [expandedReasoning, setExpandedReasoning] = useState<{ [key: number]: boolean }>({});
  const currentAssistantIndexRef = useRef<number | null>(null);
  const sendingRef = useRef<boolean>(false); // Prevent duplicate sends
  const [editing, setEditing] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [abortController, setAbortController] = useState<AbortController>(new AbortController());
  const [defaultAccount, setDefaultAccount] = useState<Account | null>(null);
  // Stable conversationId for the full session — stays the same across all turns so S3 appends correctly
  const [conversationId] = useState<string>(() => uuidv4());
  const [astIconUrl, setAstIconUrl] = useState<string | null>(null);

  // Agent state management
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('');
  const runningAgentSessionRef = useRef<string | null>(null);

  // Add the shimmer animation useEffect here with the other hooks
  useEffect(() => {
    // Add the shimmer animation CSS to the document head
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes shimmer {
        0% {
          background-position: -200px 0;
        }
        100% {
          background-position: 200px 0;
        }
      }

      .shimmer-text {
        background: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgb(0, 109, 243) 50%, rgba(0,0,0,0) 100%);
        background-size: 200px 100%;
        background-repeat: no-repeat;
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        animation: shimmer 3s infinite linear;
        position: relative;
        cursor: default;
      }

      .shimmer-text::before {
        position: absolute;
        left: 0;
        top: 0;
        color: #000000; /* Pure black for light mode */
        z-index: -1;
      }

      /* Hover state for light mode - stop animation and show solid readable text */
      .shimmer-text:hover {
        animation: none;
        color: rgb(0, 109, 243);
        background: none;
        -webkit-text-fill-color: rgb(0, 109, 243);
      }


      .dark .shimmer-text {
        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(225, 228, 233, 0.8) 50%, rgba(255,255,255,0) 100%);
        background-size: 200px 100%;
        background-repeat: no-repeat;
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        animation: shimmer 2s infinite linear;
        position: relative;
      }

      /* Hover state for dark mode - stop animation and show solid readable text */
      .dark .shimmer-text:hover {
        animation: none;
        color: #e5e5e5;
        background: none;
        -webkit-text-fill-color: #e5e5e5;
      }

    `;

    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Cleanup object URL when component unmounts or astIconUrl changes
  useEffect(() => {
    return () => {
      if (astIconUrl && astIconUrl.startsWith('blob:')) {
        URL.revokeObjectURL(astIconUrl);
      }
    };
  }, [astIconUrl]);

  // Get the current active model (selected or default)
  const activeModel = selectedModel || defaultModel;

  // Set selected model to default model on initial load
  useEffect(() => {
    if (defaultModel && !selectedModel) {
      setSelectedModel(defaultModel);
    }
  }, [defaultModel]);

  // Load user's theme preference from settings
  useEffect(() => {
    try {
      const savedSettings = getSettings({});
      if (savedSettings && savedSettings.theme) {
        setLightMode(savedSettings.theme);
        
        // Apply theme to document for consistent styling
        if (savedSettings.theme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (e) {
      console.error('Failed to load user settings:', e);
    }
  }, []);

  // Ensure the theme is applied to the body as well
  useEffect(() => {
    if (lightMode === 'dark') {
      document.body.classList.add('bg-[#343541]');
      document.body.classList.remove('bg-white');
    } else {
      document.body.classList.add('bg-white');
      document.body.classList.remove('bg-[#343541]');
    }
  }, [lightMode]);

  // Scroll to bottom when messages change or reasoning updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, reasoningText, isProcessing]);

  // Initialize the page
  useEffect(() => {
    const initializePage = async () => {
      if (!chatEndpoint) {
        setError('Chat endpoint is not configured');
        setLoading(false);
        return;
      }

      try {
        setLoadingMessage('Loading models...');
        
        // Fetch available models
        const modelsResponse = await getAvailableModels();
        
        let modelsList: any[] = [];
        if (modelsResponse.success) {
          // Ensure each model has the required structure
          modelsList = (modelsResponse.data?.models || []).map((model: any) => {
            // Make sure each model has an id property - required by the API
            return {
              ...model,
              id: model.id || model.modelId || 'unknown'
            };
          });
          
          setModels(modelsList);

          // Set default model from the list of available models
          if (modelsList.length > 0) {
            // Find default model or use the first one
            const defaultId = modelsResponse.data?.default?.id;
            
            const defaultModelFromList = defaultId 
              ? modelsList.find((m: Model) => m.id === defaultId) 
              : modelsList[0];
            
            if (defaultModelFromList) {
              // Mark it as default in the name property
              defaultModelFromList.isDefault = true;
              setDefaultModel(defaultModelFromList);
              setSelectedModel(defaultModelFromList);
            } else {
              console.warn('Default model not found in list, using first model');
              if (modelsList[0]) {
                modelsList[0].isDefault = true;
                setDefaultModel(modelsList[0]);
                setSelectedModel(modelsList[0]);
              }
            }
          } else {
            console.warn('No models available from the API');
          }
        } else {
          console.error('Failed to load models:', modelsResponse.error);
        }

        setLoadingMessage('Loading account...');
        const accountResponse = await getAccounts();
        if (accountResponse.success) {
            const defaultAccount = accountResponse.data.find((account: any) => account.isDefault);
            if (defaultAccount && !defaultAccount.rateLimit) defaultAccount.rateLimit = noRateLimit; 
            setDefaultAccount(defaultAccount || noCoaAccount);
        } else {
            console.log("Failed to fetch accounts.");
        }

        
        setLoadingMessage('Finding assistant...');
        
        if (!assistantSlug || assistantSlug.trim() === '') {
          throw new Error('No assistant slug provided');
        }
        
        // lookupAssistant takes only the path as argument
        const assistantResult = await lookupAssistant(assistantSlug);
        // console.log("assistantResult", assistantResult);
        
        if (!assistantResult) {
          throw new Error('No response from assistant lookup service');
        }
        
        if (assistantResult.success) {
          const { assistantId, definition } = assistantResult;
          
          if (!assistantId) {
            throw new Error('Assistant lookup succeeded but no assistant ID was returned');
          }
          
          // console.log("definition", definition); 
          handleGetAstIcon(definition?.data?.astIcon);
          setAssistantDefinition(definition as AssistantDefinition);

          if (Object.keys(definition?.data?.groupTypeData || {}).length > 0) {
            setRequiredGroupType(true);
          }

          setLoadingMessage('Finalizing assistant...');

          setAssistantId(assistantId);

          // If the LA enforces a model, override the selected model so chatBody.model is correct
          if (definition?.data?.model) {
            const enforcedModelId = definition.data.model;
            // modelsList is already loaded at this point (models are fetched before assistant lookup)
            const enforcedModel = modelsList.find((m: any) => m.id === enforcedModelId);
            setSelectedModel(enforcedModel ?? { id: enforcedModelId });
          }
          const astName = assistantResult.name || assistantResult.data?.name || definition?.name
          if (astName) {
            setAssistantName(astName);
          } else { // FALLBACK: derive name from the slug
            // Convert dash/slash separated slug to space-separated title case
            const derivedName = assistantSlug
              .split(/[-_/]/)  // Split on dashes, underscores, or slashes
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())  // Title case each word
              .join(' ');
            
            setAssistantName(derivedName);
          }
          setLoading(false);
        } else {
          const errorMsg = assistantResult.message || `Assistant not found at path "${assistantSlug}"`;
          console.error('Assistant lookup failed:', errorMsg);
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error('Failed to initialize page:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(`Failed to load assistant: ${errorMessage}`);
        setLoading(false);
      }
    };

    initializePage();
  }, [chatEndpoint, assistantSlug]);

  const handleResponseStatus = (status: string, meta?: any) => {
    if (status.includes("responding")) {
      setAstResponding(status);
      // Save reasoning to the current message and clear temp reasoning
      if (reasoningTextRef.current && currentAssistantIndexRef.current !== null) {
        const index = currentAssistantIndexRef.current;
        const reasoning = reasoningTextRef.current; // Capture before clearing

        // Use the captured value directly in the setState callback
        setMessageReasoning(prev => {
          const updated = { ...prev, [index]: reasoning }; // Use captured value
          return updated;
        });

        // Clear AFTER setting state
        setReasoningText('');
        reasoningTextRef.current = '';
      }
    } else {
      // Check if this is a reasoning message
      if (meta?.id === "reasoning") {
        // Accumulate reasoning chunks using ref for immediate access
        reasoningTextRef.current += status;
        setReasoningText(reasoningTextRef.current);
        setResponseStatus('Thinking...');
      } else {
        setResponseStatus(status);
      }
    }
  }

  // Handle agent polling when backend kicks off an agent run
  const startAgentPolling = async (sessionId: string) => {
    // Prevent duplicate polling
    if (runningAgentSessionRef.current === sessionId) {
      return;
    }

    runningAgentSessionRef.current = sessionId;

    try {
      // Import agent utilities
      const { handleAgentRun } = await import('@/utils/app/agent');
      const { sendChatRequestWithDocuments } = await import('@/services/chatService');

      // Poll for agent completion with status updates
      const agentResult: any = await handleAgentRun(
        sessionId,
        (status: any) => {
          // Update status display with real-time agent actions
          const statusMsg = status.summary || 'Processing...';
          setAgentStatus(statusMsg);
          setResponseStatus(statusMsg);
        }
      );

      if (!agentResult) {
        throw new Error('Agent run failed or was aborted');
      }

      // Type guard: ensure agentResult has the expected structure
      if (!agentResult.data || !agentResult.data.result) {
        console.error('Invalid agent result structure:', agentResult);
        throw new Error('Agent completed but returned invalid result structure');
      }

      // Agent completed - now get summarization
      setAgentStatus('Finalizing response...');
      setResponseStatus('Finalizing response...');

      const session = await getSession();
      // @ts-ignore - accessToken exists on session but not in base type
      if (!session || !session.accessToken) {
        throw new Error('Session expired');
      }

      // Get the user's original prompt (second to last message, since we added empty assistant message)
      // Find the last user message
      const userMessages = messages.filter(m => m.role === 'user');
      const userPrompt = userMessages[userMessages.length - 1]?.content || '';

      // Import the shared agentMessages utility function for code reuse
      const { agentMessages } = await import('@/utils/app/agent');
      // For standalone assistant:
      // - msgData is empty {} (no assistant definition needed in message data)
      // - dataSources is empty [] (backend automatically adds assistant data sources when assistantId is present)
      // - NO conversation messages (skipRag: true, backend handles assistant data sources)
      const agentMessagesArray = agentMessages(agentResult, userPrompt, {}, []);

      // Send with disableTools to prevent re-triggering agent and allow backend to add assistant data sources
      const chatBody = {
        model: activeModel,
        prompt: "You are an AI assistant responding to a user's question. You have been provided with: (1) an assistant's work log, and (2) reference documents via RAG retrieval. CRITICAL RULES: Only use information from these sources. If reference documents are provided in the conversation, you HAVE access to their content - use it. Never claim you lack access to provided information. Never make up information. If the provided sources don't contain the answer, explicitly state that. Always ground your response in the actual content provided to you.",
        messages: agentMessagesArray,
        temperature: 0.5,
        maxTokens: 4000,
        ragOnly: true,
        skipRag: false,
        skipCodeInterpreter: true,
        accountId: defaultAccount?.id,
        rateLimit: defaultAccount?.rateLimit,
        disableTools: true,
        assistantId: (assistantId && (assistantId.startsWith('astr/') || assistantId.startsWith('astgr/'))) ? undefined : assistantId,
      };

      const metaHandler = {
        status: () => {},
        mode: () => {},
        state: handleMessageState,
        shouldAbort: () => false
      };

      const response = await sendChatRequestWithDocuments(
        chatEndpoint!,
        // @ts-ignore - accessToken exists on session
        session.accessToken,
        chatBody,
        new AbortController().signal,
        metaHandler
      );

      // Stream the summarization response
      const responseData = response.body;
      if (!responseData) {
        throw new Error('No response body from summarization');
      }

      const reader = responseData.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let summaryText = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunkValue = decoder.decode(value, { stream: true });
          summaryText += chunkValue;

          // Update the assistant message with summary
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
              newMessages[newMessages.length - 1] = {
                role: 'assistant',
                content: summaryText
                // Note: standalone assistant uses simpler message structure without data field
              };
            }
            return newMessages;
          });
        }
      }

    } catch (error) {
      console.error('Agent polling error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: 'Sorry, the agent task failed: ' + (error instanceof Error ? error.message : String(error))
          };
        }
        return newMessages;
      });
    } finally {
      // Reset all agent-related state
      runningAgentSessionRef.current = null;
      setIsAgentRunning(false);
      setIsProcessing(false);
      setAgentStatus('');
      setResponseStatus('');
      setAstResponding('');
      setReasoningText('');
    }
  };

  // Handle sending a message
  const handleSendMessage = async (inputContent: string, messagesOverride?: any[]) => {
    if (!inputContent.trim() || isProcessing || !chatEndpoint || sendingRef.current) return;

    // Set sending flag to prevent duplicate rapid sends
    sendingRef.current = true;

    // If messagesOverride provided (e.g., from edit), use it; otherwise add new user message
    let messagesToSend: any[];
    if (messagesOverride) {
      // Edit mode: messages already updated, just send them
      messagesToSend = messagesOverride;
      setMessages(messagesOverride);
      setIsProcessing(true);
    } else {
      // Normal mode: add new user message
      const userMessage = { role: 'user', content: inputContent };
      setMessages(prev => [...prev, userMessage]);
      messagesToSend = [...messages, userMessage];
      setInputMessage('');
      setIsProcessing(true);
    }

    // Calculate the assistant message index BEFORE adding it
    const assistantMessageIndex = messagesToSend.length;

    // Track the current assistant message index for reasoning
    currentAssistantIndexRef.current = assistantMessageIndex;

    // Add a placeholder for the assistant message BEFORE the API call
    // This ensures messageState indices are correct when metaHandler callbacks fire
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    // Create a wrapper for handleMessageState that uses the correct index
    const handleMessageStateWithIndex = (state: any) => {
      try {
        // Update the ref immediately with the current ref value (not stale React state)
        const currentState = messageStateRef.current || {};
        const newState = { ...currentState, [assistantMessageIndex]: state };

        messageStateRef.current = newState;

        // Also update React state
        setMessageState(newState);
      } catch (e) {
        console.error('Error updating message state:', e);
        throw e; // Re-throw to see full stack
      }
    };

    try {
      // Make sure we have a valid model to use
      if (!activeModel) {
        throw new Error("No model selected. Please select a model and try again.");
      }

      // Verify the model has an id
      if (!activeModel.id) {
        console.error('Model is missing id:', activeModel);
        throw new Error("The selected model is invalid. Please select a different model.");
      }
      const options = {
        groupType:      requiredGroupType ? groupType : undefined,
        groupId:        assistantDefinition?.data?.groupId,
        accountId:      defaultAccount?.id,
        rateLimit:      defaultAccount?.rateLimit,
        conversationId: conversationId,
      };


      // Send the message to the assistant with conversation history and selected model
      const result = await sendDirectAssistantMessage(
        chatEndpoint,
        assistantId,
        assistantName,
        inputContent,
        activeModel, // Send the complete model object
        messagesToSend,
        options,
        messageState,
        handleMessageStateWithIndex, // Use the wrapper with correct index
        handleResponseStatus,
        abortController,
      );

      if (!result.success) {
        console.error('Failed to get response from assistant:', result.error);
        throw new Error(typeof result.error === 'object' && result.error !== null
          ? (result.error as any).message || "Unknown error"
          : "Failed to get response from assistant");
      }

      // Process the streaming response
      const response = result.response;
      if (!response) {
        throw new Error("Invalid response format - no response object");
      }

      if (!response.body) {
        throw new Error("Invalid response format - no response body");
      }
      
      // Declare variables outside try block so they're accessible in catch for error logging
      let text = '';
      let chunkCount = 0;
      let totalBytesReceived = 0;
      let largestChunkSize = 0;
      const streamStartTime = Date.now();

      // Process the streaming response
      try {
        const data = response.body;
        const reader = data.getReader();
        const decoder = new TextDecoder();
        let done = false;

        // Stream timeout removed - real errors are caught in the catch block below

        // Throttle UI updates to reduce memory pressure from frequent setMessages calls
        let lastUpdateTime = 0;
        const UPDATE_INTERVAL_MS = 50; // Update UI at most every 50ms

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;

          // Check for agent run on EVERY iteration, not just when there's a value
          // This is critical because agent runs may not send content chunks
          const currentMessageState = messageStateRef.current[assistantMessageIndex];
          const agentRun = currentMessageState?.agentRun;

          // If agent run detected in messageState, stop normal streaming and start polling
          if (agentRun && agentRun.sessionId && !agentRun.endTime) {
            // Start agent polling
            setIsAgentRunning(true);
            setAgentStatus('Starting agent...');
            setResponseStatus('Starting agent...');

            try {
              // Start polling (this function handles everything including setting isProcessing to false)
              await startAgentPolling(agentRun.sessionId);
            } catch (pollingError) {
              console.error('Error during agent polling:', pollingError);
              // startAgentPolling handles its own error display in messages
            }
            sendingRef.current = false; // Reset before early return
            return; // Exit early, agent polling handles cleanup
          }

          if (value) {
            chunkCount++;
            const rawChunkSize = value.length;
            totalBytesReceived += rawChunkSize;
            if (rawChunkSize > largestChunkSize) {
              largestChunkSize = rawChunkSize;
            }

            const chunkValue = decoder.decode(value, { stream: true });
            text += chunkValue;

            const now = Date.now();
            if (now - lastUpdateTime >= UPDATE_INTERVAL_MS) {
              lastUpdateTime = now;
              // Update the assistant message as it streams in
              setMessages(prev => {
                // Make a copy of the messages array
                const newMessages = [...prev];
                // Update the last message (the assistant's message)
                if (newMessages.length > 0) {
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: text
                  };
                }
                return newMessages;
              });
            }
          }
        }

        // Final update to ensure last content is displayed
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0) {
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: text
            };
          }
          return newMessages;
        });

        // If we got here but didn't receive any chunks, add a fallback message
        if (chunkCount === 0) {
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
              newMessages[newMessages.length - 1] = { 
                role: 'assistant', 
                content: 'I processed your message but wasn\'t able to generate a response. Please try again.' 
              };
            }
            return newMessages;
          });
        } else {
          // Final decoder flush at the end
          const finalText = decoder.decode();
          if (finalText) {
            text += finalText;
            setMessages(prev => {
              const newMessages = [...prev];
              if (newMessages.length > 0) {
                newMessages[newMessages.length - 1] = { 
                  role: 'assistant', 
                  content: text 
                };
              }
              return newMessages;
            });
          }
        }
      } catch (streamError) {
        const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
        console.error('Error processing stream:', streamError);

        const isAbortError = errorMessage.includes('abort') || errorMessage.includes('aborted');

        // Only show error message if it's not an abort error
        if (!isAbortError) {
          // Update the last message to show the error
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
              newMessages[newMessages.length - 1] = { 
                role: 'assistant', 
                content: 'Sorry, there was an error processing the response stream: ' + errorMessage
              };
            } else {
              newMessages.push({ 
                role: 'assistant', 
                content: 'Sorry, there was an error processing the response stream: ' + errorMessage
              });
            }
            return newMessages;
          });
        } else {
          setAbortController(new AbortController());
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request: ' +
          (error instanceof Error ? error.message : String(error))
      }]);
    } finally {
      // Only reset processing state if agent is not running
      // Agent polling handles its own cleanup
      if (!isAgentRunning) {
        // Save any remaining reasoning text to the message
        if (reasoningTextRef.current && currentAssistantIndexRef.current !== null) {
          const index = currentAssistantIndexRef.current;
          const reasoning = reasoningTextRef.current; // Capture before setState
          setMessageReasoning(prev => {
            const updated = { ...prev, [index]: reasoning }; // Use captured value
            return updated;
          });
        }
        setIsProcessing(false);
        setResponseStatus('');
        setAstResponding('');
        setReasoningText('');
        reasoningTextRef.current = '';
        currentAssistantIndexRef.current = null; // Clear the ref
        sendingRef.current = false; // Reset sending flag
      }
    }
  };

  const isSendDisabled = () => {
    return !inputMessage.trim() || isProcessing || (requiredGroupType && !groupType) || !assistantDefinition?.assistantId;
  }

  // Handle key press (submit on Enter, new line on Shift+Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if (isSendDisabled()) return; // Don't send if validation fails
      
      handleSendMessage(inputMessage);
    }
  };

  // Handle textarea auto-resize
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    
    // Auto-resize the textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  // Handle model change
  const handleModelChange = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    
    if (model) {
      setSelectedModel(model);
    } else {
      console.error('Model not found for ID:', modelId);
    }
  };

  const handleMessageState = (state: any) => {
    const messageIndex = messages.length - 1;
    setMessageState({ ...messageState, [messageIndex]: state });
  }

  const handleGetAstIcon = async (dataSource: AttachedDocument | undefined) => {
    if (astIconUrl !== null || !dataSource || !dataSource.key) return;
    setAstIconUrl(''); // will trigger loading 

    try {
        const response = await getFileDownloadUrl(dataSource.key, dataSource.groupId);
        if (!response.success) {
            console.error("Error getting file download URL");
            setAstIconUrl(null);
            return;
        }
        
        const blob = await fetchImageFromPresignedUrl(response.downloadUrl, dataSource.type || '');
        if (!blob) {
          setAstIconUrl(null);
            return;
        }
        
        // Convert blob to URL
        const imageUrl = URL.createObjectURL(blob);
        setAstIconUrl(imageUrl);
    } catch (error) {
        console.error("Error loading image:", error);
        setAstIconUrl(null);
    } 
  }

  const getAstIcon = () => { 
    switch (astIconUrl) {
      case null:
        return <IconMessage className="text-blue-600 dark:text-blue-300" size={26} />;
      case '':
        return <IconLoader2 className="text-blue-600 dark:text-blue-300 animate-spin" size={30} />;
      case astIconUrl:
        return astIconUrl && (
          <img 
            src={astIconUrl} 
            alt="Assistant icon" 
            className="w-[54px] h-[54px] object-cover rounded"
            onError={() => setAstIconUrl(null)}
          />
        );
    }
  }


  // Content for header
  const headerContent = (
    <div className="flex items-center gap-3 w-full">
      <div className={`flex-shrink-0 rounded-full flex items-center justify-center ${astIconUrl ? '' : 'bg-blue-100 dark:bg-blue-900 p-2'}`}>
        {getAstIcon()}
      </div>

      <div className="group relative flex items-center">
          <h1 id="assistantNameTitle" className="text-[1.4rem] mt-auto h-full font-bold text-neutral-800 dark:text-neutral-100 leading-none">
            {assistantName}
          </h1>
          <div id="hoverIDDescriptionBlock" className="absolute left-0 top-full mt-1 hidden rounded-md bg-gray-800 p-3 text-xs text-white shadow-lg group-hover:block z-10 max-w-[350px] w-max">
            <p className="mb-1 break-all"><span className="font-bold">ID:</span> {assistantId}</p>
            <p className="break-words"><span className="font-bold">Description:</span> {assistantDefinition?.description || 'Not provided'}</p>
          </div>
        </div>
        {groupType && <div className="absolute right-10 text-xl font-bold text-neutral-800 dark:text-neutral-100">{groupType}</div>}
    </div>
  );


 
  const filterMessages = () => {
    return messages.filter(message => ["user", "assistant"].includes(message.role));
  }

  const handleEditMessage = (index: number) => {
    const newContent = messages[index].content;
    setEditedContent(newContent);
    setEditing(index);
  };

  const handleSaveEdit = () => {
    if (editing !== null) {
      // Keep messages up to and including the edited message, then update it
      const updatedMessages = [...messages.slice(0, editing + 1)];

      updatedMessages[editing] = {
        ...updatedMessages[editing],
        content: editedContent,
        role: 'user'
      };

      // Clear reasoning for messages after the edit point
      const newReasoning: { [key: number]: string } = {};
      Object.keys(messageReasoning).forEach(oldIndex => {
        const idx = parseInt(oldIndex);
        if (idx < editing) {
          newReasoning[idx] = messageReasoning[idx];
        }
      });
      setMessageReasoning(newReasoning);
      setExpandedReasoning({});

      setEditing(null);

      // Use handleSendMessage with messagesOverride to avoid duplication
      handleSendMessage(editedContent, updatedMessages);
    }
  };

  const handleDeleteMessage = (index: number) => {
    // If deleting a user message, also delete the following assistant message
    if (messages[index].role === 'user' && index < messages.length - 1 && messages[index + 1].role === 'assistant') {
      const updatedMessages = messages.filter((_, i) => i !== index && i !== index + 1);
      setMessages(updatedMessages);

      // Rebuild reasoning map with updated indices
      const newReasoning: { [key: number]: string } = {};
      Object.keys(messageReasoning).forEach(oldIndex => {
        const idx = parseInt(oldIndex);
        if (idx < index) {
          newReasoning[idx] = messageReasoning[idx];
        } else if (idx > index + 1) {
          newReasoning[idx - 2] = messageReasoning[idx];
        }
      });
      setMessageReasoning(newReasoning);
      setExpandedReasoning({});
    } else {
      const updatedMessages = messages.filter((_, i) => i !== index);
      setMessages(updatedMessages);

      // Rebuild reasoning map with updated indices
      const newReasoning: { [key: number]: string } = {};
      Object.keys(messageReasoning).forEach(oldIndex => {
        const idx = parseInt(oldIndex);
        if (idx < index) {
          newReasoning[idx] = messageReasoning[idx];
        } else if (idx > index) {
          newReasoning[idx - 1] = messageReasoning[idx];
        }
      });
      setMessageReasoning(newReasoning);
      setExpandedReasoning({});
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleDownloadMessage = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'message.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Function to stop generation
  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
    }

    // If agent is running, trigger kill event for agent polling
    if (isAgentRunning) {
      window.dispatchEvent(new Event('killChatRequest'));
    }

    // Reset all state
    setIsProcessing(false);
    setIsAgentRunning(false);
    setAgentStatus('');
    setResponseStatus('');
    setAstResponding('');
    setReasoningText('');
  };

  // Loading state
  if (loading) {
    return (
      <MainLayout
        title="Loading Assistant"
        description={`Chat with ${assistantName}`}
        theme={lightMode}
        showLeftSidebar={false}
        showRightSidebar={false}
      >
        <div className="flex h-full items-center justify-center bg-white dark:bg-[#343541]">
          <LoadingDialog open={true} message={loadingMessage || "Setting up the assistant..."} />
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (!session) {
    return (
      <MainLayout
        title="Login Required"
        description={`Chat with ${assistantName}`}
        theme={lightMode}
        showLeftSidebar={false}
        showRightSidebar={false}
      >
        <div className="flex h-screen w-screen flex-col text-sm text-black dark:text-white">
          <div className="flex flex-col items-center justify-center min-h-screen text-center text-black dark:text-white">
            <div className="mb-8">
              <Logo width={200} height={60} />
            </div>
            <button
              onClick={() => signIn('cognito')}
              id="loginButton"
              className="shadow-md"
              style={{
                backgroundColor: 'white',
                border: '2px solid #ccc',
                color: 'black',
                fontWeight: 'bold',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease-in-out',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#48bb78'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              Login
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Error state (separate from authentication)
  if (error) {
    return (
      <MainLayout
        title="Error"
        description={`Chat with ${assistantName}`}
        theme={lightMode}
        showLeftSidebar={false}
        showRightSidebar={false}
      >
        <div className="flex h-screen w-screen flex-col items-center justify-center text-center bg-white dark:bg-[#343541]">
          <div className="max-w-md mx-auto p-6">
            <div className="mb-6 flex justify-center">
              <LoadingIcon />
            </div>
            <h1 className="mb-4 text-2xl font-bold text-red-600 dark:text-red-400">
              Assistant Error
            </h1>
            <p className="mb-6 text-gray-700 dark:text-gray-300 break-words">
              {error}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  const currentUrl = window.location.href;
                  const baseUrl = currentUrl.split('/assistants')[0];
                  window.location.href = baseUrl;
                }}
                className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Go to Amplify
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Empty sidebars - just for structure
  const leftSidebarContent = null; //<SimpleSidebar side="left" />;
  const rightSidebarContent = null; // <SimpleSidebar side="right" />;


  return (
    <MainLayout
      title={`${assistantName} - Amplify`}
      description={`Chat with ${assistantName}`}
      theme={lightMode}
      showLeftSidebar={false}
      showRightSidebar={false}
      header={headerContent}
    >
      {/* Model selector above messages */}
      <div className="bg-white dark:bg-[#343541] border-b border-neutral-200 dark:border-neutral-600 py-4 px-4 relative">
        <div className="w-full px-40">
          {showSettings && (
            <div className="flex justify-center">
              <div className="w-full z-60">
                  <ModelSelect modelId={assistantDefinition?.data?.model || activeModel?.id} 
                              isDisabled={!!assistantDefinition?.data?.model}
                              handleModelChange={handleModelChange}
                              models={models}
                              defaultModelId={defaultModel?.id}
                              showPricingBreakdown={false}
                  />
              </div>
            </div>
          )}
        </div>
        
        <div className="absolute bottom-2 left-4 flex items-center group"
             onMouseEnter={() => setIsHoveringSettings(true)}
             onMouseLeave={() => setIsHoveringSettings(false)}>
          <button 
            title={showSettings ? 'Hide Settings' : 'Show Settings'}
            id="hideSettings"
            onClick={() => {
              setShowSettings(!showSettings);
              setTimeout(() => {
                setIsHoveringSettings(false);
              }, 1000);
            }}
            className="flex items-center justify-center text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
          >
            {showSettings ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </button>
          {isHoveringSettings && (
            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400 animate-fade-in">
              {showSettings ? 'Hide Settings' : 'Show Settings'}
            </span>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto py-4 px-6 bg-white dark:bg-[#343541]">
        {filterMessages().length === 0 ? (
          <div className="flex h-full flex-col">
            {assistantDefinition?.data && requiredGroupType && 
            <div className="flex justify-center text-neutral-500 dark:text-neutral-400 w-full py-4">
                <GroupTypeSelector
                    groupOptionsData={assistantDefinition.data.groupTypeData}
                    setSelected={setGroupType}
                    groupUserTypeQuestion={assistantDefinition.data.groupUserTypeQuestion}
                />
                
            </div> }
 
              {assistantName !== 'Loading Assistant...' && <div className="mt-20 text-center text-neutral-500 dark:text-neutral-400">
                <p className="mb-2">{t('Start a conversation with the assistant')}</p>
                <p className="text-sm">{assistantName} can help answer your questions</p>
              </div>}
            
          </div>
        ) : (
          <div className="space-y-6 w-full px-20">
            {filterMessages().map((message, index) => (
              <div key={index} className="w-full mb-6">
                {message.role === 'user' ? (
                  <>
                    <div className="flex justify-end">
                      <div id={`userMessage${index}`} className="amplify-user-message amplify-message-container">
                        {editing === index ? (
                          <>
                          <textarea
                            className="w-full p-4 border-2 border-blue-400 dark:border-blue-500 rounded-lg bg-white dark:bg-[#40414f] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 dark:focus:border-blue-400 shadow-lg transition-all resize-y text-base leading-relaxed"
                            value={editedContent}
                            id="editUserMessage"
                            onChange={(e) => setEditedContent(e.target.value)}
                            rows={Math.max(10, Math.ceil(editedContent.length / 80))}
                            placeholder="Edit your message..."
                            autoFocus
                            style={{
                              minHeight: '200px',
                              maxHeight: '500px',
                              width: editedContent.length > 500 ? window.innerWidth / 2: '100%',
                              fontSize: '15px',
                              lineHeight: '1.6'
                            }}
                          />
                          <div className="flex justify-end mt-3 space-x-2">
                          <button
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center border border-transparent dark:border-gray-700"
                            id="cancelEdit"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center shadow-md"
                            id="saveEdit"
                            onClick={handleSaveEdit}
                          >
                            Save changes
                          </button>
                        </div>
                        </>
                        ) : (
                          <>{message.content}</>
                        )}
                      </div>
                    </div>
                    
                    {/* User message action buttons */}
                    {!isProcessing && !editing && (
                      <div className="flex mt-1 space-x-1 justify-end">
                        <ActionButton 
                          handleClick={() => handleCopyMessage(message.content)}
                          title="Copy message"
                          id={`copy-message-${index}`}
                        >
                          <IconCopy size={16} />
                        </ActionButton>
                        <ActionButton 
                          handleClick={() => handleEditMessage(index)}
                          title="Edit message"
                          id={`edit-message-${index}`}
                        >
                          <IconEdit size={16} />
                        </ActionButton>
                        <ActionButton 
                          handleClick={() => handleDeleteMessage(index)}
                          title="Delete message"
                          id={`delete-message-${index}`}
                        >
                          <IconTrash size={16} />
                        </ActionButton>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-full">
                      

                      <div className="amplify-assistant-message rounded-lg inline-block">
                        <AssistantContentBlock
                          message={message}
                          messageIndex={index}
                          messageIsStreaming={isProcessing && index === messages.length - 1}
                          totalMessages={messages.length}
                          messageEndRef={messageEndRef}
                        />
                      </div>
                      {/* Removed data sources indicator */}
                      {(() => {
                        const removed = messageState[index]?.removedDataSources;
                        if (!removed) return null;
                        const total = (removed.invalidIds?.length ?? 0) + (removed.deniedAccess?.length ?? 0) + (removed.invalidImageIds?.length ?? 0);
                        if (total === 0) return null;
                        return (
                          <RemovedDataSourcesIndicator removed={removed} total={total} />
                        );
                      })()}
                    </div>

                    {/* Assistant message action buttons */}
                    {!isProcessing && !editing && (
                      <div className="flex mt-1 space-x-1 justify-start">
                        <ActionButton 
                          handleClick={() => handleCopyMessage(message.content)}
                          title="Copy message"
                          id={`copy-message-${index}`}
                        >
                          <IconCopy size={16} />
                        </ActionButton>
                        <ActionButton 
                          handleClick={() => handleDownloadMessage(message.content)}
                          title="Save as file"
                          id={`download-message-${index}`}
                        >
                          <IconDownload size={16} />
                        </ActionButton>
                        <ActionButton 
                          handleClick={() => {
                            window.location.href = `mailto:?body=${encodeURIComponent(message.content)}`;
                          }}
                          title="Email response"
                          id={`email-message-${index}`}
                        >
                          <IconMail size={16} />
                        </ActionButton>
                        {/* Collapsible thinking section */}
                      {messageReasoning[index] && (
                        <div className="relative ml-4 mt-1">
                          <button
                            onClick={() => setExpandedReasoning(prev => ({ ...prev, [index]: !prev[index] }))}
                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          >
                            <IconBrain size={16} />
                            <span>{expandedReasoning[index] ? 'Hide' : 'View'} Thinking</span>
                            {expandedReasoning[index] ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                          </button>
                          {expandedReasoning[index] && (
                            <div className="absolute left-0 top-full mt-1 z-10 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 px-4 py-3 rounded-lg shadow-lg"
                                 style={{width: window.innerWidth * 0.6}}>
                              <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                                {messageReasoning[index]}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      </div>
                    )}

                    
                  </>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="mb-6">
                <div className="flex justify-start">
                  <div className="bg-neutral-100 dark:bg-[#444654] px-4 py-3 rounded-lg">
                    <div className="flex items-center">
                      <Spinner size="16px"/>
                      <span className="ml-2 shimmer-text">
                        {isAgentRunning
                          ? (agentStatus || 'Agent working...')
                          : (responseStatus.trim() || astResponding || 'Responding...')
                        }
                      </span>
                    </div>
                  </div>
                </div>
                {/* Reasoning bubble appears below the status */}
                {reasoningText && (
                  <div className="flex justify-start mt-2 animate-fade-in">
                    <div className="relative max-w-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 px-4 py-3 rounded-lg shadow-sm">
                      <div className="flex items-start gap-2">
                        <IconBrain className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                          {reasoningText}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Stop generation button */}
      {isProcessing && (
      <div className='relative'>
        <div className="absolute bottom-2 w-full text-center flex justify-center mt-3">
          <button 
            onClick={stopGeneration}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-500 hover:bg-gray-300 dark:hover:bg-gray-400 text-black rounded-full border border-gray-200 transition-colors duration-200"
            title="Stop generating"
            id="stop-generation"
          >
            <IconSquare size={12} fill="blue" className="animate-pulse" />
            <span className="text-xs">Stop generating</span>
          </button>
        </div>
        </div>)}

      {/* Input area */}
      <div className="border-t border-neutral-200 dark:border-neutral-600 bg-white dark:bg-[#343541] py-4 px-6">
      
        <div className="w-full px-10">
          <div className="relative">
            <textarea
              ref={textareaRef}
              className="w-full resize-none rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-[#40414f] px-4 py-3 pr-12 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
              style={{
                minHeight: '56px',
                maxHeight: '200px',
              }}
              rows={1}
              id="assistantChatInput"
              placeholder={t('Type your message here...') || 'Type your message here...'}
              value={inputMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyPress}
              disabled={isProcessing}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button
                className={`text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-100 ${
                  isSendDisabled() ? 'opacity-40 cursor-not-allowed' : 'hover:bg-neutral-200 dark:hover:bg-neutral-600'
                } p-1.5 rounded-md`}
                onClick={() => handleSendMessage(inputMessage)}
                disabled={isSendDisabled()}
                title={!assistantDefinition?.assistantId ? "No Assistant Found - Chat is disabled" : ""}
                id="sendMessageButton"
                aria-label="Send message"
              >
                <IconSend size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

   
    </MainLayout>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ locale, params, req }) => {
  const session = await getSession({ req });
  
  const chatEndpoint = process.env.CHAT_ENDPOINT;
  
  return {
    props: {
      chatEndpoint,
      assistantSlug: params?.assistantSlug || '',
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
      ])),
    },
  };
};

export default AssistantPage;