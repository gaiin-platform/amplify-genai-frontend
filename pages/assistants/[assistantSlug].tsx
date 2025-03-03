import { useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { getSession, useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { IconMessage, IconSend } from '@tabler/icons-react';
import { getAvailableModels } from '@/services/adminService';
import { sendDirectAssistantMessage, lookupAssistant } from '@/services/assistantService';
import { getSettings } from '@/utils/app/settings';
import { LoadingDialog } from '@/components/Loader/LoadingDialog';
import Spinner from '@/components/Spinner';
import { Theme } from '@/types/settings';
import { v4 as uuidv4 } from 'uuid';

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
  const [lightMode, setLightMode] = useState<Theme>('dark');
  const [defaultModel, setDefaultModel] = useState<any>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load user's theme preference from settings
  useEffect(() => {
    try {
      const savedSettings = getSettings({});
      setLightMode(savedSettings.theme);
    } catch (e) {
      console.error('Failed to load user settings:', e);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize the page
  useEffect(() => {
    const setupPage = async () => {
      setLoadingMessage('Initializing Assistant...');
      try {
        // Load models
        const modelsResponse = await getAvailableModels();
        if (!modelsResponse.success) {
          throw new Error("Failed to load models");
        }
        
        setDefaultModel(modelsResponse.data.default);
        
        // Look up assistant ID from slug
        const slugFromRoute = router.query.assistantSlug as string;
        
        console.log(`Looking up assistant for slug: ${slugFromRoute}`);
        // Use the lookupAssistant service to get the assistantId from the path
        const lookupResult = await lookupAssistant(slugFromRoute);
        console.log('Lookup result from service:', lookupResult);
        
        if (!lookupResult.success || !lookupResult.assistantId) {
          console.error('Assistant lookup failed:', lookupResult);
          setError(`Path not found: "${slugFromRoute}". This assistant path doesn't exist or you may not have permission to access it.`);
          setLoading(false);
          setLoadingMessage('');
          return;
        }

        // Set the assistant info
        console.log(`Setting assistant ID to: ${lookupResult.assistantId}`);
        setAssistantId(lookupResult.assistantId);
        setAssistantName(slugFromRoute.charAt(0).toUpperCase() + slugFromRoute.slice(1));
        
        // Done loading
        setLoading(false);
        setLoadingMessage('');
      } catch (error) {
        console.error("Error setting up assistant page:", error);
        setError("Failed to initialize the assistant interface.");
        setLoading(false);
        setLoadingMessage('');
      }
    };

    if (router.query.assistantSlug) {
      setupPage();
    }
  }, [router.query.assistantSlug, chatEndpoint]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing || !chatEndpoint) return;
    
    // Add user message to the chat
    const userMessage = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);
    
    try {
      // Send the message to the assistant with conversation history
      const result = await sendDirectAssistantMessage(
        chatEndpoint,
        assistantId,
        assistantName,
        inputMessage,
        defaultModel,
        // Send all previous messages for context
        messages
      );
      
      if (!result.success) {
        throw new Error("Failed to get response from assistant");
      }
      
      // Process the streaming response
      const response = result.response;
      if (!response || !response.body) {
        throw new Error("Invalid response format");
      }
      
      const data = response.body;
      const reader = data.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let text = '';
      
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        text += chunkValue;
        
        // Update the assistant message as it streams in
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', content: text }];
          } else {
            return [...prev, { role: 'assistant', content: text }];
          }
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error processing your request.' }]);
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

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingDialog open={true} message={loadingMessage || "Setting up the assistant..."} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex h-screen items-center justify-center ${lightMode}`}>
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
    );
  }

  return (
    <div className={`flex flex-col h-screen w-screen ${lightMode}`}>
      <Head>
        <title>{`Chat with ${assistantName}`}</title>
        <meta name="description" content={`Chat with ${assistantName} assistant`} />
        <meta name="viewport" content="height=device-height, width=device-width, initial-scale=1, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-600 bg-white dark:bg-[#202123] py-4 px-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <IconMessage className="text-neutral-500 dark:text-neutral-400" size={24} />
          <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{assistantName}</h1>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto py-4 px-6 bg-white dark:bg-[#343541]">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-neutral-500 dark:text-neutral-400">
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
                  className={`px-4 py-3 rounded-lg max-w-[85%] whitespace-pre-wrap ${
                    message.role === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-neutral-100 dark:bg-[#444654] text-neutral-900 dark:text-neutral-100'
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
      <div className="border-t border-neutral-200 dark:border-neutral-600 bg-white dark:bg-[#202123] py-4 px-6">
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
                  !inputMessage.trim() || isProcessing
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-neutral-200 dark:hover:bg-neutral-600'
                } p-1.5 rounded-md`}
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isProcessing}
                aria-label="Send message"
              >
                <IconSend size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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