import { useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { getSession, useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { IconMessage, IconSend, IconInfoCircle, IconCamera, IconCameraOff, IconCurrencyDollar, IconBaselineDensitySmall, IconBaselineDensityMedium, IconBaselineDensityLarge } from '@tabler/icons-react';
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

// Extend the Model type to include isDefault property
interface Model extends BaseModel {
  isDefault?: boolean;
}

interface Props {
  chatEndpoint: string | null;
  assistantSlug: string;
}

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
  const [assistantDescription, setAssistantDescription] = useState('');
  const [assistantDefinition, setAssistantDefinition] = useState<AssistantDefinition | undefined>(undefined);
  const [assistantRole, setAssistantRole] = useState('Custom Assistant');
  const [lightMode, setLightMode] = useState<Theme>('dark');
  const [defaultModel, setDefaultModel] = useState<any>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [requiredGroupType, setRequiredGroupType] = useState<boolean>(false);
  const [groupType, setGroupType] = useState<string | undefined>(undefined);
  
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

  // Custom interface for assistant lookup result
  interface AssistantLookupResult {
    success: boolean;
    message: string;
    assistantId?: string;
    astPath?: string;
    pathFromDefinition?: string;
    name?: string;
    public?: boolean;
    data?: any;
    definition?: {
      name?: string;
      instructions?: string;
      description?: string;
      role?: string;
      [key: string]: any;
    };
  }

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
          console.log('Models List', modelsList);
          
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
        const result = await lookupAssistant(assistantSlug);
        
        // Cast the result to our custom interface
        const assistantResult = result as AssistantLookupResult;
        
        if (assistantResult.success) {
          const { assistantId, astPath, pathFromDefinition, public: isPublic , definition } = assistantResult;
          setAssistantDefinition(definition as AssistantDefinition);
          if (Object.keys(definition?.data?.groupTypeData || {}).length > 0) {
            setRequiredGroupType(true);
          }

          if (assistantId) {
            setAssistantId(assistantId);
            
            // Initialize variables to track our progress finding a name
            let assistantNameFound = false;
            
            // APPROACH 1: Check if the name is directly in the top-level result or data
            if (!assistantNameFound && assistantResult.name) {
              setAssistantName(assistantResult.name);
              assistantNameFound = true;
            }
            
            // APPROACH 2: Check if the name is in the data object
            else if (!assistantNameFound && assistantResult.data && assistantResult.data.name) {
              setAssistantName(assistantResult.data.name || '');
              assistantNameFound = true;
            }
            
            // APPROACH 3: Check if the definition object is present and has a name
            else if (!assistantNameFound && assistantResult.definition && assistantResult.definition.name) {
              const definition = assistantResult.definition;
              
              setAssistantName(definition.name || '');
              assistantNameFound = true;
              
              // Also set description and role if available
              if (definition.description) {
                setAssistantDescription(definition.description);
              }
              
              if (definition.role) {
                setAssistantRole(definition.role);
              }
              
              // Add an initial welcome message if provided
              if (definition.instructions) {
                // Use current assistantName value to ensure it has the most up-to-date name
                setTimeout(() => {
                  const currentName = definition.name || 'your assistant';
                  setMessages([
                    { 
                      role: 'assistant', 
                      content: `👋 I'm ${currentName}. ${definition.instructions}` 
                    }
                  ]);
                }, 0);
              }
            }
            
            // FALLBACK: If we still haven't found a name, derive one from the slug
            else if (!assistantNameFound) {
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
            setLoading(false);
          }
        } else {
          console.error('Assistant lookup failed:', assistantResult.message);
          setError(`Assistant not found at path "${assistantSlug}"`);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to initialize page:', error);
        setError('Failed to load assistant: ' + (error instanceof Error ? error.message : 'Unknown error'));
        setLoading(false);
      }
    };

    initializePage();
  }, [chatEndpoint, assistantSlug]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing || !chatEndpoint) return;
    
    // Add user message to the chat
    const userMessage = { role: 'user', content: inputMessage };
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
      
      const options = requiredGroupType ? {groupType: groupType, groupId: assistantDefinition?.data?.groupId} : {};

      // Send the message to the assistant with conversation history and selected model
      const result = await sendDirectAssistantMessage(
        chatEndpoint,
        assistantId,
        assistantName,
        inputMessage,
        activeModel, // Send the complete model object
        messages,
        options
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
        // Update the last message to show the error
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = { 
              role: 'assistant', 
              content: 'Sorry, there was an error processing the response stream: ' + 
                (streamError instanceof Error ? streamError.message : String(streamError))
            };
          } else {
            newMessages.push({ 
              role: 'assistant', 
              content: 'Sorry, there was an error processing the response stream: ' + 
                (streamError instanceof Error ? streamError.message : String(streamError))
            });
          }
          return newMessages;
        });
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
    }
  };

  // Handle key press (submit on Enter, new line on Shift+Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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

  // Helper function to get model description
  const getModelDescription = (model: any) => {
    if (!model) return '';
    
    // Create description based on model capabilities
    const capabilities = [];
    if (model.supportsImages) capabilities.push('Image understanding');
    if (model.supportsReasoning) capabilities.push('Advanced reasoning');
    
    let description = `${model.description || 'AI language model'}`;
    if (model.inputContextWindow) {
      description += `. Context: ${Math.round(model.inputContextWindow/1000)}k tokens`;
    }
    if (capabilities.length > 0) {
      description += `. Capabilities: ${capabilities.join(', ')}`;
    }
    
    return description;
  };

  // Content for header
  const headerContent = (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900 p-2 rounded-full flex items-center justify-center">
        <IconMessage className="text-blue-600 dark:text-blue-300" size={22} />
      </div>
      <div className="group relative flex items-center ">
        <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 leading-none py-1">
          {assistantName}
        </h1>
        <div className="absolute left-0 top-full mt-1 hidden rounded-md bg-gray-800 p-2 text-xs text-white shadow-lg group-hover:block z-10">
          <p>ID: {assistantId}</p>
          <p>Description: {assistantDescription || 'Not provided'}</p>
          <p>Role: {assistantRole || 'Not provided'}</p>
        </div>
      </div>
      {groupType && <div className="ml-auto text-xl font-bold text-neutral-800 dark:text-neutral-100  py-1">{groupType}</div>}
    </div>
  );

  // Log assistant name whenever it changes - for debugging
  useEffect(() => {
    // Removed debug logging
  }, [assistantName]);

  // Loading state
  if (loading) {
    return (
      <MainLayout
        title="Loading Assistant"
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
  if (error) {
    return (
      <MainLayout
        title="Error"
        theme={lightMode}
        showLeftSidebar={false}
        showRightSidebar={false}
      >
        <div className="flex h-full items-center justify-center bg-white dark:bg-[#343541]">
          <div className="text-center p-8 max-w-md bg-white dark:bg-gray-700 rounded-lg shadow-lg">
            <div className="mb-4 text-2xl text-red-500 font-bold">{t('Error') || 'Error'}</div>
            <div className="mb-6 text-gray-700 dark:text-gray-300">{error}</div>
            <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Please check the path in your URL and try again. If you believe this is an error, contact your administrator.
            </div>
            <button 
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 transition-colors"
              onClick={() => router.push('/')}
            >
              {t('Go Home') || 'Go Home'}
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
      title={`${assistantName}`}
      description={`Chat with ${assistantName}`}
      theme={lightMode}
      header={headerContent}
      leftSidebar={leftSidebarContent}
      rightSidebar={rightSidebarContent}
    >
      {/* Model selector above messages */}
      <div className="bg-white dark:bg-[#343541] border-b border-neutral-200 dark:border-neutral-600 py-4 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-center">
            <div className="w-full max-w-xl px-4 z-60">
                  <ModelSelect modelId={assistantDefinition?.data?.model || activeModel?.id} 
                              isDisabled={!!assistantDefinition?.data?.model}
                              handleModelChange={handleModelChange}
                              models={models}
                              defaultModelId={defaultModel?.id}
                  />
            </div>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto py-4 px-6 bg-white dark:bg-[#343541]">
        {messages.length === 0 ? (
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
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((message, index) => (
              <div 
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`amplify-message-container ${
                    message.role === 'user' 
                      ? 'amplify-user-message' 
                      : 'amplify-assistant-message'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-neutral-100 dark:bg-[#444654] px-4 py-3 rounded-lg flex items-center">
                  <Spinner />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-neutral-200 dark:border-neutral-600 bg-white dark:bg-[#343541] py-4 px-6">
        <div className="max-w-3xl mx-auto">
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
                onClick={handleSendMessage}
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
  
  // Redirect to login if no session
  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
  
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