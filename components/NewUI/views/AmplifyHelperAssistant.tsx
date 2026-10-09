import React, { useEffect, useMemo, useState } from 'react';
import {
  IconBook,
  IconChevronDown,
  IconExternalLink,
  IconSearch,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import {
  AMPLIFY_HELPER_DATA_CLASSIFICATION_URL,
  AMPLIFY_HELPER_GUIDE_SECTIONS,
  AMPLIFY_HELPER_RESOURCES_URL,
  AMPLIFY_HELPER_SUPPORT_EMAIL,
  type AmplifyHelperGuideSection,
} from '@/components/NewUI/shared/amplifyHelperGuide';

export type AmplifyHelperDestination =
  | { kind: 'settings'; value: string }
  | { kind: 'page'; value: string };

interface AmplifyHelperAssistantProps {
  onStartChat: (topicQuestion?: string) => void;
  documentationUrl?: string;
  supportEmail?: string;
  enabledDestinations?: ReadonlySet<string>;
  onNavigate?: (destination: AmplifyHelperDestination) => void;
}

const destinationKey = (destination: AmplifyHelperDestination) =>
  `${destination.kind}:${destination.value}`;

const NAVIGATION_TOKENS: ReadonlyArray<{
  label: string;
  destination: AmplifyHelperDestination;
}> = [
  { label: 'Settings → Connectors', destination: { kind: 'settings', value: 'connectors' } },
  { label: 'Customize → Prompt Templates', destination: { kind: 'settings', value: 'promptTemplates' } },
  { label: 'Customize → Custom Instructions', destination: { kind: 'settings', value: 'customInstructions' } },
  { label: 'MCP Servers', destination: { kind: 'settings', value: 'mcp' } },
  { label: 'Prompt Templates', destination: { kind: 'settings', value: 'promptTemplates' } },
  { label: 'Custom Instructions', destination: { kind: 'settings', value: 'customInstructions' } },
  { label: 'Assistants', destination: { kind: 'page', value: 'assistantGallery' } },
  { label: 'Library', destination: { kind: 'page', value: 'library' } },
  { label: 'Scheduled', destination: { kind: 'page', value: 'scheduledTasks' } },
  { label: 'Workflows', destination: { kind: 'page', value: 'workflows' } },
  { label: 'Notebook', destination: { kind: 'page', value: 'notebook' } },
  { label: 'Chats', destination: { kind: 'page', value: 'chats' } },
];

export function amplifyHelperSectionSlug(title: string, index = 0): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `section-${index + 1}`;
}

export function filterAmplifyHelperSections(
  sections: readonly AmplifyHelperGuideSection[],
  query: string,
): AmplifyHelperGuideSection[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...sections];
  return sections.filter((section) =>
    [section.title, section.summary, ...section.steps]
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}

export function buildAmplifyHelperQuestion(section: Pick<AmplifyHelperGuideSection, 'title' | 'summary'>): string {
  return `Can you help me with “${section.title}”? ${section.summary}`;
}

const pathTokenClass = 'rounded-[4px] bg-[--bg-active] px-1 py-0.5 font-medium text-[--text-primary]';

