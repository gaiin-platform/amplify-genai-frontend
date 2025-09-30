#!/bin/bash

# Build v21: Complete fix including auth, chat display, and environment variables
# This build integrates all fixes identified by the sub-agents

set -e

echo "=== Amplify Frontend Build v21: Complete Integration ==="
echo "Includes:"
echo "  - Proper Cognito authentication configuration"
echo "  - Chat text display fixes (SSE format and memoization)"
echo "  - Missing environment variables"
echo "  - Clean build with no stale artifacts"

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .env.production.local

# Create comprehensive .env.production with ALL required variables
echo "Creating comprehensive .env.production..."
cat > .env.production << 'EOL'
# NextAuth Configuration
NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4=
NEXTAUTH_URL=https://hfu-amplify.org

# Cognito Configuration
COGNITO_CLIENT_ID=2rq8ekafegrh5mcd51q80rt0bh
COGNITO_CLIENT_SECRET=p2np9r5nt5nptnc74gv65q7siigo8a0rim211ai1nqmqvl7ssuk
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PgwOR439P
COGNITO_DOMAIN=https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com

# API Endpoints
CHAT_ENDPOINT=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod/amplify/chat
API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod

# LLM Router endpoint
NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm

# Authentication Provider Configuration
NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito
NEXT_PUBLIC_AUTH_ENABLED=true

# Feature Flags
NEXT_PUBLIC_ENABLE_STREAMING=true
NEXT_PUBLIC_ENABLE_CANVAS_INTEGRATION=false

# Analytics (optional)
MIXPANEL_TOKEN=
NEXT_PUBLIC_MIXPANEL_TOKEN=

# Application Configuration
NEXT_PUBLIC_APP_NAME="HFU Amplify"
NEXT_PUBLIC_APP_VERSION="1.0.21"

# Telemetry disabled
NEXT_TELEMETRY_DISABLED=1
EOL

# Apply chat text display fixes before building
echo "Applying chat text display fixes..."

