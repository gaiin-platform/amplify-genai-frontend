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
 *
 * ── Two-phase send (Task 14) ─────────────────────────────────────────────────
 * When images are still uploading at send time the composer immediately clears
 * the text field (visual confirmation that Send was received) but defers the
 * actual API call until every S3 upload resolves.  While waiting, an ambient
 * UploadPendingIndicator appears inside the card, the bottom brand-mark pulses,
 * and the user can cancel at any time (message text is restored on cancel).
 *
 * Three paths:
 *   DEFERRED: uploading images present → store PendingUploadSend, show indicator
 *             handleDocSetKey feeds newDocs, useEffect fires when remainingCount=0
 *   PATH A:   all docs already have S3 keys → call useSendService directly
 *   PATH B:   text only → inject into ChatInput + click #sendMessage
 *
 * Failure handling:
 *   A 90-second stall timeout marks stuck uploads as status:'failed'.
 *   AttachmentCard shows a Retry button (via onRetry prop) on failed cards.
 *   Retry cancels the pending send (restoring message text), removes the failed
 *   card, and re-uploads via addImageToRail.
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
  buildPastedTextMessage,
  getAttachmentMime,
  createUIAttachmentFromDoc,
  imageResponseToObjectUrlWithBytes,
  isTextPreviewable,
  PASTE_AS_FILE_THRESHOLD,
} from '@/components/NewUI/shared/attachmentTypes';
import { UploadPendingIndicator } from './UploadPendingIndicator';
import { PluginID, Plugin, Plugins } from '@/types/plugin';
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import { persistWebSearchPluginPreference } from '@/components/NewUI/shared/webSearchPreference';
import { useConversationAssistant } from '@/components/NewUI/shared/useConversationAssistant';
// For the direct-send path (pasted images with S3 keys)
import { handleFile } from '@/components/Chat/AttachFile';
import type { AttachedDocument } from '@/types/attacheddocument';
import { useSendService, type ChatRequest } from '@/hooks/useChatSendService';
import { newMessage, MessageType } from '@/types/chat';
import { getActivePlugins } from '@/utils/app/plugin';
import { getSettings } from '@/utils/app/settings';
import { setAssistant as setAssistantInMsg } from '@/utils/app/assistants';
import { getFileDownloadUrl } from '@/services/fileService';

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

/**
 * State captured at send time when images are still uploading.
 * Stored in a ref so handleDocSetKey callbacks can mutate it without
 * triggering extra renders.  setPendingUploadState is the React-facing
 * signal used to drive the indicator and the auto-fire useEffect.
 */
interface PendingUploadSend {
  msgText: string;
  pastedAttachments: UIAttachment[];
  /** Docs that already had S3 keys when Send was clicked. */
  readyDocs: AttachedDocument[];
  /** Docs whose uploads completed AFTER Send — accumulates as handleDocSetKey fires. */
  newDocs: AttachedDocument[];
  /** How many uploads are still in flight (decrements to 0, then fires). */
  remainingCount: number;
  webSearchEnabled: boolean;
  selectedSkillIds: string[];
}

/** How long an upload may stall (no key callback) before we mark it failed. */
const UPLOAD_STALL_TIMEOUT_MS = 90_000;

