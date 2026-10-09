import React, { useState } from 'react';
import { IconBook, IconChevronDown, IconExternalLink, IconSparkles } from '@tabler/icons-react';
import {
  AMPLIFY_HELPER_DATA_CLASSIFICATION_URL,
  AMPLIFY_HELPER_GUIDE_SECTIONS,
  AMPLIFY_HELPER_RESOURCES_URL,
  AMPLIFY_HELPER_SUPPORT_EMAIL,
  type AmplifyHelperGuideSection,
} from '@/components/NewUI/shared/amplifyHelperGuide';

interface AmplifyHelperAssistantProps {
  onStartChat: () => void;
  documentationUrl?: string;
  supportEmail?: string;
}

const GuideSection: React.FC<{
  section: AmplifyHelperGuideSection;
  open: boolean;
  onToggle: () => void;
}> = ({ section, open, onToggle }) => {
  const sectionId = `amplify-helper-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div className="rounded-[10px] border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={sectionId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="flex-1">
          <span className="block text-[13px] font-semibold">{section.title}</span>
          <span className="mt-0.5 block text-[12px]" style={{ color: 'var(--text-secondary)' }}>{section.summary}</span>
        </span>
        <IconChevronDown size={16} className={`flex-shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div id={sectionId} className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <ul className="m-0 list-disc space-y-2 pl-5 text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {section.steps.map((step) => <li key={step}>{step}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

export const AmplifyHelperAssistant: React.FC<AmplifyHelperAssistantProps> = ({
  onStartChat,
  documentationUrl,
  supportEmail,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([AMPLIFY_HELPER_GUIDE_SECTIONS[0].title]));
  const support = supportEmail?.trim() || AMPLIFY_HELPER_SUPPORT_EMAIL;
  const docs = documentationUrl?.trim() || AMPLIFY_HELPER_RESOURCES_URL;

  const toggle = (title: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <section
      aria-labelledby="amplify-helper-title"
      className="mx-3 mt-2 rounded-[12px] border p-4"
      style={{ borderColor: 'var(--accent)', background: 'var(--bg-raised)', color: 'var(--text-primary)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[9px]" style={{ background: 'var(--bg-active)', color: 'var(--accent)' }}>
            <IconSparkles size={20} />
          </div>
          <div className="min-w-0">
            <h2 id="amplify-helper-title" className="m-0 text-[15px] font-semibold">Amplify Helper</h2>
            <p className="mt-1 max-w-[640px] text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              A shared, administrator-controlled guide to using Amplify. Ask how to navigate a feature, configure a capability, or choose the right workflow.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStartChat}
          className="flex h-[34px] flex-shrink-0 items-center gap-2 rounded-[8px] px-4 text-[13px] font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          <IconSparkles size={15} />
          Chat with Amplify Helper
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span className="inline-flex items-center gap-1"><IconBook size={13} /> Guide for all Vanderbilt Amplify users</span>
        <a className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-[--text-primary]" href={docs} target="_blank" rel="noreferrer">
          Resources <IconExternalLink size={12} />
        </a>
        <a className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-[--text-primary]" href={AMPLIFY_HELPER_DATA_CLASSIFICATION_URL} target="_blank" rel="noreferrer">
          Data classification <IconExternalLink size={12} />
        </a>
        <a className="underline underline-offset-2 hover:text-[--text-primary]" href={`mailto:${support}`}>{support}</a>
      </div>

      <div className="mt-4 space-y-2">
        {AMPLIFY_HELPER_GUIDE_SECTIONS.map((section) => (
          <GuideSection
            key={section.title}
            section={section}
            open={expanded.has(section.title)}
            onToggle={() => toggle(section.title)}
          />
        ))}
      </div>
    </section>
  );
};

export default AmplifyHelperAssistant;
