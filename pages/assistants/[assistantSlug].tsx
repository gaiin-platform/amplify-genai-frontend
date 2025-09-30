import { useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { getSession, useSession, signIn } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { IconMessage, IconSend, IconInfoCircle, IconCamera, IconCameraOff, IconCurrencyDollar, IconBaselineDensitySmall, IconBaselineDensityMedium, IconBaselineDensityLarge, IconChevronUp, IconChevronDown, IconSquare, Icon3dCubeSphere } from '@tabler/icons-react';
import { getAvailableModels } from '@/services/adminService';
import { sendDirectAssistantMessage, lookupAssistant } from '@/services/assistantService';
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
import { isMemberOfAstAdminGroup } from '@/services/groupsService';
import ActionButton from '@/components/ReusableComponents/ActionButton';
import { 
  IconCopy, 
  IconDownload, 
  IconEdit, 
  IconTrash,
  IconMail
} from '@tabler/icons-react';
import styled from 'styled-components';

// Extend the Model type to include isDefault property
interface Model extends BaseModel {
  isDefault?: boolean;
}

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
  const router = useRouter();
  const { data: session } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantId, setAssistantId] = useState('');
  const [assistantName, setAssistantName] = useState('Assistant');
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
  const [responseStatus, setResponseStatus] = useState<string>('');
  const [astResponding, setAstResponding] = useState<string>('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [abortController, setAbortController] = useState<AbortController>(new AbortController());

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
      }
      
      .shimmer-text::before {
        position: absolute;
        left: 0;
        top: 0;
        color: #000000; /* Pure black for light mode */
        z-index: -1;
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
      
    `;

    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        
        if (modelsResponse.success) {
          // Ensure each model has the required structure
          const modelsList = (modelsResponse.data?.models || []).map((model: any) => {
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
        
        // Look up the assistant by path
        setLoadingMessage('Finding assistant...');
        
        // lookupAssistant takes only the path as argument
        const assistantResult = await lookupAssistant(assistantSlug);
        
        if (assistantResult.success) {
          const { assistantId, definition } = assistantResult;
          setAssistantDefinition(definition as AssistantDefinition);

          if (Object.keys(definition?.data?.groupTypeData || {}).length > 0) {
            setRequiredGroupType(true);
          }

          setLoadingMessage('Finalizing assistant...');

          if (assistantId) {
            setAssistantId(assistantId);
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
            console.error('Assistant ID not found in lookup result');
            setError('Could not find the assistant');
          }
        } else {
          console.error('Assistant lookup failed:', assistantResult.message);
          setError(`Assistant not available at path "${assistantSlug}"`);
        }
      } catch (error) {
        console.error('Failed to initialize page:', error);
        setError('Failed to load assistant: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, [chatEndpoint, assistantSlug]);

  const handleResponseStatus = (status: string) => {
    console.log("status recieved:", status);
    if (status.includes("responding")) {
      setAstResponding(status);
    } else {
      setResponseStatus(status);
    }
  }


  // Handle sending a message
  const handleSendMessage = async (inputContent: string) => {
    if (!inputContent.trim() || isProcessing || !chatEndpoint) return;
    
    // Add user message to the chat
    const userMessage = { role: 'user', content: inputContent };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);
    
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
      const options = {groupType:  requiredGroupType ? groupType : undefined, groupId: assistantDefinition?.data?.groupId};
      // Send the message to the assistant with conversation history and selected model
      const result = await sendDirectAssistantMessage(
        chatEndpoint,
        assistantId,
        assistantName,
        inputContent,
        activeModel, // Send the complete model object
        messages,
        options,
        messageState,
        handleMessageState,
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
      
      // Add a placeholder for the assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      // Process the streaming response
      try {
        const data = response.body;
        const reader = data.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let text = '';
        let chunkCount = 0;
        
        // Set a timeout to check if we're getting any data
        const streamTimeout = setTimeout(() => {
          if (chunkCount === 0) {
            console.warn('No chunks received after 15 seconds, setting fallback response');
            // If no chunks have been received after 15 seconds, show a fallback message
            setMessages(prev => {
              const newMessages = [...prev];
              if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
                newMessages[newMessages.length - 1] = { 
                  role: 'assistant', 
                  content: 'I received your message but haven\'t been able to generate a response yet. Please wait a moment or try again.' 
                };
              }
              return newMessages;
            });
          }
        }, 15000);
        
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          
          if (value) {
            chunkCount++;
            const chunkValue = decoder.decode(value, { stream: true });
            text += chunkValue;
            
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
        
        clearTimeout(streamTimeout);
        
        // If we got here but didn't receive any chunks, add a fallback message
        if (chunkCount === 0) {
          console.warn('Stream completed but no chunks were received');
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
        console.error('Error processing stream:', streamError);
        const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
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
      setIsProcessing(false);
      setResponseStatus('');
      setAstResponding('');
    }
  };

  // Handle key press (submit on Enter, new line on Shift+Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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

  // Content for header
  const headerContent = (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 p-2 rounded-full flex items-center justify-center">
        <IconMessage className="text-blue-600 dark:text-blue-300" size={22} />
      </div>
      <div className="group relative flex items-center">
        <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 leading-none py-1">
          {assistantName}
        </h1>
        <div className="absolute left-0 top-full mt-1 hidden rounded-md bg-gray-800 p-3 text-xs text-white shadow-lg group-hover:block z-10 max-w-[350px] w-max">
          <p className="mb-1 break-all"><span className="font-bold">ID:</span> {assistantId}</p>
          <p className="break-words"><span className="font-bold">Description:</span> {assistantDefinition?.description || 'Not provided'}</p>
        </div>
      </div>
      {groupType && <div className="ml-auto text-xl font-bold text-neutral-800 dark:text-neutral-100  py-1">{groupType}</div>}
    </div>
  );

  // Log assistant name whenever it changes - for debugging
  useEffect(() => {
    // Removed debug logging
  }, [assistantName]);

 
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
      const updatedMessages = [...messages.slice(0, editing)];
    
      updatedMessages[editing] = {
        ...updatedMessages[editing],
        content: editedContent
      };
      setMessages(updatedMessages);
      setEditing(null);
      handleSendMessage(editedContent);
    }
    
  };

  const handleDeleteMessage = (index: number) => {
    // If deleting a user message, also delete the following assistant message
    if (messages[index].role === 'user' && index < messages.length - 1 && messages[index + 1].role === 'assistant') {
      const updatedMessages = messages.filter((_, i) => i !== index && i !== index + 1);
      setMessages(updatedMessages);
    } else {
      const updatedMessages = messages.filter((_, i) => i !== index);
      setMessages(updatedMessages);
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        // Show toast or feedback
        console.log('Copied to clipboard');
      })
      .catch(err => {
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
      setIsProcessing(false);
    }
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
  if (error || !session) {
    return (
      <MainLayout
        title="Error"
        description={`Chat with ${assistantName}`}
        theme={lightMode}
        showLeftSidebar={false}
        showRightSidebar={false}
      >
        <div className="flex h-screen w-screen flex-col text-sm text-black dark:text-white">
          <div className="flex flex-col items-center justify-center min-h-screen text-center text-black dark:text-white">
            <h1 className="mb-4 text-2xl font-bold">
              <LoadingIcon />
            </h1>
            <button
              onClick={() => signIn('cognito', { callbackUrl: window.location.origin })}
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
 
              <div className="mt-20 text-center text-neutral-500 dark:text-neutral-400">
              <p className="mb-2">{t('Start a conversation with the assistant')}</p>
              <p className="text-sm">{assistantName} can help answer your questions</p>
            </div>
            
          </div>
        ) : (
          <div className="space-y-6 w-full px-20">
            {filterMessages().map((message, index) => (
              <div key={index} className="w-full mb-6">
                {message.role === 'user' ? (
                  <>
                    <div className="flex justify-end">
                      <div className="amplify-user-message amplify-message-container">
                        {editing === index ? (
                          <>
                          <textarea
                            className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-[#40414f] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all resize-none"
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            rows={4}
                            placeholder="Edit your message..."
                            
                          />
                          <div className="flex justify-end mt-3 space-x-2">
                          <button
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 rounded-md text-xs font-medium transition-colors duration-200 flex items-center border border-transparent dark:border-gray-700"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:hover:bg-blue-800/60 dark:text-blue-200 rounded-md text-xs font-medium transition-colors duration-200 flex items-center border border-blue-200 dark:border-blue-800"
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
                      <Spinner size="16px"/> <span className="ml-2 shimmer-text">{responseStatus.trim() || astResponding}</span> 
                    </div>
                  </div>
                </div>
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
              placeholder={t('Type your message here...') || 'Type your message here...'}
              value={inputMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyPress}
              disabled={isProcessing}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button
                className={`text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-100 ${
                  !inputMessage.trim() || isProcessing || (requiredGroupType && !groupType)
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-neutral-200 dark:hover:bg-neutral-600'
                } p-1.5 rounded-md`}
                onClick={() => handleSendMessage(inputMessage)}
                disabled={!inputMessage.trim() || isProcessing || (requiredGroupType && !groupType)}
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