export const ConversationComposer: React.FC = () => {
  const {
    state: {
      selectedConversation,
      availableModels,
      defaultModelId,
      featureFlags,
      ragOn,
      chatEndpoint,
      messageIsStreaming,
    },
    handleUpdateConversation,
  } = useContext(HomeContext);

  // ── Direct-send service (for pasted images with S3 keys) ─────────────────
  const { handleSend: sendViaService } = useSendService();
  const sendViaServiceRef = useRef(sendViaService);
  useEffect(() => {
    sendViaServiceRef.current = sendViaService;
  }, [sendViaService]);

  // ── Local state ────────────────────────────────────────────────────────────
  const [text, setText] = useState('');
  // Tracks AttachedDocument objects for pasted images (mirroring NewHome).
  // These are populated by handleFile callbacks inside addImageToRail.
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocument[]>([]);
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

  // ── Assistant attached to THIS conversation ───────────────────────────────
  // Resolved rather than read straight off `selectedAssistant`: home state's
  // assistant field is global and gets reset by handleNewConversation /
  // handleSelectConversation, so after the first send the chip used to vanish
  // and follow-ups were sent with no assistant. See useConversationAssistant.
  const {
    assistant: activeAssistant,
    assistantName: activeAssistantName,
    detach: detachAssistant,
  } = useConversationAssistant();

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

  // ── Helpers: update attachedDocs state from handleFile callbacks ──────────
  const addDocCallback = useCallback((doc: AttachedDocument) => {
    setAttachedDocs((prev) => [...prev, doc]);
  }, []);
  const handleDocSetMetadata = useCallback(
    (doc: AttachedDocument, metadata: any) => {
      setAttachedDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, metadata } : d)),
      );
    },
    [],
  );
  const handleDocUploadProgress = useCallback(
    (doc: AttachedDocument, progress: number) => {
      // Keep UIAttachment in 'uploading' state until handleDocSetKey marks it ready
      if (progress < 100) {
        setUIAttachments((prev) =>
          prev.map((a) =>
            a.id === doc.id
              ? { ...a, status: 'uploading' as const, progress: Math.min(1, progress / 100) }
              : a,
          ),
        );
      }
    },
    [],
  );

  // ── Attachment rail state (declared here so handleSend can read uiAttachments) ──
  const [uiAttachments, setUIAttachments] = useState<UIAttachment[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOriginRect, setPreviewOriginRect] = useState<DOMRect | undefined>(undefined);
  // object-URL store for image thumbnails (revoke on remove)
  const thumbUrlsRef = useRef<Record<string, string>>({});

  // Library files are already uploaded and only need to be hydrated into the
  // new conversation's attachment rail; they must not be uploaded again.
  useEffect(() => {
    let pendingDocument: AttachedDocument | undefined;
    if (typeof window !== 'undefined') {
      const pendingRaw = sessionStorage.getItem('amplify_pending_library_doc');
      if (pendingRaw) {
        try {
          pendingDocument = JSON.parse(pendingRaw) as AttachedDocument;
        } catch {
          sessionStorage.removeItem('amplify_pending_library_doc');
        }
      }
    }
    if (!pendingDocument) return;

    try {
      const document = pendingDocument;
      if (!document?.id || !document.key) return;
      sessionStorage.removeItem('amplify_pending_library_doc');
      setAttachedDocs([document]);
      const mime = getAttachmentMime(document.name, document.type);
      const isImage = mime.startsWith('image/');
      const isText = isTextPreviewable(document.name, mime);
      setUIAttachments([{
        ...createUIAttachmentFromDoc(document, 1),
        // A library document has no local data. Its preview is ready only
        // after the same download used by the library view completes.
        previewState: 'pending',
      }]);

      // See the comment in NewHome.tsx's equivalent effect for why there are
      // no `cancelled` guards on state updates here.  reactStrictMode is true,
      // so double-invocation in dev would leave the spinner stuck forever if
      // we bailed on cancelled.  The cleanup is kept solely for object-URL
      // memory management.
      void (async () => {
        try {
          const result = await getFileDownloadUrl(document.key!, undefined);
          if (!result.success || !result.downloadUrl) throw new Error('Preview URL unavailable');
          const response = await fetch(result.downloadUrl);
          if (!response.ok) throw new Error(`Preview request failed: ${response.status}`);

          if (isImage) {
            const { objectUrl, bytes } = await imageResponseToObjectUrlWithBytes(response);
            thumbUrlsRef.current[document.id] = objectUrl;
            setUIAttachments((prev) => prev.map((attachment) =>
              attachment.id === document.id
                ? {
                    ...attachment,
                    bytes: attachment.bytes || bytes,
                    thumbUrl: objectUrl,
                    previewUrl: objectUrl,
                    previewState: 'available',
                  }
                : attachment,
            ));
          } else if (isText) {
            const text = await response.text();
            const bytes = new TextEncoder().encode(text).byteLength;
            const lineCount = text.split('\n').length;
            setUIAttachments((prev) => prev.map((attachment) =>
              attachment.id === document.id
                ? {
                    ...attachment,
                    bytes: attachment.bytes || bytes,
                    bodyPreview: text.slice(0, 400),
                    fullText: text,
                    lineCount,
                    previewState: bytes > 2 * 1024 * 1024 || lineCount > 8000 ? 'too-large' : 'available',
                  }
                : attachment,
            ));
          } else {
            setUIAttachments((prev) => prev.map((attachment) =>
              attachment.id === document.id ? { ...attachment, previewState: 'unsupported' } : attachment,
            ));
          }
        } catch {
          setUIAttachments((prev) => prev.map((attachment) =>
            attachment.id === document.id ? { ...attachment, previewState: 'failed' } : attachment,
          ));
        }
      })();

      return () => {
        const objectUrl = thumbUrlsRef.current[document.id];
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          delete thumbUrlsRef.current[document.id];
        }
      };
    } catch {
      sessionStorage.removeItem('amplify_pending_library_doc');
    }
  }, [selectedConversation?.id]);

  // ── Deferred-send state ────────────────────────────────────────────────────
  // Mutable ref: mutated synchronously by handleDocSetKey without triggering renders.
  // When remainingCount reaches 0 we update pendingUploadState, which triggers the
  // auto-fire useEffect below.
  const pendingUploadSendRef = useRef<PendingUploadSend | null>(null);
  // React state for the UI indicator and the auto-fire useEffect.
  // { done: N } = N of the originally-uploading images have completed.
  const [pendingUploadState, setPendingUploadState] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // ── Stall-timeout tracking ─────────────────────────────────────────────────
  // Timer IDs keyed by doc id. Cleared on success; fires after UPLOAD_STALL_TIMEOUT_MS
  // to mark stuck uploads as 'failed' so the Retry button appears.
  const uploadTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Original File objects keyed by doc id — needed to re-upload on Retry.
  const originalFilesRef = useRef<Record<string, File>>({});

  // ── handleDocSetKey ─────────────────────────────────────────────────────────
  // Called when a doc's S3 upload completes.  Marks UIAttachment ready,
  // clears any stall timer, and feeds the deferred-send accumulator.
  const handleDocSetKey = useCallback((doc: AttachedDocument, key: string) => {
    // Clear stall timer for this doc
    if (uploadTimeoutsRef.current[doc.id]) {
      clearTimeout(uploadTimeoutsRef.current[doc.id]);
      delete uploadTimeoutsRef.current[doc.id];
    }

    setAttachedDocs((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, key } : d)),
    );
    setUIAttachments((prev) =>
      prev.map((a) =>
        a.id === doc.id ? { ...a, status: 'ready' as const } : a,
      ),
    );

    // ── Deferred-send accumulator ──────────────────────────────────────────
    const pending = pendingUploadSendRef.current;
    if (pending && pending.remainingCount > 0) {
      // Guard: don't count a doc that was already in readyDocs at send time
      const alreadyReady = pending.readyDocs.some((d) => d.id === doc.id);
      if (!alreadyReady) {
        pending.newDocs.push({ ...doc, key });
        pending.remainingCount--;
        // Trigger the auto-fire useEffect (and update the progress indicator)
        setPendingUploadState((prev) =>
          prev ? { done: prev.done + 1, total: prev.total } : null,
        );
      }
    }
  }, []);

  // ── auto-fire useEffect ────────────────────────────────────────────────────
  // Fires the deferred ChatRequest when all uploads have completed.
  // Reads the freshest selectedConversation / selectedAssistant / featureFlags so
  // any conversation switch that happened while waiting is picked up correctly.
  useEffect(() => {
    if (!pendingUploadState) return;
    if (pendingUploadState.done < pendingUploadState.total) return;

    const pending = pendingUploadSendRef.current;
    if (!pending || !selectedConversation) return;

    const allDocs = [...pending.readyDocs, ...pending.newDocs];
    const { msgText, pastedAttachments, webSearchEnabled: pendingWebSearch, selectedSkillIds: pendingSkills } = pending;
    const pastedMessage = buildPastedTextMessage(msgText, pastedAttachments);

    // Clear before firing to prevent any double-fire
    pendingUploadSendRef.current = null;
    setPendingUploadState(null);
    setAttachedDocs([]);
    setUIAttachments([]);
    Object.values(thumbUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    thumbUrlsRef.current = {};

    // Edge case: all images failed (timeout) and there's no text either.
    // Nothing to send — silently abort rather than fire an empty message.
    if (allDocs.length === 0 && !pastedMessage.content.trim()) {
      return;
    }

    // Edge case: all images failed (timeout) but the user did write text.
    // Fall through to PATH B (text-only DOM bridge) rather than PATH A.
    if (allDocs.length === 0) {
      const hiddenTextarea = document.getElementById(
        'messageChatInputText',
      ) as HTMLTextAreaElement | null;
      const hiddenSend = document.getElementById('sendMessage') as HTMLButtonElement | null;
      if (hiddenTextarea && hiddenSend) {
        setTimeout(() => {
          setNativeValue(hiddenTextarea, pastedMessage.content);
          setTimeout(() => hiddenSend.click(), 60);
        }, 30);
      }
      return;
    }

    // Build and fire ChatRequest (same construction as PATH A in handleSend)
    let msg = newMessage({
      role: 'user',
      content: pastedMessage.content || ' ',
      label: pastedMessage.label || undefined,
      type: MessageType.PROMPT,
      data: {
        enableWebSearch: pendingWebSearch,
        skills: pendingSkills,
        skillSelectionMode: 'auto',
        ...pastedMessage.data,
        dataSources: allDocs.map((d) => ({
          id: d.key!.includes('://') ? d.key! : `s3://${d.key!}`,
          type: d.type,
          name: d.name || '',
          metadata: d.metadata || {},
        })),
      },
    });
    msg = setAssistantInMsg(msg, activeAssistant ?? DEFAULT_ASSISTANT);

    let assistantOptions: Record<string, unknown> | undefined;
    if (activeAssistant) {
      assistantOptions = {
        assistantName: activeAssistant.definition?.name,
        assistantId: activeAssistant.definition?.assistantId,
        groupId: activeAssistant.definition?.groupId,
        groupType: selectedConversation.groupType,
      };
    }

    const settings = typeof window !== 'undefined' ? getSettings(featureFlags) : null;
    const plugins = settings ? getActivePlugins(settings, featureFlags) : [];

    const request: ChatRequest = {
      message: msg,
      deleteCount: 0,
      documents: allDocs,
      plugins,
      conversationId: selectedConversation.id,
      ...(assistantOptions ? { options: assistantOptions } : {}),
    };

    sendViaServiceRef.current(request, () => false);
  }, [pendingUploadState, selectedConversation, activeAssistant, featureFlags]);

  // ── Set data-upload-pending on the shell ─────────────────────────────────
  // Drives the asterisk pulse animation in conversation-view.css when a
  // deferred send is waiting.  Targets the nearest .new-ui-chat-shell ancestor.
  useEffect(() => {
    const shell = document.querySelector(
      '[data-new-ui="true"].new-ui-chat-shell',
    ) as HTMLElement | null;
    if (!shell) return;
    if (pendingUploadState) {
      shell.setAttribute('data-upload-pending', 'true');
    } else {
      shell.removeAttribute('data-upload-pending');
    }
  }, [pendingUploadState]);

  // ── handleCancelPendingSend ───────────────────────────────────────────────
  // Abandons the deferred send.  Restores message text so the user can edit
  // and re-send once the images finish uploading (or remove them).
  const handleCancelPendingSend = useCallback(() => {
    const pending = pendingUploadSendRef.current;
    if (pending?.msgText) {
      setText(pending.msgText);
    }
    pendingUploadSendRef.current = null;
    setPendingUploadState(null);
    // Note: uiAttachments and attachedDocs are intentionally kept — uploads
    // continue in the background; the user can re-click Send when ready.
  }, []);

  // ── Send — bridge into Chat's hidden ChatInput ────────────────────────────
  //
  // Three paths:
  //   DEFERRED: uploading images present → store pending state, return early
  //   A) attachedDocs have S3 keys → call useSendService directly with docs
  //   B) no docs with keys → inject text + click #sendMessage (existing path)
  //
  const handleSend = useCallback(() => {
    const hasText = text.trim().length > 0;
    const docsWithKeys = attachedDocs.filter((d) => !!d.key);
    const uploadingImages = uiAttachments.filter(
      (a) => a.kind === 'image' && a.status === 'uploading',
    );
    const pastedAttachmentsEarly = uiAttachments.filter((a) => a.kind === 'paste');
    const hasContentToSend =
      hasText ||
      docsWithKeys.length > 0 ||
      uploadingImages.length > 0 ||
      pastedAttachmentsEarly.length > 0;

    if (!hasContentToSend) return;
    if (messageIsStreaming) return;
    if (pendingUploadSendRef.current) return; // already waiting

    // ── Shared model + conversation prep ────────────────────────────────────
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
    const pastedAttachments = uiAttachments.filter((a) => a.kind === 'paste');
    const pastedMessage = buildPastedTextMessage(msgText, pastedAttachments);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // ── DEFERRED SEND: images still uploading ──────────────────────────────
    if (uploadingImages.length > 0) {
      pendingUploadSendRef.current = {
        msgText,
        pastedAttachments: [...pastedAttachments],
        readyDocs: [...docsWithKeys],
        newDocs: [],
        remainingCount: uploadingImages.length,
        webSearchEnabled,
        selectedSkillIds,
      };
      // pendingUploadState.done tracks how many of the originally-uploading
      // images have since completed (starts at 0).
      setPendingUploadState({ done: 0, total: uploadingImages.length });
      return;
    }

    // ── PATH A: pasted images fully uploaded ─────────────────────────────────
    if ((docsWithKeys.length > 0 || pastedAttachments.length > 0) && selectedConversation) {
      // Clear local doc + attachment state
      const docsToSend = [...docsWithKeys];
      setAttachedDocs([]);
      setUIAttachments([]);
      Object.values(thumbUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      thumbUrlsRef.current = {};

      // Build the message
      let msg = newMessage({
        role: 'user',
        content: pastedMessage.content || ' ', // at least one space so the message is non-empty
        label: pastedMessage.label || undefined,
        type: MessageType.PROMPT,
        data: {
          enableWebSearch: webSearchEnabled,
          skills: selectedSkillIds,
          skillSelectionMode: 'auto',
          ...pastedMessage.data,
          dataSources: docsToSend.map((d) => ({
            id: d.key!.includes('://') ? d.key! : `s3://${d.key!}`,
            type: d.type,
            name: d.name || '',
            metadata: d.metadata || {},
          })),
        },
      });
      msg = setAssistantInMsg(msg, activeAssistant ?? DEFAULT_ASSISTANT);

      let assistantOptions: Record<string, unknown> | undefined;
      if (activeAssistant) {
        assistantOptions = {
          assistantName: activeAssistant.definition?.name,
          assistantId: activeAssistant.definition?.assistantId,
          groupId: activeAssistant.definition?.groupId,
          groupType: selectedConversation.groupType,
        };
      }

      const settings =
        typeof window !== 'undefined' ? getSettings(featureFlags) : null;
      const plugins = settings ? getActivePlugins(settings, featureFlags) : [];

      const request: ChatRequest = {
        message: msg,
        deleteCount: 0,
        documents: docsToSend,
        plugins,
        conversationId: selectedConversation.id,
        ...(assistantOptions ? { options: assistantOptions } : {}),
      };

      sendViaServiceRef.current(request, () => false /* ConversationComposer has no stopRef */);
      return;
    }

    // ── PATH B: text-only — DOM bridge into ChatInput ────────────────────────
    const hiddenTextarea = document.getElementById(
      'messageChatInputText',
    ) as HTMLTextAreaElement | null;
    const hiddenSend = document.getElementById(
      'sendMessage',
    ) as HTMLButtonElement | null;
    if (!hiddenTextarea || !hiddenSend) return;

    setTimeout(() => {
      setNativeValue(hiddenTextarea, msgText);
      setTimeout(() => {
        hiddenSend.click();
      }, 60);
    }, 30);
  }, [
    text,
    attachedDocs,
    uiAttachments,
    messageIsStreaming,
    selectedConversation,
    activeAssistant,
    selectedModelId,
    availableModels,
    webSearchEnabled,
    selectedSkillIds,
    featureFlags,
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
  // (uiAttachments, previewId, previewOriginRect, thumbUrlsRef declared above
  //  so handleSend can reference uiAttachments without a forward-reference error)

  const handleRemoveAttachment = (id: string) => {
    if (thumbUrlsRef.current[id]) {
      URL.revokeObjectURL(thumbUrlsRef.current[id]);
      delete thumbUrlsRef.current[id];
    }
    // Clear stall timer if any
    if (uploadTimeoutsRef.current[id]) {
      clearTimeout(uploadTimeoutsRef.current[id]);
      delete uploadTimeoutsRef.current[id];
    }
    // NOTE: keep originalFilesRef[id] for potential retry after failed removal
    setUIAttachments((prev) => prev.filter((a) => a.id !== id));
    // Also remove the backing AttachedDocument so it isn't sent
    setAttachedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  /**
   * Add an image File to the rail.
   *
   * Two things happen simultaneously:
   *   1. An object-URL thumbnail is created and a UIAttachment card is shown
   *      immediately (same as before).
   *   2. handleFile is called to start the S3 upload. The wrappedAttach
   *      callback links the generated doc.id to the UIAttachment id so that
   *      progress updates and the final doc.key can be tracked. Once
   *      handleDocSetKey fires, the UIAttachment is marked 'ready' and
   *      handleSend's PATH A (or the deferred auto-fire) sends it with the message.
   *
   * A UPLOAD_STALL_TIMEOUT_MS stall-timer is started once wrappedAttach fires.
   * If onSetKey never arrives (network error, etc.) the timer marks the
   * UIAttachment as 'failed' so the Retry button appears on the card.
   *
   * If featureFlags.uploadDocuments is false, the upload step is skipped and
   * the doc has no key — the image will not be sent to the backend, which
   * is intentional (same limitation as the old UI).
   */
  const addImageToRail = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      try {
        const url = URL.createObjectURL(file);

        // Use a sentinel value; the real id comes from handleFile's uuidv4.
        // The wrappedAttach callback below overwrites the UIAttachment once
        // the real id is known (by replacing the sentinel entry).
        const sentinelId = `img-pending-${Date.now()}`;
        thumbUrlsRef.current[sentinelId] = url;
        originalFilesRef.current[sentinelId] = file;

        // Show placeholder card immediately
        setUIAttachments((prev) => [
          ...prev,
          {
            id: sentinelId,
            kind: 'image' as const,
            status: featureFlags.uploadDocuments ? ('uploading' as const) : ('ready' as const),
            name: file.name || 'pasted-image.png',
            ext: null,
            bytes: file.size,
            mime: file.type,
            thumbUrl: url,
            previewState: 'available' as const,
          },
        ]);

        // When handleFile calls onAttach, replace the sentinel id with the
        // real doc.id so all subsequent callbacks (setKey, progress) find it.
        let intercepted = false;
        const wrappedAttach = (doc: AttachedDocument) => {
          if (!intercepted) {
            intercepted = true;
            // Transfer thumb URL + original file ref from sentinel to real doc id
            thumbUrlsRef.current[doc.id] = url;
            delete thumbUrlsRef.current[sentinelId];
            originalFilesRef.current[doc.id] = file;
            delete originalFilesRef.current[sentinelId];

            // Replace the sentinel UIAttachment with the real one
            setUIAttachments((prev) =>
              prev.map((a) =>
                a.id === sentinelId
                  ? {
                      ...a,
                      id: doc.id,
                      status: featureFlags.uploadDocuments
                        ? ('uploading' as const)
                        : ('ready' as const),
                    }
                  : a,
              ),
            );

            // Start stall-timeout so failed uploads get surfaced.
            // Only relevant when uploads are actually enabled.
            if (featureFlags.uploadDocuments) {
              if (uploadTimeoutsRef.current[sentinelId]) {
                clearTimeout(uploadTimeoutsRef.current[sentinelId]);
                delete uploadTimeoutsRef.current[sentinelId];
              }
              uploadTimeoutsRef.current[doc.id] = setTimeout(() => {
                delete uploadTimeoutsRef.current[doc.id];
                // Mark as failed with an actionable error message
                setUIAttachments((prev) =>
                  prev.map((a) =>
                    a.id === doc.id && a.status === 'uploading'
                      ? {
                          ...a,
                          status: 'failed' as const,
                          error: 'Upload timed out. Tap Retry.',
                        }
                      : a,
                  ),
                );
                // If a deferred send was waiting on this doc, treat it as done
                // (without a key — the send will proceed with whatever completed).
                const pending = pendingUploadSendRef.current;
                if (pending && pending.remainingCount > 0) {
                  const alreadyReady = pending.readyDocs.some((d) => d.id === doc.id);
                  if (!alreadyReady) {
                    // Don't push to newDocs (no key), just decrement counter
                    pending.remainingCount--;
                    setPendingUploadState((prev) =>
                      prev ? { done: prev.done + 1, total: prev.total } : null,
                    );
                  }
                }
              }, UPLOAD_STALL_TIMEOUT_MS);
            }
          }
          addDocCallback(doc);
        };

        handleFile(
          file,
          wrappedAttach,
          handleDocUploadProgress,
          handleDocSetKey,
          handleDocSetMetadata,
          () => {}, // onSetAbortController
          featureFlags.uploadDocuments ?? false,
          undefined, // groupId
          ragOn,
          {}, // extra props
          [], // tags
        );
      } catch {
        // silently ignore — user sees no card but the file isn't lost
      }
    },
    [
      addDocCallback,
      handleDocSetKey,
      handleDocSetMetadata,
      handleDocUploadProgress,
      featureFlags.uploadDocuments,
      ragOn,
    ],
  );

  // ── handleRetryAttachment ─────────────────────────────────────────────────
  // Cancels any pending deferred send (restoring message text), removes the
  // failed card, and re-submits the original file via addImageToRail.
  const handleRetryAttachment = useCallback(
    (id: string) => {
      const file = originalFilesRef.current[id];
      if (!file) return;
      // Restore message text before cancelling so the user doesn't lose their work
      handleCancelPendingSend();
      handleRemoveAttachment(id);
      addImageToRail(file);
    },
    // handleCancelPendingSend and handleRemoveAttachment are defined above;
    // addImageToRail is a stable useCallback. All three read refs, not captured state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addImageToRail],
  );

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

  // canSend:
  //   — Send button visible when there's text OR any non-failed attachment
  //   — Blocked while streaming or a deferred send is already in flight
  //   — No longer blocked by uploading images (two-phase send handles that)
  const hasContent =
    text.trim().length > 0 || uiAttachments.some((a) => a.status !== 'failed');
  const canSend =
    !messageIsStreaming && pendingUploadState === null && hasContent;

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
            background: 'var(--bg-composer)',
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
          {/* ── Upload progress indicator (shown while deferred send is waiting) ── */}
          {pendingUploadState && (
            <UploadPendingIndicator
              done={pendingUploadState.done}
              total={pendingUploadState.total}
              onCancel={handleCancelPendingSend}
            />
          )}

          {/* ── Band 1: Attachment rail (collapses to 0 when empty) ── */}
          <AttachmentRail
            attachments={uiAttachments}
            onRemove={handleRemoveAttachment}
            onRetry={handleRetryAttachment}
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
            placeholder={pendingUploadState ? '' : 'Write a message…'}
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
                onRemoveAssistant={detachAssistant}
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
               *   streaming         → Stop button  (--bg-active, PlayerStop icon)
               *   pendingUpload     → Voice button (dimmed, non-interactive)
               *   idle + empty      → Voice button (transparent, mic icon, 28×28)
               *   idle + has content→ Send button  (--accent, ArrowUp icon)
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

                {/* Voice — idle + empty composer (dimmed while upload pending) */}
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center rounded-[8px] transition-all duration-[120ms]"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    // Show when idle and nothing to send; dim if upload pending
                    opacity: (!messageIsStreaming && !canSend) ? (pendingUploadState ? 0.35 : 1) : 0,
                    pointerEvents: (!messageIsStreaming && !canSend && !pendingUploadState) ? 'auto' : 'none',
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
                    color: 'var(--accent-fg)',
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
