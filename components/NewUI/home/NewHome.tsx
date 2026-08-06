/**
 * NewHome — landing page shown when page='chat' and the conversation has 0 messages.
 *
 * Composer toolbar (left cluster):
 *   [AttachMenu ⊕]  [active chips…]
 *
 * Composer toolbar (right cluster):
 *   [ModelPicker]  [🎙 when empty | ↑ when content]
 *
 * AttachMenu: spec-compliant ⊕ menu (attach-menu-spec.md)
 *   - Group 1: Add files or photos, Add from library
 *   - Group 2: Skills ›, Connectors ›
 *   - Group 3: Web search toggle
 *   - Active chips shown in toolbar for on toggles
 *
 * ModelPicker: spec v2 compliant (model-picker-spec2.md)
 *   - Trigger shows "[Model] [Effort] ⌄"
 *   - Expanded state: Opus/Sonnet/Haiku + Effort › + More models ›
 *
 * Send button: 32×32, radius 8px, --accent bg, dark glyph #2A1710
 */
import React, { useContext, useRef, useState, useCallback, useEffect } from 'react';
import {
  IconArrowUp,
  IconCheck,
  IconX,
  IconFile,
  IconMicrophone,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { RichComposer, type RichComposerHandle } from '@/components/NewUI/shared/RichComposer';
import { handleFile } from '@/components/Chat/AttachFile';
import { AttachedDocument } from '@/types/attacheddocument';
import { ModelPicker, type EffortLevel } from '@/components/NewUI/shared/ModelPicker';
import { AttachMenu, AttachMenuChips } from '@/components/NewUI/shared/AttachMenu';
import { PluginID, Plugin, Plugins } from '@/types/plugin';
import { DEFAULT_ASSISTANT } from '@/types/assistant';

export const NewHome: React.FC = () => {
  const {
    state: { availableModels, defaultModelId, featureFlags, ragOn, chatEndpoint, selectedAssistant },
    handleNewConversation,
    dispatch,
  } = useContext(HomeContext);

  // Active assistant (non-default) name for chip display
  const activeAssistantName =
    selectedAssistant && selectedAssistant.id !== DEFAULT_ASSISTANT.id
      ? selectedAssistant.definition?.name
      : undefined;

  const composerRef = useRef<RichComposerHandle>(null);
  const [hasContent, setHasContent] = useState(false);

  // ── Model + effort ────────────────────────────────────────────────────────
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    defaultModelId || undefined,
  );
  const [selectedEffort, setSelectedEffort] = useState<EffortLevel>('medium');

  useEffect(() => {
    if (!selectedModelId && defaultModelId) setSelectedModelId(defaultModelId);
  }, [defaultModelId]);

  // ── Plugins (needed by AttachMenu for feature gating) ────────────────────
  // On the landing page we have no conversation, so we synthesise the active
  // plugins from featureFlags — the same set the old ChatInput would default to.
  const landingPlugins: Plugin[] = [
    ...(featureFlags.webSearch ? [Plugins[PluginID.WEB_SEARCH]] : []),
    ...(featureFlags.skills ? [Plugins[PluginID.SKILLS]] : []),
  ].filter(Boolean);

  // ── Attachment ────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocument[]>([]);
  const [docProgress, setDocProgress] = useState<Record<string, number>>({});

  const addDocument = useCallback((doc: AttachedDocument) => {
    setAttachedDocs((prev) => [...prev, doc]);
  }, []);
  const handleUploadProgress = useCallback((doc: AttachedDocument, progress: number) => {
    setDocProgress((prev) => ({ ...prev, [doc.id]: progress }));
  }, []);
  const handleSetKey = useCallback((doc: AttachedDocument, key: string) => {
    setAttachedDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, key } : d)));
  }, []);
  const handleSetMetadata = useCallback((doc: AttachedDocument, metadata: any) => {
    setAttachedDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, metadata } : d)));
  }, []);
  const handleRemoveDoc = (docId: string) => {
    setAttachedDocs((prev) => prev.filter((d) => d.id !== docId));
    setDocProgress((prev) => { const n = { ...prev }; delete n[docId]; return n; });
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    Array.from(e.target.files).forEach((file) => {
      handleFile(
        file, addDocument, handleUploadProgress, handleSetKey, handleSetMetadata,
        () => {}, featureFlags.uploadDocuments ?? false, undefined, ragOn, {}, [],
      );
    });
    e.target.value = '';
  };

  // ── Toggle state (web search, skills) ────────────────────────────────────
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = (markdown: string) => {
    const trimmed = markdown.trim();
    if (!trimmed && attachedDocs.length === 0) return;
    if (typeof window !== 'undefined') {
      if (trimmed) sessionStorage.setItem('amplify_pending_message', trimmed);
      if (attachedDocs.length > 0)
        sessionStorage.setItem('amplify_pending_docs', JSON.stringify(attachedDocs));
      if (selectedModelId)
        sessionStorage.setItem('amplify_pending_model_id', selectedModelId);
      sessionStorage.setItem('amplify_pending_effort', selectedEffort);
      if (webSearchEnabled)
        sessionStorage.setItem('amplify_pending_web_search', 'true');
      if (selectedSkillIds.length > 0)
        sessionStorage.setItem('amplify_pending_skills', JSON.stringify(selectedSkillIds));
    }
    handleNewConversation({
      ...(selectedModelId && availableModels[selectedModelId]
        ? { model: availableModels[selectedModelId] }
        : {}),
    });
    composerRef.current?.clear();
    setHasContent(false);
    setAttachedDocs([]);
    setDocProgress({});
  };

  const allUploaded =
    attachedDocs.length === 0 || attachedDocs.every((d) => (docProgress[d.id] ?? 0) >= 100);
  const canSend = (hasContent || attachedDocs.length > 0) && allUploaded;

  // ⌘U global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'u') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Wire openNewUISettingsSection event (dispatched by AttachMenu connectors/skills)
  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail?.section;
      if (section) {
        window.dispatchEvent(new CustomEvent('openSettingsSection', { detail: { section } }));
      }
    };
    window.addEventListener('openNewUISettingsSection', handler);
    return () => window.removeEventListener('openNewUISettingsSection', handler);
  }, []);

  return (
    <div
      className="relative flex-1 flex flex-col items-center justify-start bg-[--bg-app] overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        multiple
        accept="*"
        onChange={handleFileChange}
      />

      {/* Centered content column */}
      <div
        className="w-full max-w-[760px] px-6 flex flex-col items-center"
        style={{ paddingTop: 'max(72px, 26vh)' }}
      >
        {/* Greeting */}
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
          {/* Rich composer */}
          <RichComposer
            ref={composerRef}
            onSend={handleSend}
            onChange={(value) => setHasContent(value.trim().length > 0)}
            placeholder="Ask anything…"
            editorClassName="max-h-[240px] overflow-y-auto"
            autoFocus
          />

          {/* Attached file chips */}
          {attachedDocs.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 mb-1">
              {attachedDocs.map((doc) => {
                const progress = docProgress[doc.id] ?? 0;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[12px]
                               bg-[--bg-hover] border border-[--border-subtle] text-[--text-secondary]"
                  >
                    <IconFile size={13} className="flex-shrink-0 text-[--text-muted]" />
                    <span className="max-w-[140px] truncate">{doc.name}</span>
                    {progress < 100 ? (
                      <span className="text-[--text-muted] ml-1">{progress}%</span>
                    ) : (
                      <IconCheck size={13} className="text-green-500 flex-shrink-0" />
                    )}
                    <button
                      className="ml-0.5 text-[--text-muted] hover:text-[--text-primary] transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleRemoveDoc(doc.id); }}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Remove file"
                    >
                      <IconX size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Toolbar */}
          <div
            className="flex items-center justify-between mt-3"
            style={{ minHeight: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: ⊕ attach menu + active chips */}
            <div className="flex items-center gap-2">
              <AttachMenu
                isNewChat
                plugins={landingPlugins}
                onAddFiles={() => fileInputRef.current?.click()}
                onAddFromLibrary={() => {
                  // DataSourceSelector opens via a custom event used by the old UI;
                  // for the new-UI landing page we fall back to the file picker.
                  fileInputRef.current?.click();
                }}
                webSearchEnabled={webSearchEnabled}
                onToggleWebSearch={() => setWebSearchEnabled((v) => !v)}
                selectedSkillIds={selectedSkillIds}
                onSkillsChange={setSelectedSkillIds}
                chatEndpoint={chatEndpoint ?? undefined}
                composerRef={composerRef}
              />

              {/* Active toggle chips */}
              <AttachMenuChips
                webSearchEnabled={webSearchEnabled}
                onRemoveWebSearch={() => setWebSearchEnabled(false)}
                selectedSkillIds={selectedSkillIds}
                onRemoveSkills={() => setSelectedSkillIds([])}
                assistantName={activeAssistantName}
                onRemoveAssistant={() => dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT })}
              />
            </div>

            {/* Right: model picker + mic/send */}
            <div className="flex items-center gap-2">
              <ModelPicker
                selectedModelId={selectedModelId}
                selectedEffort={selectedEffort}
                onModelChange={setSelectedModelId}
                onEffortChange={setSelectedEffort}
                isNewChat
                composerRef={composerRef}
              />

              {/* Mic ↔ Send swap (spec §7) */}
              <div className="relative w-[32px] h-[32px]">
                <button
                  className="absolute inset-0 flex items-center justify-center rounded-[8px] transition-all duration-[120ms]"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    opacity: canSend ? 0 : 1,
                    pointerEvents: canSend ? 'none' : 'auto',
                  }}
                  title="Voice input"
                  aria-label="Voice input"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <IconMicrophone size={17} />
                </button>
                <button
                  className="absolute inset-0 flex items-center justify-center rounded-[8px] transition-all duration-[120ms]"
                  style={{
                    background: canSend ? 'var(--accent)' : 'var(--bg-active)',
                    color: canSend ? '#2A1710' : 'var(--text-muted)',
                    opacity: canSend ? 1 : 0,
                    pointerEvents: canSend ? 'auto' : 'none',
                    cursor: canSend ? 'pointer' : 'default',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { const md = composerRef.current?.getValue() ?? ''; handleSend(md); }}
                  title="Send (Enter)"
                  aria-label="Send message"
                >
                  <IconArrowUp size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewHome;
