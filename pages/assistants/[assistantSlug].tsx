import { useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { getSession, useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { getAvailableModels } from '@/services/adminService';
import { sendDirectAssistantMessage } from '@/services/assistantService';
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
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantId, setAssistantId] = useState('');
  const [assistantName, setAssistantName] = useState('Assistant');
  const [theme, setTheme] = useState('dark');
  const [defaultModel, setDefaultModel] = useState<any>(null);

  // Mapping from slug to assistant ID - in a real implementation, this would come from a database or API
  const assistantMapping: Record<string, string> = {
    'giteval': 'astp/9d156975-b6d7-474e-8c8e-3a3601359416'
  };

  // Initialize the page
  useEffect(() => {
    const setupPage = async () => {
      try {
        // Load models
        const modelsResponse = await getAvailableModels();
        if (!modelsResponse.success) {
          throw new Error("Failed to load models");
        }
        
        setDefaultModel(modelsResponse.data.default);
        
        // Look up assistant ID from slug
        const slugFromRoute = router.query.assistantSlug as string;
        const assistantIdFromSlug = assistantMapping[slugFromRoute];
        
        if (!assistantIdFromSlug) {
          setError(`Assistant not found for slug: ${slugFromRoute}`);
          setLoading(false);
          return;
        }

        // Set the assistant info
        setAssistantId(assistantIdFromSlug);
        setAssistantName(slugFromRoute.charAt(0).toUpperCase() + slugFromRoute.slice(1));
        
        // Done loading
        setLoading(false);
      } catch (error) {
        console.error("Error setting up assistant page:", error);
        setError("Failed to initialize the assistant interface.");
        setLoading(false);
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
        // Filter out the last message since we're sending it separately
        messages.filter((_, idx) => idx < messages.length - 1)
      );
      
      if (!result.success) {
        throw new Error("Failed to get response from assistant");
      }
      
      // Process the streaming response
      const response = result.response;
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

  // Handle key press (submit on Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <div className="text-center">
          <div className="mb-4 text-4xl">Loading...</div>
          <div className="text-gray-500 dark:text-gray-400">Please wait while we set up the assistant.</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <div className="text-center">
          <div className="mb-4 text-2xl text-red-500">{t('Error')}</div>
          <div className="mb-4">{error}</div>
          <button 
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            onClick={() => router.push('/')}
          >
            {t('Go Home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${theme === 'dark' ? 'dark bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
      <Head>
        <title>{`Chat with ${assistantName}`}</title>
        <meta name="description" content={`Chat with ${assistantName} assistant`} />
        <meta name="viewport" content="height=device-height, width=device-width, initial-scale=1, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow flex justify-between items-center">
        <h1 className="text-xl font-bold">{assistantName}</h1>
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p>{t('Start a conversation with the assistant')}</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index}
              className={`${
                message.role === 'user' 
                  ? 'bg-blue-100 dark:bg-blue-900 ml-auto' 
                  : 'bg-gray-100 dark:bg-gray-700 mr-auto'
              } p-3 rounded-lg max-w-3/4 whitespace-pre-wrap`}
            >
              {message.content}
            </div>
          ))
        )}
        {isProcessing && (
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mr-auto">
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-300 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-300 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-300 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t('Type your message here...')}
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            rows={2}
            disabled={isProcessing}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isProcessing}
            className={`px-4 py-2 bg-blue-500 text-white rounded-lg ${
              !inputMessage.trim() || isProcessing 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-blue-600'
            }`}
          >
            {isProcessing ? t('Sending...') : t('Send')}
          </button>
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