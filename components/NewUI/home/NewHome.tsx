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
 * Send button: 32×32, radius 8px, --accent bg, white glyph var(--accent-fg)
 */
import React, { useContext, useRef, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import {
  IconArrowUp,
  IconMicrophone,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { RichComposer, type RichComposerHandle } from '@/components/NewUI/shared/RichComposer';
import { handleFile } from '@/components/Chat/AttachFile';
import { AttachedDocument } from '@/types/attacheddocument';
import { ModelPicker, type EffortLevel } from '@/components/NewUI/shared/ModelPicker';
import { AttachMenu, AttachMenuChips } from '@/components/NewUI/shared/AttachMenu';
import { AttachmentRail } from '@/components/NewUI/shared/AttachmentRail';
import { AttachmentPreview } from '@/components/NewUI/shared/AttachmentPreview';
import {
  UIAttachment,
  createUIAttachmentFromDoc,
  createPasteAttachment,
  getAttachmentMime,
  imageResponseToObjectUrl,
  isTextPreviewable,
} from '@/components/NewUI/shared/attachmentTypes';
import { getFileDownloadUrl } from '@/services/fileService';
import { PluginID, Plugin, Plugins } from '@/types/plugin';
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import { persistWebSearchPluginPreference } from '@/components/NewUI/shared/webSearchPreference';

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
  // UIAttachments: visual representations of docs/pastes in the rail
  const [uiAttachments, setUIAttachments] = useState<UIAttachment[]>([]);
  // thumbUrl object-URLs to revoke on remove/send
  const thumbUrlsRef = useRef<Record<string, string>>({});
  // Backing AttachedDocuments (for send payload)
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocument[]>([]);

  // Preview overlay state
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOriginRect, setPreviewOriginRect] = useState<DOMRect | undefined>(undefined);

  /**
   * Generate a thumbnail object-URL for an image File BEFORE calling handleFile,
   * because handleFile sets doc.raw = "" and we lose access to the File object.
   */
  const makethumbUrl = (file: File): string | undefined => {
    if (!file.type.startsWith('image/')) return undefined;
    try {
      const url = URL.createObjectURL(file);
      return url;
    } catch {
      return undefined;
    }
  };

  // addDocument is called by handleFile after it has processed the file.
  // We look up the pre-generated thumbUrl from thumbUrlsRef.
  const addDocument = useCallback((doc: AttachedDocument) => {
    const thumbUrl = thumbUrlsRef.current[doc.id];
    setAttachedDocs((prev) => [...prev, doc]);
    setUIAttachments((prev) => [...prev, createUIAttachmentFromDoc(doc, 0, thumbUrl)]);
  }, []);

  const handleUploadProgress = useCallback((doc: AttachedDocument, progress: number) => {
    const fraction = progress / 100;
    setUIAttachments((prev) =>
      prev.map((a) =>
        a.id === doc.id
          ? { ...a, progress: fraction, status: fraction >= 1 ? 'ready' : 'uploading' }
          : a,
      ),
    );
  }, []);

  const handleSetKey = useCallback((doc: AttachedDocument, key: string) => {
    setAttachedDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, key } : d)));
  }, []);

  const handleSetMetadata = useCallback((doc: AttachedDocument, metadata: any) => {
    setAttachedDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, metadata } : d)));
  }, []);

  const handleRemoveAttachment = (id: string) => {
    // Revoke any object-URL we created
    if (thumbUrlsRef.current[id]) {
      URL.revokeObjectURL(thumbUrlsRef.current[id]);
      delete thumbUrlsRef.current[id];
    }
    setUIAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  // ── Hydrate pending library document ──────────────────────────────────────
  // When the user clicks "Attach to new chat" in the library, the selected
  // file's AttachedDocument is stored under 'amplify_pending_library_doc' in
  // sessionStorage and handleNewConversation() is called. The new conversation
  // has 0 messages, so NewHome is rendered (and ConversationViewShell is
  // mounted but hidden). React fires sibling effects in JSX order: NewHome
  // appears before ConversationViewShell, so this effect runs first and
  // claims the pending doc before ConversationComposer's own effect can. The
  // key is removed immediately so ConversationComposer finds nothing and
  // returns. With the doc in NewHome's attachedDocs, handleSend stores it in
  // amplify_pending_docs, and ConversationViewShell.tryInject PATH A picks it
  // up and sends it with the user's first message.
  //
  // IMPORTANT: createUIAttachmentFromDoc computes previewState='unsupported'
  // for library docs because doc.data=null (no local bytes). We override that
  // to 'pending' and run an async fetch to hydrate the preview — the same
  // path used by the existing library preview panel.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('amplify_pending_library_doc');
    if (!raw) return;

    let doc: AttachedDocument;
    try {
      doc = JSON.parse(raw) as AttachedDocument;
      if (!doc?.id || !doc.key) return;
    } catch {
      sessionStorage.removeItem('amplify_pending_library_doc');
      return;
    }

    sessionStorage.removeItem('amplify_pending_library_doc');
    setAttachedDocs([doc]);

    const mime = getAttachmentMime(doc.name, doc.type);
    const isImage = mime.startsWith('image/');
    const isText = isTextPreviewable(doc.name, mime);

    // Show the card immediately with a 'pending' spinner while the preview
    // data is fetched; the card face updates once the download resolves.
    setUIAttachments([{ ...createUIAttachmentFromDoc(doc, 1), previewState: 'pending' }]);

    // NOTE: we intentionally do NOT gate state updates on a `cancelled` flag
    // here.  React 18's reactStrictMode (enabled in next.config.js) double-
    // invokes effects in development: it runs effect → cleanup → effect again.
    // The cleanup sets cancelled=true and the second run finds the sessionStorage
    // key already gone and returns early.  When the async fetch from the first
    // run finally completes, a cancelled check would bail out and leave the
    // attachment card showing the spinner forever.
    //
    // Instead, we always apply the state update (React 18 silently ignores
    // setState on genuinely unmounted components) and use the cleanup function
    // solely for object-URL memory management.
    void (async () => {
      try {
        const result = await getFileDownloadUrl(doc.key!, undefined);
        if (!result.success || !result.downloadUrl) throw new Error('Preview URL unavailable');
        const response = await fetch(result.downloadUrl);
        if (!response.ok) throw new Error(`Preview request failed: ${response.status}`);

        if (isImage) {
          const objectUrl = await imageResponseToObjectUrl(response);
          thumbUrlsRef.current[doc.id] = objectUrl;
          setUIAttachments((prev) => prev.map((a) =>
            a.id === doc.id
              ? { ...a, thumbUrl: objectUrl, previewUrl: objectUrl, previewState: 'available' }
              : a,
          ));
        } else if (isText) {
          const textContent = await response.text();
          const bytes = new TextEncoder().encode(textContent).byteLength;
          const lineCount = textContent.split('\n').length;
          setUIAttachments((prev) => prev.map((a) =>
            a.id === doc.id
              ? {
                  ...a,
                  bytes: a.bytes || bytes,
                  bodyPreview: textContent.slice(0, 400),
                  fullText: textContent,
                  lineCount,
                  previewState: bytes > 2 * 1024 * 1024 || lineCount > 8000 ? 'too-large' : 'available',
                }
              : a,
          ));
        } else {
          setUIAttachments((prev) => prev.map((a) =>
            a.id === doc.id ? { ...a, previewState: 'unsupported' } : a,
          ));
        }
      } catch {
        setUIAttachments((prev) => prev.map((a) =>
          a.id === doc.id ? { ...a, previewState: 'failed' } : a,
        ));
      }
    })();

    return () => {
      // Only use the cleanup for object-URL memory management.
      // In Strict Mode dev the cleanup fires between effect double-invocations
      // while the component is still alive; at that point the fetch is usually
      // still in-flight so thumbUrlsRef.current[doc.id] is empty and nothing
      // is revoked.  The URL stored by the completed fetch will be cleaned up
      // when the component genuinely unmounts (user sends first message).
      const objectUrl = thumbUrlsRef.current[doc.id];
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        delete thumbUrlsRef.current[doc.id];
      }
    };
    // Empty deps: run once per mount. NewHome re-mounts on each page
    // transition (library → landing), so a fresh effect runs each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Core helper: generate thumbUrl, stash it, then hand the file to handleFile.
   * Called from both the file-input handler and the image-paste handler.
   */
  const addFileToRail = useCallback((file: File) => {
    // We need a stable id to link the thumbUrl → addDocument callback.
    // handleFile generates its own uuid; we can't know it in advance.
    // So we generate the thumbUrl lazily inside addDocument via thumbUrlsRef,
    // keyed by a "pending" entry we match by filename+size when addDocument fires.
    // Simpler approach: wrap addDocument to intercept the first call for this file.
    let intercepted = false;
    const wrappedAdd = (doc: AttachedDocument) => {
      if (!intercepted) {
        intercepted = true;
        const thumbUrl = makethumbUrl(file);
        if (thumbUrl) thumbUrlsRef.current[doc.id] = thumbUrl;
      }
      addDocument(doc);
    };
    handleFile(
      file, wrappedAdd, handleUploadProgress, handleSetKey, handleSetMetadata,
      () => {}, featureFlags.uploadDocuments ?? false, undefined, ragOn, {}, [],
    );
  }, [addDocument, handleUploadProgress, handleSetKey, handleSetMetadata, featureFlags.uploadDocuments, ragOn]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    Array.from(e.target.files).forEach((file) => addFileToRail(file));
    e.target.value = '';
  };

  // Large-paste → attachment card (spec §6)
  const handleLargePaste = useCallback((text: string) => {
    const pasteAttachment = createPasteAttachment(text);
    setUIAttachments((prev) => [...prev, pasteAttachment]);
    // Pastes don't have a backing doc — we'll send the fullText via sessionStorage
  }, []);

  // ── Toggle state (web search, skills) ────────────────────────────────────
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = (markdown: string) => {
    const trimmed = markdown.trim();
    const readyAttachments = uiAttachments.filter((a) => a.status !== 'failed');
    if (!trimmed && readyAttachments.length === 0) return;
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
    // Bug fix (Phase 27): tell home.tsx a send is already in flight for the
    // about-to-be-created conversation, so it doesn't flash NewHome/landing
    // page again during the ~150-300ms window before ConversationViewShell's
    // pending-message bridge actually injects the text + clicks send (during
    // which selectedConversation.messages.length is genuinely still 0). See
    // NEW_UI_DOCS.md §12 Phase 27 and home.tsx's pendingNewConversationSend.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('amplifyNewConversationSendPending'));
    }
    handleNewConversation({
      ...(selectedModelId && availableModels[selectedModelId]
        ? { model: availableModels[selectedModelId] }
        : {}),
    });
    composerRef.current?.clear();
    setHasContent(false);
    setAttachedDocs([]);
    setUIAttachments([]);
    // Revoke all thumbnail object-URLs
    Object.values(thumbUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    thumbUrlsRef.current = {};
  };

  // Send enabled when text OR at least one ready attachment (spec §1)
  const allUploaded = uiAttachments.every(
    (a) => a.status !== 'uploading',
  );
  const canSend = (hasContent || uiAttachments.some((a) => a.status === 'ready')) && allUploaded;

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
          <Image src="/icon2.png" alt="Amplify" width={40} height={40} style={{ borderRadius: 6 }} />
          <h1
            className="text-[40px] text-[--text-primary] leading-none tracking-[-0.01em] text-center"
            style={{ fontFamily: '"Newsreader", "Georgia", serif', fontWeight: 400 }}
          >
            How can I help?
          </h1>
        </div>

        {/* Composer box — 3-band grid: rail | textarea | toolbar */}
        <div
          className="
            new-ui-composer-card
            w-full bg-[--bg-composer] rounded-[14px]
            border border-[--border-subtle]
            focus-within:border-[--border-composer-active]
            transition-colors duration-150
            p-4 pb-3
          "
          style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto' }}
          onClick={() => composerRef.current?.focus()}
        >
          {/* Band 1 — attachment rail (collapses to 0 when empty) */}
          <AttachmentRail
            attachments={uiAttachments}
            onRemove={handleRemoveAttachment}
            onPreview={(id, rect) => {
              setPreviewId(id);
              setPreviewOriginRect(rect);
            }}
          />

          {/* Band 2 — Rich composer */}
          <RichComposer
            ref={composerRef}
            onSend={handleSend}
            onChange={(value) => setHasContent(value.trim().length > 0)}
            onLargePaste={handleLargePaste}
            onImagePaste={addFileToRail}
            placeholder="Ask anything…"
            editorClassName="max-h-[240px] overflow-y-auto"
            autoFocus
          />

          {/* Band 3 — Toolbar */}
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
                onToggleWebSearch={() => {
                  setWebSearchEnabled((v) => {
                    const next = !v;
                    // Seed Chat.tsx's plugins array as early as possible — the
                    // conversation this creates hasn't mounted Chat.tsx yet, but
                    // there's no harm in getting the settings write in early.
                    if (next) persistWebSearchPluginPreference(featureFlags);
                    return next;
                  });
                }}
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

              {/*
               * §7 Send ↔ Voice slot (32×32, zero layout shift).
               * One slot, two occupants — cross-fade over 120ms:
               *   empty → Voice button (transparent bg, mic icon)
               *   content → Send button (--accent bg, ArrowUp icon)
               */}
              <div className="relative w-[32px] h-[32px]">
                {/* Voice — when empty */}
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
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                  <IconMicrophone size={17} />
                </button>
                {/* Send — when content */}
                <button
                  className="absolute inset-0 flex items-center justify-center rounded-[8px] transition-all duration-[120ms]"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    opacity: canSend ? 1 : 0,
                    pointerEvents: canSend ? 'auto' : 'none',
                    cursor: 'pointer',
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

export default NewHome;