function renderStep(
  step: string,
  enabledDestinations: ReadonlySet<string>,
  onNavigate?: (destination: AmplifyHelperDestination) => void,
): React.ReactNode[] {
  const tokens = [...NAVIGATION_TOKENS].sort((a, b) => b.label.length - a.label.length);
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${tokens.map(({ label }) => escapeRegExp(label)).join('|')})`, 'g');
  const parts = step.split(pattern);

  return parts.map((part, index) => {
    const token = tokens.find(({ label }) => label === part);
    if (!token) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;

    const key = destinationKey(token.destination);
    const canNavigate = enabledDestinations.has(key) && !!onNavigate;
    if (!canNavigate) {
      return <span key={`${part}-${index}`} className={pathTokenClass}>{part}</span>;
    }

    return (
      <button
        key={`${part}-${index}`}
        type="button"
        className={`${pathTokenClass} cursor-pointer hover:bg-[--bg-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]`}
        onClick={() => onNavigate?.(token.destination)}
      >
        {part}
      </button>
    );
  });
}

const GuideSection: React.FC<{
  section: AmplifyHelperGuideSection;
  index: number;
  open: boolean;
  onToggle: () => void;
  onAsk: () => void;
  enabledDestinations: ReadonlySet<string>;
  onNavigate?: (destination: AmplifyHelperDestination) => void;
}> = ({ section, index, open, onToggle, onAsk, enabledDestinations, onNavigate }) => {
  const slug = amplifyHelperSectionSlug(section.title, index);
  const sectionId = `amplify-helper-${slug}`;
  const titleId = `${sectionId}-title`;

  return (
    <article
      id={sectionId}
      className="overflow-hidden rounded-[10px] border transition-colors"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${sectionId}-content`}
        onClick={onToggle}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[--bg-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--accent]"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="min-w-0 flex-1">
          <span id={titleId} className="block text-[13px] font-semibold leading-5">{section.title}</span>
          <span className="mt-0.5 block truncate text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>
            {section.summary}
          </span>
        </span>
        <IconChevronDown
          aria-hidden="true"
          size={16}
          className={`flex-shrink-0 motion-safe:transition-transform motion-safe:duration-150 ${open ? 'rotate-0' : '-rotate-90'}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {open && (
        <div
          id={`${sectionId}-content`}
          role="region"
          aria-labelledby={titleId}
          className="px-4 pb-4 pt-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ul className="m-0 list-none space-y-3 pl-1 text-[12px] leading-[1.6]">
            {section.steps.map((step, stepIndex) => (
              <li key={`${sectionId}-step-${stepIndex}`} className="relative pl-4">
                <span aria-hidden="true" className="absolute left-0 top-[0.62em] h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                {renderStep(step, enabledDestinations, onNavigate)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onAsk}
            className="mt-4 rounded-[6px] px-1 py-1 text-[12px] font-medium text-[--accent] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
          >
            Ask Amplify Helper about this
          </button>
        </div>
      )}
    </article>
  );
};

export const AmplifyHelperAssistant: React.FC<AmplifyHelperAssistantProps> = ({
  onStartChat,
  documentationUrl,
  supportEmail,
  enabledDestinations = new Set(),
  onNavigate,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const support = supportEmail?.trim() || AMPLIFY_HELPER_SUPPORT_EMAIL;
  const docs = documentationUrl?.trim() || AMPLIFY_HELPER_RESOURCES_URL;
  const filteredSections = useMemo(
    () => filterAmplifyHelperSections(AMPLIFY_HELPER_GUIDE_SECTIONS, query),
    [query],
  );

  useEffect(() => {
    if (!query.trim()) return;
    const matchingIds = new Set(
      filteredSections.map((section) => `amplify-helper-${amplifyHelperSectionSlug(section.title, AMPLIFY_HELPER_GUIDE_SECTIONS.indexOf(section))}`),
    );
    setExpanded((current) => {
      const next = new Set(current);
      matchingIds.forEach((id) => next.add(id));
      return next;
    });
  }, [filteredSections, query]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    if (!targetId.startsWith('amplify-helper-')) return;
    const sectionIndex = AMPLIFY_HELPER_GUIDE_SECTIONS.findIndex((section, index) =>
      `amplify-helper-${amplifyHelperSectionSlug(section.title, index)}` === targetId,
    );
    if (sectionIndex < 0) return;
    setExpanded((current) => new Set(current).add(targetId));
    window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ block: 'start' }));
  }, []);

  const toggle = (sectionId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  return (
    <section aria-labelledby="amplify-helper-title" className="h-full overflow-y-auto bg-[--bg-app]" style={{ color: 'var(--text-primary)' }}>
      <div className="mx-auto w-full max-w-[800px] px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[9px]" style={{ background: 'var(--bg-active)', color: 'var(--accent)' }}>
              <IconSparkles size={20} />
            </div>
            <div className="min-w-0">
              <h2 id="amplify-helper-title" className="m-0 text-[15px] font-semibold">Amplify Helper</h2>
              <p className="mt-1 max-w-[640px] text-[12px] leading-[1.6]" style={{ color: 'var(--text-secondary)' }}>
                A shared, administrator-controlled guide to using Amplify. Ask how to navigate a feature, configure a capability, or choose the right workflow.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStartChat()}
            className="flex h-[34px] flex-shrink-0 items-center gap-2 rounded-[8px] px-4 text-[13px] font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <IconSparkles size={15} />
            Chat with Amplify Helper
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="mr-1 inline-flex items-center gap-1 px-1 py-1" title="Guide for all Vanderbilt Amplify users">
            <IconBook size={13} aria-hidden="true" />
            Guide for all Vanderbilt Amplify users
          </span>
          <a className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 hover:bg-[--bg-hover] hover:text-[--text-primary] hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]" href={docs} target="_blank" rel="noreferrer">
            Resources <IconExternalLink size={12} aria-hidden="true" />
          </a>
          <a className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 hover:bg-[--bg-hover] hover:text-[--text-primary] hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]" href={AMPLIFY_HELPER_DATA_CLASSIFICATION_URL} target="_blank" rel="noreferrer">
            Data classification <IconExternalLink size={12} aria-hidden="true" />
          </a>
          <a className="inline-flex items-center rounded-[6px] px-2 py-1 hover:bg-[--bg-hover] hover:text-[--text-primary] hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]" href={`mailto:${support}`}>
            {support}
          </a>
        </div>

        <div className="relative mt-5">
          <IconSearch aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the guide…"
            aria-label="Search the Amplify Helper guide"
            className="h-9 w-full rounded-[8px] border bg-[--bg-raised] pl-9 pr-9 text-[12px] outline-none placeholder:text-[--text-muted] focus-visible:ring-2 focus-visible:ring-[--accent]"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          />
          {query && (
            <button type="button" aria-label="Clear guide search" onClick={() => setQuery('')} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[5px] text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]">
              <IconX size={14} />
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }} aria-live="polite">
          {query.trim() ? `${filteredSections.length} matching section${filteredSections.length === 1 ? '' : 's'}` : 'Browse the guide by topic.'}
        </p>

        <div className="mt-3 space-y-2 pb-4">
          {filteredSections.map((section) => {
            const index = AMPLIFY_HELPER_GUIDE_SECTIONS.indexOf(section);
            const sectionId = `amplify-helper-${amplifyHelperSectionSlug(section.title, index)}`;
            return (
              <GuideSection
                key={sectionId}
                section={section}
                index={index}
                open={expanded.has(sectionId)}
                onToggle={() => toggle(sectionId)}
                onAsk={() => onStartChat(buildAmplifyHelperQuestion(section))}
                enabledDestinations={enabledDestinations}
                onNavigate={onNavigate}
              />
            );
          })}
          {filteredSections.length === 0 && (
            <p className="rounded-[10px] border px-4 py-5 text-center text-[12px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
              No guide sections match “{query}”.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default AmplifyHelperAssistant;
