import { ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import HomeContext from '@/pages/api/home/home.context';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import {
    LucideCheckCircle,
    LucideFile,
    LucideFileText,
    LucideLink,
    LucideLoader2,
    LucideXCircle,
} from './LucideIcons';
import {
    NotebookSummary,
    NotebookSettings,
    SourceListItem,
    Transformation,
    createSourceFromFile,
    createSourceFromText,
    createSourceFromUrl,
    getSettings,
    listNotebooks,
    listTransformations,
} from '@/services/notebookService';
import { filterTransformationsForRole } from './transformationAccess';
import { outlineButtonClass, primaryButtonClass, secondaryBadgeClass } from './notebookUI';

type SourceType = 'link' | 'upload' | 'text';

interface Props {
    // When provided (opened from within a notebook), that notebook comes
    // pre-selected in the wizard's Notebooks step.
    notebookId?: string;
    onClose: () => void;
    onCreated: (source: SourceListItem) => void;
}

const MAX_BATCH_SIZE = 50;

const FILE_ACCEPT =
    '.pdf,.doc,.docx,.pptx,.ppt,.xlsx,.xls,.txt,.md,.epub,.mp4,.avi,.mov,.wmv,.mp3,.wav,.m4a,.aac,.jpg,.jpeg,.png,.tiff,.zip,.tar,.gz,.html';

const WIZARD_STEPS = [
    { number: 1, title: 'Add Source', description: 'Content will be processed and analyzed by AI.' },
    { number: 2, title: 'Notebooks', description: 'Search notebooks...' },
    { number: 3, title: 'Process', description: 'Content will be processed and analyzed by AI.' },
] as const;

const fieldClass =
    'rounded-[--radius-button] border border-[--border-subtle] bg-[--bg-composer] text-sm text-[--text-primary] shadow-sm placeholder-[--text-muted] outline-none focus:border-[--accent] focus:ring-1 focus:ring-[--accent]';
// Reference (shadcn) sizing: inputs are a fixed h-9; textareas auto-grow with
// their content (field-sizing: content) from a 64px minimum.
const inputClass = `h-9 px-3 py-1 ${fieldClass}`;
const textareaClass = `min-h-[64px] [field-sizing:content] px-3 py-2 ${fieldClass}`;
const destructiveBadgeClass =
    'inline-flex items-center rounded-[--radius-row] bg-[--bg-active] px-2 py-0.5 text-xs font-medium text-[--text-error]';

// Mirrors the reference SourceTypeStep helper: split textarea input into
// lines and validate each as a URL.
const parseAndValidateUrls = (
    text: string,
): { valid: string[]; invalid: { url: string; line: number }[] } => {
    const valid: string[] = [];
    const invalid: { url: string; line: number }[] = [];
    text.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.length === 0) return;
        try {
            new URL(trimmed);
            valid.push(trimmed);
        } catch {
            invalid.push({ url: trimmed, line: index + 1 });
        }
    });
    return { valid, invalid };
};

// Backend's auto-title fallback doesn't fire for plain text sources, so a
// blank title would leave the source stuck as "Processing...". Files keep the
// prior filename fallback for the same reason.
const deriveFileTitle = (f: File): string => {
    const name = f.name.replace(/\.[^.]+$/, '');
    return name.length > 80 ? `${name.slice(0, 77)}…` : name || 'Untitled';
};

// --- Reference wizard-container / form-section / checkbox-list equivalents ---

