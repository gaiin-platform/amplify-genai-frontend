/**
 * ConversationComposer — spec §7 docked composer for the conversation view.
 *
 * Sits at the bottom of ConversationViewShell as an overlay on top of Chat's
 * hidden ChatInput. User interactions here wire into Chat's hidden textarea and
 * send button via DOM bridge (same mechanism as the NewHome pending-message
 * bridge). All actual send/upload/plugin logic stays in ChatInput — we're
 * purely a visual layer.
 *
 * Spec §7 geometry:
 *   width:      --dock-w  = column-w + 48px  (inner text aligns with messages)
 *   min-height: 128px
 *   background: --bg-raised
 *   border:     1px --border-subtle
 *   radius:     14px
 *   padding:    16px 24px 12px
 *   bands:      textarea (auto-grows) | toolbar (36px fixed)
 *
 * Toolbar left:   ⊕ AttachMenu  [active chips]
 * Toolbar right:  ModelPicker  mic  send/voice slot
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  IconArrowUp,
  IconMicrophone,
  IconPlayerStop,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { AttachMenu, AttachMenuChips } from '@/components/NewUI/shared/AttachMenu';
import { ModelPicker, type EffortLevel } from '@/components/NewUI/shared/ModelPicker';
import { AttachmentRail } from '@/components/NewUI/shared/AttachmentRail';
import { AttachmentPreview } from '@/components/NewUI/shared/AttachmentPreview';
import {
  UIAttachment,
  createPasteAttachment,
  PASTE_AS_FILE_THRESHOLD,
} from '@/components/NewUI/shared/attachmentTypes';
import { PluginID, Plugin, Plugins } from '@/types/plugin';
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import { persistWebSearchPluginPreference } from '@/components/NewUI/shared/webSearchPreference';

/** Inject value into a React-controlled textarea via native setter. */
function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (setter) {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export const ConversationComposer: React.FC = () => {
  const {
    state: {
      selectedConversation,
      selectedAssistant,
      availableModels,
      defaultModelId,
      featureFlags,
      ragOn,
      chatEndpoint,
      messageIsStreaming,
    },
    dispatch,
    handleUpdateConversation,
  } = useContext(HomeContext);

  // ── Local state ────────────────────────────────────────────────────────────
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<{ focus: () => void }>({
    focus: () => textareaRef.current?.focus(),
  });

  // Model/effort — mirror what the conversation is currently using
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    selectedConversation?.model?.id ?? defaultModelId ?? undefined,
  );
  const [selectedEffort, setSelectedEffort] = useState<EffortLevel>('medium');

  // Keep selectedModelId in sync with conversation model changes
  useEffect(() => {
    const convModelId = selectedConversation?.model?.id;
    if (convModelId) setSelectedModelId(convModelId);
  }, [selectedConversation?.model?.id]);

  // ── Plugins (for AttachMenu feature gating) ───────────────────────────────
  const activeLandingPlugins: Plugin[] = [
    ...(featureFlags.webSearch ? [Plugins[PluginID.WEB_SEARCH]] : []),
    ...(featureFlags.skills ? [Plugins[PluginID.SKILLS]] : []),
  ].filter(Boolean);

  // ── Toggle state ──────────────────────────────────────────────────────────
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    selectedConversation?.data?.webSearchEnabled ?? false,
  );
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(
    selectedConversation?.data?.skills ?? [],
  );

  const activeAssistantName =
    selectedAssistant && selectedAssistant.id !== DEFAULT_ASSISTANT.id
      ? selectedAssistant.definition?.name
      : undefined;

  // ── Auto-grow textarea ─────────────────────────────────────────────────────
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 12 * 24; // 12 lines at ~24px per line
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  // ── Send — bridge into Chat's hidden ChatInput ────────────────────────────
  const handleSend = useCallback(() => {
    if (!text.trim() || messageIsStreaming) return;

    const hiddenTextarea = document.getElementById(
      'messageChatInputText',
    ) as HTMLTextAreaElement | null;
    const hiddenSend = document.getElementById(
      'sendMessage',
    ) as HTMLButtonElement | null;

    if (!hiddenTextarea || !hiddenSend) return;

    // Update conversation model if the user changed it
    if (
      selectedConversation &&
      selectedModelId &&
      availableModels[selectedModelId] &&
      selectedConversation.model?.id !== selectedModelId
    ) {
      handleUpdateConversation(selectedConversation, {
        key: 'model',
        value: availableModels[selectedModelId],
      });
    }

    // Persist web search toggle to the conversation
    if (selectedConversation) {
      handleUpdateConversation(selectedConversation, {
        key: 'data',
        value: {
          ...selectedConversation.data,
          webSearchEnabled,
          skills: selectedSkillIds,
          skillSelectionMode: 'auto',
        },
      });
    }

    const msgText = text;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Inject into Chat's hidden textarea and click send
    setTimeout(() => {
      setNativeValue(hiddenTextarea, msgText);
      setTimeout(() => {
        hiddenSend.click();
      }, 60);
    }, 30);
  }, [
    text,
    messageIsStreaming,
    selectedConversation,
    selectedModelId,
    availableModels,
    webSearchEnabled,
    selectedSkillIds,
    handleUpdateConversation,
  ]);

  // ── Stop generation ───────────────────────────────────────────────────────
  const handleStop = () => {
    const stopBtn = document.getElementById(
      'stopGenerating',
    ) as HTMLButtonElement | null;
    stopBtn?.click();
  };

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Model change ──────────────────────────────────────────────────────────
  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    if (selectedConversation && availableModels[modelId]) {
      handleUpdateConversation(selectedConversation, {
        key: 'model',
        value: availableModels[modelId],
      });
    }
  };

  // ── Attachment rail ────────────────────────────────────────────────────────
  const [uiAttachments, setUIAttachments] = useState<UIAttachment[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOriginRect, setPreviewOriginRect] = useState<DOMRect | undefined>(undefined);
  // object-URL store for image thumbnails (revoke on remove)
  const thumbUrlsRef = useRef<Record<string, string>>({});

  const handleRemoveAttachment = (id: string) => {
    if (thumbUrlsRef.current[id]) {
      URL.revokeObjectURL(thumbUrlsRef.current[id]);
      delete thumbUrlsRef.current[id];
    }
    setUIAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  /** Add an image File to the rail, generating a thumbnail object-URL first. */
  const addImageToRail = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      const url = URL.createObjectURL(file);
      // Build a minimal UIAttachment directly — no handleFile needed for display
      const id = Math.random().toString(36).slice(2);
      thumbUrlsRef.current[id] = url;
      const ua: UIAttachment = {
        id,
        kind: 'image',
        status: 'ready',
        name: file.name || 'pasted-image.png',
        ext: null,
        bytes: file.size,
        mime: file.type,
        thumbUrl: url,
        previewState: 'available',
      };
      setUIAttachments((prev) => [...prev, ua]);
    } catch {
      // silently ignore — user sees no card but the file isn't lost
    }
  }, []);

  // Large-paste interception in the plain textarea (spec §6)
  const handleTextareaPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // Check for image data first
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        e.preventDefault();
        const file = imageItem.getAsFile();
        if (file) addImageToRail(file);
        return;
      }

      const pastedText = e.clipboardData.getData('text/plain');
      if (pastedText.length >= PASTE_AS_FILE_THRESHOLD) {
        e.preventDefault(); // do not let text land in textarea
        setUIAttachments((prev) => [...prev, createPasteAttachment(pastedText)]);
        return;
      }
      // Smaller pastes fall through to the default textarea behaviour
    },
    [addImageToRail],
  );

  const canSend =
    (!messageIsStreaming && text.trim().length > 0) ||
    uiAttachments.some((a) => a.status === 'ready');

  return (
    <div
      className="new-ui-composer-dock"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 25,
        padding: '0 24px 20px',
        background: 'linear-gradient(to bottom, transparent, var(--bg-app) 32px)',
        pointerEvents: 'none',
      }}
    >
      {/* Centered dock column — matches --dock-w (column-w + 2 × 24px pad) */}
      <div
        style={{
          maxWidth: 'calc(min(74ch, calc(100% - 48px)) + 48px)',
          margin: '0 auto',
          pointerEvents: 'auto',
        }}
      >
        {/* Composer card — 3-band grid: rail | textarea | toolbar */}
        <div
          className="new-ui-composer-card"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            padding: '16px 24px 12px',
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            gap: 0,
            minHeight: 88,
            transition: 'border-color 0.15s',
          }}
          onClick={() => textareaRef.current?.focus()}
        >
          {/* ── Band 1: Attachment rail (collapses to 0 when empty) ── */}
          <AttachmentRail
            attachments={uiAttachments}
            onRemove={handleRemoveAttachment}
            onPreview={(id, rect) => {
              setPreviewId(id);
              setPreviewOriginRect(rect);
            }}
          />

          {/* ── Band 2: Textarea ── */}
          {/* aria-label because a visible <label> element isn't used in this layout (WCAG SC 1.3.1 / 4.1.2) */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handleTextareaPaste}
            data-composer-textarea="true"
            placeholder="Write a message…"
            aria-label="Message input"
            aria-multiline="true"
            rows={1}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              width: '100%',
              fontSize: 15,
              lineHeight: '1.55',
              color: 'var(--text-primary)',
              fontFamily: 'Inter, sans-serif',
              overflowY: 'hidden',
              padding: 0,
              minHeight: '1.55em',
            }}
          />

          {/* ── Band 3: Toolbar (36px) ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 36,
              marginTop: 10,
            }}
          >
            {/* Left: attach + chips */}
            <div className="flex items-center gap-2">
              <AttachMenu
                isNewChat={false}
                plugins={activeLandingPlugins}
                onAddFiles={() => {
                  const input = document.getElementById('__attachFile') as HTMLInputElement | null;
                  if (input) input.click();
                  else {
                    // Fallback: trigger ChatInput's upload button
                    const uploadBtn = document.getElementById('uploadFile') as HTMLButtonElement | null;
                    uploadBtn?.click();
                  }
                }}
                onAddFromLibrary={() => {
                  const viewFilesBtn = document.getElementById('viewFiles') as HTMLButtonElement | null;
                  viewFilesBtn?.click();
                }}
                webSearchEnabled={webSearchEnabled}
                onToggleWebSearch={() => {
                  setWebSearchEnabled((v: boolean) => {
                    const next = !v;
                    // Seed Chat.tsx's plugins array (via the shared settings
                    // utility) as early as possible — see webSearchPreference.ts
                    // for why this is necessary and what it does not cover.
                    if (next) persistWebSearchPluginPreference(featureFlags);
                    return next;
                  });
                }}
                selectedSkillIds={selectedSkillIds}
                onSkillsChange={setSelectedSkillIds}
                chatEndpoint={chatEndpoint ?? undefined}
                composerRef={composerRef}
              />
              <AttachMenuChips
                webSearchEnabled={webSearchEnabled}
                onRemoveWebSearch={() => setWebSearchEnabled(false)}
                selectedSkillIds={selectedSkillIds}
                onRemoveSkills={() => setSelectedSkillIds([])}
                assistantName={activeAssistantName}
                onRemoveAssistant={() => dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT })}
              />
            </div>

            {/* Right: model picker + mic + send/stop */}
            <div className="flex items-center gap-2">
              <ModelPicker
                selectedModelId={selectedModelId}
                selectedEffort={selectedEffort}
                onModelChange={handleModelChange}
                onEffortChange={setSelectedEffort}
                isNewChat={false}
                composerRef={composerRef}
              />

              {/*
               * §7 Send ↔ Voice ↔ Stop slot (32×32, zero layout shift).
               * One slot, three possible occupants — all absolutely positioned,
               * cross-fading via opacity+pointer-events over 120ms:
               *   streaming    → Stop button  (--bg-active, PlayerStop icon)
               *   idle + empty → Voice button (transparent, mic icon, 28×28)
               *   idle + text  → Send button  (--accent, ArrowUp icon)
               */}
              <div className="relative w-[32px] h-[32px]">
                {/* Stop — when streaming */}
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center rounded-[8px] transition-all duration-[120ms]"
                  style={{
                    background: 'var(--bg-active)',
                    color: 'var(--text-primary)',
                    opacity: messageIsStreaming ? 1 : 0,
                    pointerEvents: messageIsStreaming ? 'auto' : 'none',
                  }}
                  onClick={handleStop}
                  title="Stop generating"
                  aria-label="Stop generating"
                >
                  <IconPlayerStop size={16} />
                </button>

                {/* Voice — idle + empty composer */}
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center rounded-[8px] transition-all duration-[120ms]"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    opacity: (!messageIsStreaming && !canSend) ? 1 : 0,
                    pointerEvents: (!messageIsStreaming && !canSend) ? 'auto' : 'none',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  title="Voice input"
                  aria-label="Voice input"
                >
                  <IconMicrophone size={17} />
                </button>

                {/* Send — idle + has content */}
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center rounded-[8px] transition-all duration-[120ms]"
                  style={{
                    background: 'var(--accent)',
                    color: '#2A1710',
                    opacity: (!messageIsStreaming && canSend) ? 1 : 0,
                    pointerEvents: (!messageIsStreaming && canSend) ? 'auto' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={handleSend}
                  title="Send (Enter)"
                  aria-label="Send message"
                >
                  <IconArrowUp size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer — spec §8 */}
        <p
          style={{
            textAlign: 'center',
            fontSize: 11.5,
            color: 'var(--text-muted)',
            marginTop: 8,
            lineHeight: 1.4,
          }}
        >
          Amplify can make mistakes. Verify important information.
        </p>
      </div>

      {/* Attachment preview overlay */}
      {previewId && (
        <AttachmentPreview
          attachments={uiAttachments}
          initialIndex={uiAttachments.findIndex((a) => a.id === previewId)}
          originRect={previewOriginRect}
          onClose={() => { setPreviewId(null); setPreviewOriginRect(undefined); }}
        />
      )}
    </div>
  );
};

export default ConversationComposer;
