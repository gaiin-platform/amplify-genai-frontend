/**
 * NewHome — landing page shown when page='chat' and the conversation has 0 messages.
 * Greeting ✳ + display-serif headline + RichComposer.
 *
 * Composer uses RichComposer (contentEditable):
 *   - Single line by default, grows with content
 *   - ``` + Shift+Enter → inserts an inline code block
 *   - Enter → sends
 *   - Shift+Enter → newline / newline inside code block
 */
import React, { useContext, useRef } from 'react';
import {
  IconPaperclip,
  IconMicrophone,
  IconChevronDown,
  IconArrowUp,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { RichComposer, type RichComposerHandle } from '@/components/NewUI/shared/RichComposer';

export const NewHome: React.FC = () => {
  const {
    state: { availableModels, defaultModelId },
    handleNewConversation,
  } = useContext(HomeContext);

  const composerRef = useRef<RichComposerHandle>(null);

  const handleSend = (markdown: string) => {
    const trimmed = markdown.trim();
    if (!trimmed) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('amplify_pending_message', trimmed);
    }
    handleNewConversation({});
    composerRef.current?.clear();
  };

  // Build model list from availableModels state
  const modelList = Object.values(availableModels as Record<string, { id: string; name: string }>) ?? [];
  const activeModel = defaultModelId
    ? (availableModels as any)[defaultModelId]
    : modelList[0];
  const activeModelName = activeModel?.name ?? activeModel?.id ?? 'Select model';

  return (
    <div
      className="relative flex-1 flex flex-col items-center justify-start bg-[--bg-app] overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* Centered content column */}
      <div
        className="w-full max-w-[760px] px-6 flex flex-col items-center"
        style={{ paddingTop: 'max(72px, 26vh)' }}
      >
        {/* Greeting — centered */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <span
            className="text-[28px] leading-none flex-shrink-0 select-none"
            style={{ color: 'var(--accent)' }}
            aria-hidden="true"
          >
            ✳
          </span>
          <h1
            className="text-[40px] text-[--text-primary] leading-none tracking-[-0.01em] text-center"
            style={{ fontFamily: '"Newsreader", "Georgia", serif', fontWeight: 400 }}
          >
            How can I help?
          </h1>
        </div>

        {/* Composer box */}
        <div
          className="
            w-full bg-[--bg-raised] rounded-[14px]
            border border-[--border-subtle]
            focus-within:border-[--bg-active]
            transition-colors duration-150
            p-4 pb-3
          "
          onClick={() => composerRef.current?.focus()}
        >
          {/* Rich composer — grows with content, supports ``` code blocks */}
          <RichComposer
            ref={composerRef}
            onSend={handleSend}
            placeholder="Ask anything…"
            editorClassName="max-h-[240px] overflow-y-auto"
            autoFocus
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-3 h-[34px]">
            {/* Left: attach */}
            <div className="flex items-center gap-2">
              <button
                className="w-[30px] h-[30px] flex items-center justify-center rounded-full text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors"
                title="Attach file"
                aria-label="Attach file"
                // Prevent click from blurring the editor
                onMouseDown={(e) => e.preventDefault()}
              >
                <IconPaperclip size={16} />
              </button>
            </div>

            {/* Right: model selector / mic / send */}
            <div className="flex items-center gap-1.5">
              {/* Model selector */}
              <button
                className="flex items-center gap-1 h-[30px] px-2.5 rounded-[8px] text-[13px] text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors"
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className="font-medium truncate max-w-[140px]">{activeModelName}</span>
                <IconChevronDown size={12} className="flex-shrink-0 text-[--text-muted]" />
              </button>

              <button
                className="w-[30px] h-[30px] flex items-center justify-center rounded-full text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors"
                title="Voice input"
                aria-label="Voice input"
                onMouseDown={(e) => e.preventDefault()}
              >
                <IconMicrophone size={16} />
              </button>

              {/* Send button — fires the composer's send */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const md = composerRef.current?.getValue() ?? '';
                  if (md.trim()) handleSend(md);
                }}
                className="
                  w-[30px] h-[30px] flex items-center justify-center
                  rounded-full text-white transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]
                "
                style={{ backgroundColor: 'var(--accent)' }}
                title="Send (Enter)"
                aria-label="Send message"
              >
                <IconArrowUp size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NewHome;
