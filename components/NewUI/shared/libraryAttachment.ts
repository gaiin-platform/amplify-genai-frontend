/**
 * libraryAttachment — the one way to put an ALREADY-UPLOADED library file into a
 * new-UI composer's attachment rail.
 *
 * A library file is not a `File`. It has no local bytes, it is already in S3,
 * and re-running it through `AttachFile#handleFile` would upload a second copy.
 * So it needs its own intake: build an `AttachedDocument` that already carries a
 * `key`, mint a `ready` UIAttachment for it, and then fetch its preview
 * separately (the card face is the only thing that still needs the bytes).
 *
 * Three call sites needed exactly this and had three copies of it:
 *   • NewHome              — `amplify_pending_library_doc` handoff from the Library view
 *   • ConversationComposer — the same handoff, when the composer wins the race
 *   • both of the above    — AttachMenu → "Add from library"
 * This module is that vocabulary, so they cannot drift.
 *
 * IMPORTANT: `createUIAttachmentFromDoc` resolves `previewState:'unsupported'`
 * for a library doc, because `doc.data` is null — there is nothing local to
 * preview. `createLibraryUIAttachment` overrides it to `'pending'` and
 * `hydrateLibraryAttachmentPreview` resolves it, so the card shows a spinner and
 * then the real preview instead of a permanent "no preview" state.
 *
 * No React imports. Browser APIs (fetch, URL.createObjectURL) are used by the
 * hydration function only, which is async and caller-invoked.
 */

import type { AttachedDocument } from '@/types/attacheddocument';
import { getFileDownloadUrl } from '@/services/fileService';
import { extractKey } from '@/utils/app/files';
import { getMimeTypeFromExtension } from '@/utils/app/fileTypeTranslations';
import {
    UIAttachment,
    createUIAttachmentFromDoc,
    getAttachmentMime,
    imageResponseToObjectUrlWithBytes,
    isTextPreviewable,
} from './attachmentTypes';

// Preview ceilings — mirrored from attachmentTypes' local constants, which are
// module-private there. Kept in sync by name so a change is greppable.
const TOO_LARGE_TEXT_BYTES = 2 * 1024 * 1024;
const TOO_LARGE_TEXT_LINES = 8_000;

/** Chars of a text file kept for the card's body preview. */
const BODY_PREVIEW_CHARS = 400;

/**
 * A file picked out of the user's library.
 *
 * Structurally the same shape `DataSourceLibraryPicker` emits
 * (`PickedLibraryFile`), declared here so this module stays free of component
 * imports. `id` is the record's raw S3 key in practice; `key` may carry it
 * explicitly.
 */
export interface LibraryFileSelection {
    id: string;
    name: string;
    type?: string;
    key?: string;
    size?: number;
    metadata?: Record<string, any>;
}

/**
 * Build the `AttachedDocument` for a library selection.
 *
 * `data: null` is deliberate — there are no local bytes. `key` is what makes
 * this document sendable without an upload: every send path in the new UI
 * filters on `!!doc.key` and prefixes it with `s3://`.
 *
 * Returns `null` when no key can be derived, because a keyless library document
 * would render a card that silently never reaches the backend.
 */
export function libraryFileToAttachedDocument(
    file: LibraryFileSelection,
): AttachedDocument | null {
    const key = extractKey({
        id: file.key ?? file.id,
        key: file.key,
        metadata: file.metadata,
    });
    if (!key) return null;

    const type =
        file.type ||
        getMimeTypeFromExtension(file.name.split('.').pop()?.toLowerCase() || '') ||
        'application/octet-stream';

    return {
        id: file.id,
        name: file.name,
        raw: { size: file.size ?? 0 },
        type,
        data: null,
        ...(typeof file.size === 'number' ? { size: file.size } : {}),
        key,
        metadata: (file.metadata ?? {}) as AttachedDocument['metadata'],
    };
}

/**
 * The rail card for a library document: already uploaded (`status:'ready'`,
 * progress 1) but with its preview still to come.
 */
export function createLibraryUIAttachment(doc: AttachedDocument): UIAttachment {
    return { ...createUIAttachmentFromDoc(doc, 1), previewState: 'pending' };
}

/**
 * Applies an update to the rail entry with the given id.
 *
 * An updater function rather than a partial, because the hydration result has to
 * merge with what is already on the card (`bytes: existing || fetched`) instead
 * of clobbering it.
 */
export type LibraryAttachmentPatch = (
    id: string,
    update: (attachment: UIAttachment) => UIAttachment,
) => void;

export interface HydrateLibraryPreviewOptions {
    patch: LibraryAttachmentPatch;
    /**
     * Receives any object-URL created for an image so the caller can revoke it.
     * Skipping this leaks the URL for the lifetime of the page.
     */
    onObjectUrl?: (id: string, objectUrl: string) => void;
}

/**
 * Download a library document and resolve its card preview.
 *
 * Never rejects: every failure lands as `previewState:'failed'`, because a
 * missing preview must not take out the attachment itself — the file is in S3
 * and is still perfectly sendable.
 *
 * Callers must NOT gate the `patch` calls on an "is this still mounted?" flag.
 * `reactStrictMode` is on, so an effect that starts this runs
 * effect → cleanup → effect; a cancelled-guard would drop the only response and
 * leave the card spinning forever. React ignores setState on a genuinely
 * unmounted component, so applying unconditionally is correct.
 */
export async function hydrateLibraryAttachmentPreview(
    doc: AttachedDocument,
    { patch, onObjectUrl }: HydrateLibraryPreviewOptions,
): Promise<void> {
    const mime = getAttachmentMime(doc.name, doc.type);
    const isImage = mime.startsWith('image/');
    const isText = isTextPreviewable(doc.name, mime);

    try {
        if (!doc.key) throw new Error('Library document has no key');
        const result = await getFileDownloadUrl(doc.key, undefined);
        if (!result.success || !result.downloadUrl) throw new Error('Preview URL unavailable');
        const response = await fetch(result.downloadUrl);
        if (!response.ok) throw new Error(`Preview request failed: ${response.status}`);

        if (isImage) {
            const { objectUrl, bytes } = await imageResponseToObjectUrlWithBytes(response);
            onObjectUrl?.(doc.id, objectUrl);
            patch(doc.id, (attachment) => ({
                ...attachment,
                bytes: attachment.bytes || bytes,
                thumbUrl: objectUrl,
                previewUrl: objectUrl,
                previewState: 'available',
            }));
            return;
        }

        if (isText) {
            const text = await response.text();
            const bytes = new TextEncoder().encode(text).byteLength;
            const lineCount = text.split('\n').length;
            const tooLarge = bytes > TOO_LARGE_TEXT_BYTES || lineCount > TOO_LARGE_TEXT_LINES;
            patch(doc.id, (attachment) => ({
                ...attachment,
                bytes: attachment.bytes || bytes,
                bodyPreview: text.slice(0, BODY_PREVIEW_CHARS),
                fullText: text,
                lineCount,
                previewState: tooLarge ? 'too-large' : 'available',
            }));
            return;
        }

        patch(doc.id, (attachment) => ({ ...attachment, previewState: 'unsupported' }));
    } catch {
        patch(doc.id, (attachment) => ({ ...attachment, previewState: 'failed' }));
    }
}