# Fix 1: Update amplify-handler.ts to send proper OpenAI format
cat > pages/api/chat/amplify-handler.ts << 'EOL'
import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = await getToken({ req });
    if (!token || !token.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { messages, model, stream = true } = req.body;

    // Forward to Amplify backend
    const amplifyEndpoint = process.env.CHAT_ENDPOINT || 'https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod/amplify/chat';
    
    const response = await fetch(amplifyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.accessToken}`,
      },
      body: JSON.stringify({
        messages,
        model,
        stream
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Amplify backend error:', error);
      return res.status(response.status).json({ error });
    }

    if (stream && response.body) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const reader = response.body;
      reader.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            // Parse Amplify format and convert to OpenAI format
            if (line.startsWith('data: ')) {
              try {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  res.write('data: [DONE]\n\n');
                } else {
                  // Extract content and send in OpenAI format
                  const parsed = JSON.parse(data);
                  const content = parsed.content || parsed.chunk || '';
                  if (content) {
                    res.write(`data: {"choices":[{"delta":{"content":"${content}"}}]}\n\n`);
                  }
                }
              } catch (e) {
                // If not JSON, treat as plain text
                res.write(`data: {"choices":[{"delta":{"content":"${data}"}}]}\n\n`);
              }
            }
          }
        }
      });

      reader.on('end', () => res.end());
      reader.on('error', (err: Error) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
EOL

# Fix 2: Update MemoizedChatMessage to handle streaming properly
echo "Fixing MemoizedChatMessage for proper streaming updates..."
cat > components/Chat/MemoizedChatMessage.tsx << 'EOL'
import { IconCheck, IconCopy, IconEdit, IconRobot, IconTrash, IconUser, IconExternalLink, IconReload } from '@tabler/icons-react';
import { FC, memo, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { updateConversation } from '@/utils/app/conversation';
import { Message } from '@/types/chat';
import { AuthContext } from '../Auth/AuthContext';
import { CodeBlock } from '../Markdown/CodeBlock';
import { MemoizedReactMarkdown } from '../Markdown/MemoizedReactMarkdown';
import HomeContext from '@/pages/api/home/home.context';

export interface Props {
  message: Message;
  messageIndex: number;
  onEdit?: (editedMessage: Message) => void;
}

export const MemoizedChatMessage: FC<Props> = memo(
  ({ message, messageIndex, onEdit }) => {
    const { t } = useTranslation('chat');
    const {
      state: { selectedConversation, conversations, currentMessage, messageIsStreaming },
      dispatch: homeDispatch,
    } = useContext(HomeContext);

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content || '');
    const [messagedCopied, setMessageCopied] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Update content when streaming
    useEffect(() => {
      setMessageContent(message.content || '');
    }, [message.content]);

    const toggleEditing = () => {
      setIsEditing(!isEditing);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessageContent(event.target.value);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'inherit';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    };

    const handleEditSave = () => {
      if (message.content !== messageContent) {
        if (selectedConversation && onEdit) {
          onEdit({ ...message, content: messageContent });
        }
      }
      setIsEditing(false);
    };

    const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
        e.preventDefault();
        handleEditSave();
      }
    };

    const copyOnClick = () => {
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(message.content || '').then(() => {
        setMessageCopied(true);
        setTimeout(() => {
          setMessageCopied(false);
        }, 2000);
      });
    };

    return (
      <div
        className={`group md:px-4 ${
          message.role === 'assistant'
            ? 'border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100'
            : 'border-b border-black/10 bg-white text-gray-800 dark:border-gray-900/50 dark:bg-[#343541] dark:text-gray-100'
        }`}
        style={{ overflowWrap: 'anywhere' }}
      >
        <div className="relative m-auto flex p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
          <div className="min-w-[40px] text-right font-bold">
            {message.role === 'assistant' ? (
              <IconRobot size={30} />
            ) : (
              <IconUser size={30} />
            )}
          </div>

          <div className="prose mt-[-2px] w-full dark:prose-invert">
            {message.role === 'user' ? (
              <div className="flex w-full">
                {isEditing ? (
                  <div className="flex w-full flex-col">
                    <textarea
                      ref={textareaRef}
                      className="w-full resize-none whitespace-pre-wrap border-none outline-none dark:bg-[#343541]"
                      value={messageContent}
                      onChange={handleInputChange}
                      onKeyDown={handlePressEnter}
                      onCompositionStart={() => setIsTyping(true)}
                      onCompositionEnd={() => setIsTyping(false)}
                      style={{
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        lineHeight: 'inherit',
                        padding: '0',
                        margin: '0',
                        overflow: 'hidden',
                      }}
                    />
                    <div className="mt-10 flex justify-center space-x-4">
                      <button
                        className="h-[40px] rounded-md bg-blue-500 px-4 py-1 text-sm font-medium text-white enabled:hover:bg-blue-600 disabled:opacity-50"
                        onClick={handleEditSave}
                        disabled={messageContent.trim().length <= 0}
                      >
                        {t('Save & Submit')}
                      </button>
                      <button
                        className="h-[40px] rounded-md border border-neutral-300 px-4 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        onClick={() => {
                          setMessageContent(message.content || '');
                          setIsEditing(false);
                        }}
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose whitespace-pre-wrap dark:prose-invert flex-1">
                    {message.content || ''}
                  </div>
                )}

                {!isEditing && (
                  <div className="ml-1 flex flex-col items-center justify-end gap-4 md:ml-0 md:flex-row md:items-start md:justify-start md:gap-1">
                    <button
                      className="invisible text-gray-500 hover:text-gray-700 focus:visible group-hover:visible dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={toggleEditing}
                    >
                      <IconEdit size={20} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-row">
                <MemoizedReactMarkdown
                  className="prose dark:prose-invert flex-1"
                  children={messageContent}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      if (children && children.length) {
                        if (children[0] == '▍') {
                          return <span className="animate-pulse cursor-default mt-1">▍</span>;
                        }

                        if (!inline) {
                          return (
                            <CodeBlock
                              key={Math.random()}
                              language={(className || '').replace(/^language-/, '')}
                              value={String(children).replace(/\n$/, '')}
                              {...props}
                            />
                          );
                        }
                      }
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    table({ children }) {
                      return (
                        <table className="border-collapse border border-black px-3 py-1 dark:border-white">
                          {children}
                        </table>
                      );
                    },
                    th({ children }) {
                      return (
                        <th className="break-words border border-black bg-gray-500 px-3 py-1 text-white dark:border-white">
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="break-words border border-black px-3 py-1 dark:border-white">
                          {children}
                        </td>
                      );
                    },
                  }}
                />

                <div className="ml-1 flex flex-col items-center justify-end gap-4 md:ml-0 md:flex-row md:items-start md:justify-start md:gap-1">
                  {messagedCopied ? (
                    <IconCheck
                      size={20}
                      className="text-green-500 dark:text-green-400"
                    />
                  ) : (
                    <button
                      className="invisible text-gray-500 hover:text-gray-700 focus:visible group-hover:visible dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={copyOnClick}
                    >
                      <IconCopy size={20} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Re-render when content changes (for streaming) or index changes
    return (
      prevProps.message.content === nextProps.message.content &&
      prevProps.messageIndex === nextProps.messageIndex
    );
  },
);

MemoizedChatMessage.displayName = 'MemoizedChatMessage';
EOL

# Build the application
echo "Building Next.js application..."
npm run build

# Create the Docker image
echo "Building Docker image..."
docker build -t hfu-amplify-frontend:v21 \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  --build-arg NEXT_PUBLIC_APP_NAME="HFU Amplify" \
  --build-arg NEXT_PUBLIC_APP_VERSION="1.0.21" \
  .

# Tag for ECR
echo "Tagging for ECR..."
docker tag hfu-amplify-frontend:v21 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-amplify-repo:v21
docker tag hfu-amplify-frontend:v21 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-amplify-repo:latest

echo ""
echo "=== Build v21 Complete ==="
echo ""
echo "This build includes:"
echo "✓ Proper Cognito authentication configuration"
echo "✓ SSE format fixes for chat text display"
echo "✓ React memoization fixes for streaming updates"
echo "✓ All required environment variables"
echo "✓ Clean build with no stale artifacts"
echo ""
echo "To deploy to production:"
echo "1. Push to ECR:"
echo "   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com"
echo "   docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-amplify-repo:v21"
echo "   docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-amplify-repo:latest"
echo ""
echo "2. Update ECS service:"
echo "   aws ecs update-service --cluster hfu-amplify-cluster --service hfu-amplify-service --force-new-deployment"
echo ""
echo "3. Update task definition with proper environment variables"