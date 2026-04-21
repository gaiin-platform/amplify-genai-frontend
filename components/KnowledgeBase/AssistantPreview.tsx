/**
 * Assistant Preview
 *
 * Test chat interface for previewing how students will interact
 * with the knowledge base assistant.
 */

import { useState, useRef, useEffect } from 'react';
import {
  IconMessageCircle,
  IconSend,
  IconRefresh,
  IconInfoCircle,
  IconUser,
  IconRobot,
} from '@tabler/icons-react';
import { OfficeKnowledgeBase } from '@/types/knowledgeBase';

interface AssistantPreviewProps {
  knowledgeBase: OfficeKnowledgeBase;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Sample responses based on common questions
const SAMPLE_RESPONSES: Record<string, string> = {
  clubs: `Holy Family University has over 30 active student clubs! Here are some popular ones:

• **Student Government Association** - Leadership and advocacy
• **Campus Ministry** - Faith and community service
• **Psychology Club** - Academic and career development
• **Business Society** - Networking and professional growth
• **Nursing Club** - Healthcare profession preparation

Would you like more details about any specific club or how to join?`,

  events: `Here are some upcoming events:

📅 **Spring Fling 2026** - March 15, 7:00 PM
   Campus Quad - Live music, food trucks, and activities!

💼 **Career Fair** - March 22, 10:00 AM - 4:00 PM
   Student Center Ballroom - Meet 50+ employers

🎓 **Graduate Information Session** - March 25, 6:00 PM
   Virtual - Learn about master's programs

Would you like details about any specific event?`,

  hours: `**Student Engagement Office Hours:**

Monday - Friday: 8:30 AM - 5:00 PM
Saturday: Closed
Sunday: Closed

**Location:** Student Center, Room 210

You can also reach us at:
📧 studentengagement@holyfamily.edu
📞 (267) 341-3000

Is there something specific I can help you with?`,

  default: `I'd be happy to help! I have information about:

• **Clubs & Organizations** - Student groups and how to join
• **Upcoming Events** - Campus activities and programs
• **Office Hours & Contact** - How to reach our team
• **Resources** - Forms, guides, and helpful links

What would you like to know more about?`,
};

export default function AssistantPreview({ knowledgeBase }: AssistantPreviewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm the ${knowledgeBase.officeName} assistant. I can help you with information about events, clubs, resources, and more. What would you like to know?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const generateResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();

    if (lower.includes('club') || lower.includes('organization') || lower.includes('join')) {
      return SAMPLE_RESPONSES.clubs;
    }
    if (lower.includes('event') || lower.includes('happening') || lower.includes('upcoming')) {
      return SAMPLE_RESPONSES.events;
    }
    if (lower.includes('hour') || lower.includes('contact') || lower.includes('office')) {
      return SAMPLE_RESPONSES.hours;
    }

    return SAMPLE_RESPONSES.default;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate typing delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

    const response = generateResponse(userMessage.content);

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setIsTyping(false);
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hi! I'm the ${knowledgeBase.officeName} assistant. I can help you with information about events, clubs, resources, and more. What would you like to know?`,
        timestamp: new Date(),
      },
    ]);
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Quick action buttons
  const quickActions = [
    { label: 'What clubs are available?', icon: '🎭' },
    { label: 'Upcoming events', icon: '📅' },
    { label: 'Office hours', icon: '🕐' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
                style={{ backgroundColor: knowledgeBase.color || '#4F46E5' }}
              >
                {knowledgeBase.icon || '💬'}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center">
                  <IconMessageCircle className="w-4 h-4 mr-1.5" />
                  {knowledgeBase.officeName} Assistant
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Preview Mode - Test your knowledge base
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
              title="Reset conversation"
            >
              <IconRefresh className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/50 flex items-center text-sm text-blue-700 dark:text-blue-300">
          <IconInfoCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>
            This preview uses sample responses. Live assistant will use your uploaded
            documents and events.
          </span>
        </div>

        {/* Messages */}
        <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-2 max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user'
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  {message.role === 'user' ? (
                    <IconUser className="w-4 h-4 text-white" />
                  ) : (
                    <IconRobot className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                  }`}
                >
                  {/* Render markdown-like content */}
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content.split('\n').map((line, i) => {
                      // Handle bold text
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      return (
                        <p key={i} className={i > 0 ? 'mt-2' : ''}>
                          {parts.map((part, j) =>
                            j % 2 === 1 ? (
                              <strong key={j}>{part}</strong>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </p>
                      );
                    })}
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user'
                        ? 'text-blue-200'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <IconRobot className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setInput(action.label);
                    setTimeout(() => handleSend(), 100);
                  }}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {action.icon} {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about events, clubs, or activities..."
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <IconSend className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Note */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
        Students will access this assistant through the main Amplify chat interface
      </p>
    </div>
  );
}