const StepIndicator = ({
    currentStep,
    onStepClick,
    canAdvance,
}: {
    currentStep: number;
    onStepClick: (step: number) => void;
    canAdvance: boolean;
}) => (
    <div className="flex items-center justify-between border-b border-[--border-subtle] bg-[--bg-sidebar] px-6 py-4">
        {WIZARD_STEPS.map((step, index) => {
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;
            const isClickable =
                step.number <= currentStep || (step.number === currentStep + 1 && canAdvance);
            return (
                <div key={step.number} className="flex flex-1 items-center">
                    <div
                        className={`flex items-center ${isClickable ? 'cursor-pointer' : ''}`}
                        onClick={isClickable ? () => onStepClick(step.number) : undefined}
                    >
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors ${
                                isCompleted
                                    ? 'border-[--accent] bg-[--accent] text-[--accent-fg]'
                                    : isCurrent
                                      ? 'border-[--accent] bg-[--accent]/10 text-[--accent]'
                                      : 'border-[--border-subtle] bg-[--bg-raised] text-[--text-muted]'
                            }`}
                        >
                            {isCompleted ? '✓' : step.number}
                        </div>
                        <div className="ml-3 min-w-0">
                            <p
                                className={`text-sm font-medium ${
                                    isCurrent
                                        ? 'text-[--text-primary]'
                                        : 'text-[--text-muted]'
                                }`}
                            >
                                {step.title}
                            </p>
                            <p className="text-xs text-[--text-muted]">
                                {step.description}
                            </p>
                        </div>
                    </div>
                    {index < WIZARD_STEPS.length - 1 && (
                        <div
                            className={`mx-4 flex-1 border-t-2 transition-colors ${
                                isCompleted
                                    ? 'border-[--accent]'
                                    : 'border-[--border-subtle]'
                            }`}
                        />
                    )}
                </div>
            );
        })}
    </div>
);

const FormSection = ({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) => (
    <div className="mb-6 last:mb-0">
        <div className="mb-4">
            <h3 className="mb-1 block text-[14px] font-medium">{title}</h3>
            {description && (
                <p className="text-sm text-[--text-muted]">{description}</p>
            )}
        </div>
        <div className="space-y-3">{children}</div>
    </div>
);

const CheckboxList = ({
    items,
    selectedIds,
    onToggle,
    loading,
    emptyMessage,
}: {
    items: { id: string; title: string; description?: string }[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    loading: boolean;
    emptyMessage: string;
}) => {
    if (loading) {
        return (
            <div className="rounded-md border border-[--border-subtle] bg-[--bg-raised] p-4">
                <div className="animate-pulse space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-4 w-4 rounded bg-[--bg-active]" />
                            <div className="flex-1">
                                <div className="mb-1 h-4 w-3/4 rounded bg-[--bg-active]" />
                                <div className="h-3 w-1/2 rounded bg-[--bg-active]" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="rounded-md border border-[--border-subtle] bg-[--bg-raised] p-4">
                <p className="text-sm text-[--text-muted]">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border border-[--border-subtle] bg-[--bg-raised]">
            <div className="max-h-48 overflow-y-auto p-4">
                <div className="space-y-3">
                    {items.map((item) => (
                        <label
                            key={item.id}
                            className="-m-2 flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-[--bg-hover]"
                        >
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(item.id)}
                                onChange={() => onToggle(item.id)}
                                className="mt-0.5 h-4 w-4 accent-[--accent]"
                            />
                            <div className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">{item.title}</span>
                                {item.description && (
                                    <p className="mt-1 text-xs text-[--text-muted] line-clamp-2">
                                        {item.description}
                                    </p>
                                )}
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SOURCE_TYPES = [
    { value: 'link' as const, label: 'Add URL', Icon: LucideLink },
    { value: 'upload' as const, label: 'Upload File', Icon: LucideFile },
    { value: 'text' as const, label: 'Enter Text', Icon: LucideFileText },
];

interface BatchProgress {
    total: number;
    completed: number;
    failed: number;
    currentItem?: string;
}

// Mirrors the reference AddSourceDialog: a 3-step wizard (source type →
// notebooks → transformations/embedding) with batch URL/file support and a
// processing view while sources are submitted.
export const AddSourceDialog = ({ notebookId, onClose, onCreated }: Props) => {
    const {
        state: { featureFlags },
    } = useContext(HomeContext);
    const isAdmin = !!featureFlags?.adminInterface;

    const [currentStep, setCurrentStep] = useState(1);

    // Step 1 form state. The URL tab starts open, matching the reference.
    const [type, setType] = useState<SourceType | ''>('link');
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [content, setContent] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [hasHtmlContent, setHasHtmlContent] = useState(false);
    const [urlValidationErrors, setUrlValidationErrors] = useState<
        { url: string; line: number }[]
    >([]);

    // Steps 2 and 3.
    const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
    const [notebooksLoading, setNotebooksLoading] = useState(true);
    const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>(
        notebookId ? [notebookId] : [],
    );
    const [transformations, setTransformations] = useState<Transformation[]>([]);
    const [transformationsLoading, setTransformationsLoading] = useState(true);
    const [selectedTransformations, setSelectedTransformations] = useState<string[]>([]);
    const [settings, setSettings] = useState<NotebookSettings | null>(null);
    const [embed, setEmbed] = useState(true);

    // Submission state.
    const [processing, setProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');
    // Distinguishes "still working" from "failed" so the processing view can
    // show a real error message with an error icon instead of the spinner —
    // previously any failure just showed the bare word "Error" here.
    const [processingFailed, setProcessingFailed] = useState(false);
    const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [nbs, trs, stg] = await Promise.all([
                listNotebooks({ order_by: 'updated desc' }),
                listTransformations(),
                getSettings(),
            ]);
            if (cancelled) return;
            setNotebooks(nbs);
            setNotebooksLoading(false);
            // Non-admins are offered only the curated transformation set; admins
            // keep the full list. Filter first so both the displayed options and
            // the apply_default pre-selection derive from the allowed set.
            const allowedTrs = filterTransformationsForRole(trs, isAdmin);
            setTransformations(allowedTrs);
            setTransformationsLoading(false);
            setSelectedTransformations(
                allowedTrs.filter((t) => t.apply_default).map((t) => t.id),
            );
            setSettings(stg);
            const option = stg?.default_embedding_option;
            setEmbed(option === 'always' || option === 'ask' || !option);
        })();
        return () => {
            cancelled = true;
        };
        // Runs once on mount. isAdmin is derived from feature flags that are
        // resolved before the dialog opens and don't change during its lifetime,
        // so it's intentionally omitted to avoid re-fetching on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Batch mode detection (multiple URLs or files), as in the reference.
    const { isBatchMode, itemCount, parsedUrls, urlCount, fileCount } = useMemo(() => {
        let parsedUrls: string[] = [];
        let urlCount = 0;
        if (type === 'link' && url) {
            const { valid } = parseAndValidateUrls(url);
            parsedUrls = valid;
            urlCount = url
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0).length;
        }
        const fileCount = type === 'upload' ? files.length : 0;
        const isBatchMode = urlCount > 1 || fileCount > 1;
        const itemCount = type === 'link' ? urlCount : fileCount;
        return { isBatchMode, itemCount, parsedUrls, urlCount, fileCount };
    }, [type, url, files]);

    const isOverLimit = itemCount > MAX_BATCH_SIZE;

    const isStepValid = (step: number): boolean => {
        switch (step) {
            case 1:
                if (!type) return false;
                if (isOverLimit) return false;
                if (urlValidationErrors.length > 0) return false;
                if (type === 'link') {
                    if (isBatchMode) return parsedUrls.length > 0;
                    return url.trim() !== '';
                }
                if (type === 'text') {
                    return content.trim() !== '' && title.trim() !== '';
                }
                if (type === 'upload') {
                    return files.length > 0 && files.length <= MAX_BATCH_SIZE;
                }
                return true;
            case 2:
            case 3:
                return true;
            default:
                return false;
        }
    };

    const handleNextStep = () => {
        if (currentStep === 1 && type === 'link' && url) {
            const { invalid } = parseAndValidateUrls(url);
            if (invalid.length > 0) {
                setUrlValidationErrors(invalid);
                return;
            }
            setUrlValidationErrors([]);
        }
        if (currentStep < 3 && isStepValid(currentStep)) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleStepClick = (step: number) => {
        if (step <= currentStep || (step === currentStep + 1 && isStepValid(currentStep))) {
            setCurrentStep(step);
        }
    };

    const toggleNotebook = (id: string) =>
        setSelectedNotebooks((prev) =>
            prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
        );

    const toggleTransformation = (id: string) =>
        setSelectedTransformations((prev) =>
            prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
        );

    // If HTML is available on paste, use it instead of plain text (the backend
    // converts it to Markdown), matching the reference.
    const handleTextPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const html = event.clipboardData.getData('text/html');
        if (html) {
            event.preventDefault();
            const textarea = event.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            setContent(content.substring(0, start) + html + content.substring(end));
            setHasHtmlContent(true);
        } else {
            setHasHtmlContent(false);
        }
    };

    // Only report sources back to the opener when they actually land in its
    // notebook (or when opened globally, where every creation counts).
    const reportCreated = (source: SourceListItem | null) => {
        if (!source) return;
        if (!notebookId || selectedNotebooks.includes(notebookId)) {
            onCreated(source);
        }
    };

    const createOne = async (item: { url?: string; file?: File }, itemTitle?: string) => {
        if (item.url !== undefined) {
            return createSourceFromUrl({
                notebooks: selectedNotebooks,
                url: item.url,
                title: itemTitle,
                transformations: selectedTransformations,
                embed,
            });
        }
        if (item.file) {
            return createSourceFromFile({
                notebooks: selectedNotebooks,
                file: item.file,
                title: itemTitle || deriveFileTitle(item.file),
                transformations: selectedTransformations,
                embed,
            });
        }
        return null;
    };

    // createOne/createSourceFromText now throw with the backend's real error
    // message on failure instead of returning null — this normalizes that
    // back to null-or-message so batch mode can keep counting failures while
    // single-source mode can show the user *why* it failed instead of the
    // bare word "Error".
    const createOneSafe = async (
        item: { url?: string; file?: File },
        itemTitle?: string,
    ): Promise<{ result: SourceListItem | null; error: string | null }> => {
        try {
            const result = await createOne(item, itemTitle);
            return { result, error: result ? null : 'Failed to create source.' };
        } catch (e: any) {
            return { result: null, error: e?.message || 'Failed to create source.' };
        }
    };

    const handleSubmit = async () => {
        if (!isStepValid(1) || processing) return;
        setProcessing(true);
        setProcessingFailed(false);

        if (isBatchMode) {
            const items: { url?: string; file?: File }[] =
                type === 'link'
                    ? parsedUrls.map((u) => ({ url: u }))
                    : files.map((f) => ({ file: f }));

            setProcessingMessage('Processing your files...');
            setBatchProgress({ total: items.length, completed: 0, failed: 0 });

            let success = 0;
            let failed = 0;
            // Remembers the most recent per-item failure message so the
            // "all failed" / "some failed" toasts below can say *why*
            // instead of just a bare count (e.g. rejected file type,
            // upload error) — previously every batch failure was silently
            // indistinguishable from every other.
            let lastError: string | null = null;
            for (const item of items) {
                const label = item.url
                    ? `${item.url.substring(0, 50)}...`
                    : item.file?.name ?? '';
                setBatchProgress((prev) => (prev ? { ...prev, currentItem: label } : null));

                const { result, error } = await createOneSafe(item);
                if (result) {
                    success++;
                    reportCreated(result);
                } else {
                    failed++;
                    lastError = error;
                }
                setBatchProgress((prev) =>
                    prev ? { ...prev, completed: success, failed } : null,
                );
            }

            if (failed === 0) {
                toast.success(`${success} source(s) created successfully`);
            } else if (success === 0) {
                toast.error(
                    lastError
                        ? `Failed to create all ${failed} sources: ${lastError}`
                        : `Failed to create all ${failed} sources`,
                );
            } else {
                toast(
                    lastError
                        ? `${success} succeeded, ${failed} failed (${lastError})`
                        : `${success} succeeded, ${failed} failed`,
                    { icon: '⚠️' },
                );
            }
            onClose();
            return;
        }

        // Single source submission.
        setProcessingMessage('Submitting source for processing...');
        const trimmedTitle = title.trim() || undefined;
        let result: SourceListItem | null = null;
        let errorMessage: string | null = null;
        try {
            if (type === 'link') {
                result = await createOne({ url: url.trim() }, trimmedTitle);
            } else if (type === 'text') {
                result = await createSourceFromText({
                    notebooks: selectedNotebooks,
                    content: content.trim(),
                    title: title.trim(),
                    transformations: selectedTransformations,
                    embed,
                });
            } else if (type === 'upload' && files[0]) {
                result = await createOne({ file: files[0] }, trimmedTitle);
            }
        } catch (e: any) {
            errorMessage = e?.message || 'Failed to create source.';
        }

        if (!result) {
            // Show the backend's real reason (rejected file type, upload
            // failure, validation error, etc.) instead of the bare word
            // "Error", which previously discarded it entirely.
            setProcessingMessage(errorMessage || 'Failed to create source.');
            setProcessingFailed(true);
            timeoutRef.current = setTimeout(() => {
                setProcessing(false);
                setProcessingFailed(false);
                setBatchProgress(null);
            }, 5000);
            return;
        }
        reportCreated(result);
        onClose();
    };

    // --- Processing view (mirrors the reference's replacement dialog) ---
    if (processing) {
        const progressPercent = batchProgress
            ? Math.round(
                  ((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100,
              )
            : undefined;

        return (
            <CreationModalShell
                title={batchProgress ? 'Processing your files...' : 'Processing'}
                onClose={onClose}
            >
                    <div className="flex flex-col gap-4 p-2 text-[--text-primary]">
                        <p className="text-sm text-[--text-muted]">
                            {processingFailed
                                ? "Something went wrong and your source wasn't created."
                                : batchProgress
                                ? `Processing ${batchProgress.total} sources. This may take a few moments.`
                                : 'Your source is being processed. This may take a few moments.'}
                        </p>

                        <div className="flex items-center gap-3">
                            {processingFailed ? (
                                <LucideXCircle
                                    size={20}
                                    className="flex-none text-[--text-error]"
                                />
                            ) : (
                                <LucideLoader2 size={20} className="animate-spin flex-none text-[--text-muted]" />
                            )}
                            <span
                                className={`text-sm ${
                                    processingFailed
                                        ? 'text-[--text-error]'
                                        : 'text-[--text-muted]'
                                }`}
                            >
                                {processingMessage || 'Processing...'}
                            </span>
                        </div>

                        {batchProgress && (
                            <>
                                <div className="h-2 w-full rounded-full bg-[--bg-active]">
                                    <div
                                        className="h-2 rounded-full bg-[--accent] transition-all duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-4">
                                        <span className="flex items-center gap-1.5 text-[--text-secondary]">
                                            <LucideCheckCircle size={16} />
                                            {batchProgress.completed} completed
                                        </span>
                                        {batchProgress.failed > 0 && (
                                            <span className="flex items-center gap-1.5 text-[--text-error]">
                                                <LucideXCircle size={16} />
                                                {batchProgress.failed} failed
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[--text-muted]">
                                        {batchProgress.completed + batchProgress.failed} /{' '}
                                        {batchProgress.total}
                                    </span>
                                </div>

                                {batchProgress.currentItem && (
                                    <p className="truncate text-xs text-[--text-muted]">
                                        Current: {batchProgress.currentItem}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
            </CreationModalShell>
        );
    }

    const currentStepValid = isStepValid(currentStep);

    return (
        <CreationModalShell title="Add New Source" onClose={onClose}>
                <div className="flex flex-col gap-4 p-2 text-[--text-primary]">
                    <p className="text-sm text-[--text-muted]">
                        Content will be processed and analyzed by AI.
                    </p>

                    <div className="flex h-[560px] flex-col overflow-hidden rounded-lg border border-[--border-subtle] bg-[--bg-app]">
                        <StepIndicator
                            currentStep={currentStep}
                            onStepClick={handleStepClick}
                            canAdvance={currentStepValid}
                        />

                        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-4">
                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <FormSection
                                        title="Sources"
                                        description="Content will be processed and analyzed by AI."
                                    >
                                        <SegmentedControl
                                            items={SOURCE_TYPES.map(({ value, label, Icon }) => ({
                                                id: value,
                                                label,
                                                icon: <Icon size={16} />,
                                            }))}
                                            value={type || 'link'}
                                            onChange={(id) => setType(id as SourceType)}
                                            aria-label="Source type"
                                        />

                                        {type && (
                                            <div className="mt-4">
                                                <p className="mb-4 text-sm text-[--text-muted]">
                                                    Content will be processed and analyzed by AI.
                                                </p>

                                                {type === 'link' && (
                                                    <div>
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <label
                                                                htmlFor="source-url"
                                                                className="text-sm font-medium leading-none"
                                                            >
                                                                URL(s) *
                                                            </label>
                                                            {urlCount > 0 && (
                                                                <span
                                                                    className={
                                                                        isOverLimit
                                                                            ? destructiveBadgeClass
                                                                            : secondaryBadgeClass
                                                                    }
                                                                >
                                                                    {urlCount} URL(s)
                                                                    {isOverLimit &&
                                                                        ` (max ${MAX_BATCH_SIZE})`}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <textarea
                                                            id="source-url"
                                                            autoFocus
                                                            value={url}
                                                            onChange={(e) => {
                                                                setUrl(e.target.value);
                                                                setUrlValidationErrors([]);
                                                            }}
                                                            placeholder={
                                                                'Enter URLs, one per line\nhttps://example.com/article1\nhttps://example.com/article2'
                                                            }
                                                            rows={urlCount > 1 ? 6 : 2}
                                                            className={`w-full font-mono ${textareaClass}`}
                                                        />
                                                        <p className="mt-1 text-xs text-[--text-muted]">
                                                            Paste multiple URLs (one per line) to
                                                            batch import
                                                        </p>
                                                        {urlValidationErrors.length > 0 && (
                                                            <div className="mt-2 rounded-md border border-[--border-subtle] bg-[--bg-raised] p-3">
                                                                <p className="mb-2 text-sm font-medium text-[--text-error]">
                                                                    Invalid URLs detected:
                                                                </p>
                                                                <ul className="space-y-1">
                                                                    {urlValidationErrors.map(
                                                                        (err, idx) => (
                                                                            <li
                                                                                key={idx}
                                                                                className="flex items-start gap-2 text-xs text-[--text-error]"
                                                                            >
                                                                                <span className="rounded bg-[--bg-active] px-1 font-mono">
                                                                                    Line {err.line}
                                                                                </span>
                                                                                <span className="truncate">
                                                                                    {err.url}
                                                                                </span>
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ul>
                                                                <p className="mt-2 text-xs text-[--text-muted]">
                                                                    Please fix or remove invalid
                                                                    URLs to continue
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {type === 'upload' && (
                                                    <div>
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <label
                                                                htmlFor="source-file"
                                                                className="text-sm font-medium leading-none"
                                                            >
                                                                File(s) *
                                                            </label>
                                                            {fileCount > 0 && (
                                                                <span
                                                                    className={
                                                                        isOverLimit
                                                                            ? destructiveBadgeClass
                                                                            : secondaryBadgeClass
                                                                    }
                                                                >
                                                                    {fileCount} file(s)
                                                                    {isOverLimit &&
                                                                        ` (max ${MAX_BATCH_SIZE})`}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <input
                                                            id="source-file"
                                                            type="file"
                                                            multiple
                                                            accept={FILE_ACCEPT}
                                                            onChange={(e) =>
                                                                setFiles(
                                                                    Array.from(
                                                                        e.target.files ?? [],
                                                                    ),
                                                                )
                                                            }
                                                            className={`w-full file:mr-3 file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[--text-primary] ${inputClass}`}
                                                        />
                                                        <p className="mt-1 text-xs text-[--text-muted]">
                                                            Select multiple files to batch import.
                                                            Supported: Documents (PDF, DOC, DOCX,
                                                            PPT, XLS, EPUB, TXT, MD), Media (MP4,
                                                            MP3, WAV, M4A), Images (JPG, PNG),
                                                            Archives (ZIP)
                                                        </p>
                                                        {fileCount > 1 && (
                                                            <div className="mt-2 rounded-md bg-[--bg-active] p-3">
                                                                <p className="mb-2 text-xs font-medium">
                                                                    Selected files:
                                                                </p>
                                                                <ul className="max-h-32 space-y-1 overflow-y-auto">
                                                                    {files.map((file, idx) => (
                                                                        <li
                                                                            key={idx}
                                                                            className="flex items-center gap-2 text-xs text-[--text-muted]"
                                                                        >
                                                                            <LucideFile size={12} />
                                                                            <span className="truncate">
                                                                                {file.name}
                                                                            </span>
                                                                            <span className="text-[--text-muted]">
                                                                                (
                                                                                {(
                                                                                    file.size / 1024
                                                                                ).toFixed(1)}{' '}
                                                                                KB)
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {isOverLimit && (
                                                            <p className="mt-1 text-sm text-[--text-error]">
                                                                Maximum {MAX_BATCH_SIZE} files
                                                                allowed per batch
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {type === 'text' && (
                                                    <div>
                                                        <label
                                                            htmlFor="source-content"
                                                            className="mb-2 block text-sm font-medium leading-none"
                                                        >
                                                            Text Content *
                                                        </label>
                                                        {hasHtmlContent && (
                                                            <div className="mb-2 rounded-md border border-[--border-subtle] bg-[--bg-active] p-2">
                                                                <p className="text-sm text-[--text-secondary]">
                                                                    HTML content detected. It will
                                                                    be converted to Markdown after
                                                                    processing.
                                                                </p>
                                                            </div>
                                                        )}
                                                        <textarea
                                                            id="source-content"
                                                            autoFocus
                                                            value={content}
                                                            onChange={(e) =>
                                                                setContent(e.target.value)
                                                            }
                                                            onPaste={handleTextPaste}
                                                            placeholder="Paste or type your content here..."
                                                            rows={6}
                                                            className={`w-full ${textareaClass}`}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </FormSection>

                                    {/* Title is hidden in batch mode — titles are auto-generated. */}
                                    {!isBatchMode && (
                                        <FormSection
                                            title={
                                                type === 'text' ? 'Title *' : 'Title (Optional)'
                                            }
                                            description={
                                                type === 'text'
                                                    ? 'A title is required for text content'
                                                    : 'If left empty, a title will be generated from the content'
                                            }
                                        >
                                            <input
                                                id="source-title"
                                                type="text"
                                                autoComplete="off"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="Give your source a descriptive title"
                                                className={`w-full ${inputClass}`}
                                            />
                                        </FormSection>
                                    )}

                                    {isBatchMode && (
                                        <div className="rounded-lg border border-[--accent]/20 bg-[--accent]/5 p-4">
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="inline-flex items-center rounded-md bg-[--accent] px-2 py-0.5 text-xs font-medium text-[--accent-fg]">
                                                    Batch Mode
                                                </span>
                                                <span className="text-sm font-medium">
                                                    {itemCount}{' '}
                                                    {type === 'link' ? 'Add URL' : 'Upload File'}{' '}
                                                    will be processed
                                                </span>
                                            </div>
                                            <p className="text-xs text-[--text-muted]">
                                                Titles will be automatically generated for each
                                                source. The same notebooks and transformations
                                                will be applied to all items.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="space-y-6">
                                    <FormSection
                                        title="Notebooks (Optional)"
                                        description="Select existing sources from across all your notebooks to add to the current one."
                                    >
                                        <CheckboxList
                                            items={notebooks.map((nb) => ({
                                                id: nb.id,
                                                title: nb.name || '(untitled)',
                                                description: nb.description || undefined,
                                            }))}
                                            selectedIds={selectedNotebooks}
                                            onToggle={toggleNotebook}
                                            loading={notebooksLoading}
                                            emptyMessage="No notebooks found."
                                        />
                                    </FormSection>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="space-y-8">
                                    <FormSection
                                        title="Transformations (Optional)"
                                        description="Content will be processed and analyzed by AI."
                                    >
                                        <CheckboxList
                                            items={transformations.map((t) => ({
                                                id: t.id,
                                                title: t.title,
                                                description: t.description,
                                            }))}
                                            selectedIds={selectedTransformations}
                                            onToggle={toggleTransformation}
                                            loading={transformationsLoading}
                                            emptyMessage="No matches found"
                                        />
                                    </FormSection>

                                    <FormSection
                                        title="Settings"
                                        description="Content will be processed and analyzed by AI."
                                    >
                                        <div className="space-y-4">
                                            {(!settings ||
                                                settings.default_embedding_option === 'ask' ||
                                                !settings.default_embedding_option) && (
                                                <label className="flex cursor-pointer items-start gap-3 rounded-md p-3 hover:bg-[--bg-hover]">
                                                    <input
                                                        type="checkbox"
                                                        checked={embed}
                                                        onChange={(e) =>
                                                            setEmbed(e.target.checked)
                                                        }
                                                        className="mt-0.5 h-4 w-4 accent-[--accent]"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="block text-sm font-medium">
                                                            Enable embedding for search
                                                        </span>
                                                        <p className="mt-1 text-xs text-[--text-muted]">
                                                            Allows this source to be found in
                                                            vector searches and AI queries
                                                        </p>
                                                    </div>
                                                </label>
                                            )}

                                            {settings?.default_embedding_option === 'always' && (
                                                <div className="rounded-md border border-[--accent]/30 bg-[--accent]/10 p-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-[--accent]" />
                                                        <div className="flex-1">
                                                            <span className="block text-sm font-medium text-[--accent]">
                                                                Embedding enabled automatically
                                                            </span>
                                                            <p className="mt-1 text-xs text-[--accent]">
                                                                Your settings are configured to
                                                                always embed content for vector
                                                                search. You can change this in
                                                                Settings{' '}
                                                                <span className="font-medium">
                                                                    Settings
                                                                </span>
                                                                .
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {settings?.default_embedding_option === 'never' && (
                                                <div className="rounded-md border border-[--border-subtle] bg-[--bg-active] p-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-[--text-muted]" />
                                                        <div className="flex-1">
                                                            <span className="block text-sm font-medium">
                                                                Embedding disabled
                                                            </span>
                                                            <p className="mt-1 text-xs text-[--text-muted]">
                                                                Your settings are configured to
                                                                skip embedding. Vector search
                                                                won&apos;t be available for this
                                                                source. You can change this in
                                                                Settings{' '}
                                                                <span className="font-medium">
                                                                    Settings
                                                                </span>
                                                                .
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </FormSection>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sticky footer — CreationModalShell's body scrolls, but this wizard
                        needs 4 footer buttons (Cancel/Back/Next/Done), more than the shell's
                        built-in Cancel+Save footer supports. Keeping it `sticky bottom-0`
                        inside the scroll body preserves the old Modal's always-visible
                        footer instead of letting it scroll away with long step content. */}
                    <div className="sticky bottom-0 -mx-2 -mb-2 flex items-center justify-between border-t border-[--border-subtle] bg-[--bg-raised] px-2 pb-2 pt-4">
                        <button type="button" onClick={onClose} className={outlineButtonClass}>
                            Cancel
                        </button>

                        <div className="flex gap-2">
                            {currentStep > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(currentStep - 1)}
                                    className={outlineButtonClass}
                                >
                                    Back
                                </button>
                            )}

                            {currentStep < 3 && (
                                <button
                                    type="button"
                                    onClick={handleNextStep}
                                    disabled={!currentStepValid}
                                    className={outlineButtonClass}
                                >
                                    Next
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!currentStepValid || processing}
                                className={`min-w-[120px] ${primaryButtonClass}`}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
        </CreationModalShell>
    );
};

export default AddSourceDialog;
