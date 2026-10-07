import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconBrain, IconCheck, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { getUserSkills } from '@/services/skillsService';
import type { Skill } from '@/types/skill';
import { MAX_CONVERSATION_SKILLS } from './conversationSkillSelection';
import { NEW_UI_SETTINGS_EVENT } from './newUISettingsEvents';

interface SkillAttachSubmenuProps {
  chatEndpoint?: string;
  selectedSkillIds: string[];
  onSelectionChange: (skillIds: string[]) => void;
  onClose?: () => void;
}

export const SkillAttachSubmenu: React.FC<SkillAttachSubmenuProps> = ({
  chatEndpoint,
  selectedSkillIds,
  onSelectionChange,
  onClose,
}) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSkills = useCallback(async () => {
    if (!chatEndpoint) {
      setSkills([]);
      setError('Skills are unavailable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getUserSkills(chatEndpoint, true);
      if (response.success && Array.isArray(response.data)) {
        setSkills(response.data.filter((skill) => skill.isEnabled));
      } else {
        setError(response.message || 'Unable to load skills.');
      }
    } catch {
      setError('Unable to load skills.');
    } finally {
      setLoading(false);
    }
  }, [chatEndpoint]);

  useEffect(() => {
    void loadSkills();
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSkills]);

  const filteredSkills = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return skills;
    return skills.filter((skill) =>
      skill.name.toLowerCase().includes(term) ||
      skill.description?.toLowerCase().includes(term) ||
      skill.tags?.some((tag) => tag.toLowerCase().includes(term)),
    );
  }, [search, skills]);

  const toggleSkill = (skillId: string) => {
    if (selectedSkillIds.includes(skillId)) {
      onSelectionChange(selectedSkillIds.filter((id) => id !== skillId));
      return;
    }
    onSelectionChange(
      selectedSkillIds.length >= MAX_CONVERSATION_SKILLS
        ? [...selectedSkillIds.slice(1), skillId]
        : [...selectedSkillIds, skillId],
    );
  };

  const manageSkills = () => {
    onClose?.();
    window.dispatchEvent(new CustomEvent(NEW_UI_SETTINGS_EVENT, { detail: { section: 'skills' } }));
  };

  return (
    <div
      role="menu"
      aria-label="Add skills"
      data-new-ui-shell="true"
      style={{
        width: 320,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        overflow: 'hidden',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <IconBrain size={16} style={{ color: 'var(--accent)' }} />
            <span>Skills</span>
            {selectedSkillIds.length > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {selectedSkillIds.length} selected
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelectionChange([])}
            disabled={selectedSkillIds.length === 0}
            aria-label="Clear selected skills"
            className="flex items-center justify-center rounded-[6px]"
            style={{ color: selectedSkillIds.length ? 'var(--text-secondary)' : 'var(--text-muted)', width: 24, height: 24 }}
          >
            <IconX size={14} />
          </button>
        </div>
        <div className="relative">
          <IconSearch size={14} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search skills…"
            aria-label="Search skills"
            className="w-full rounded-[7px]"
            style={{ height: 32, padding: '0 9px 0 28px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ maxHeight: 270, overflowY: 'auto', padding: 6 }}>
        {loading && <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading skills…</div>}
        {!loading && error && (
          <div style={{ padding: 16, color: 'var(--text-error)', fontSize: 13, textAlign: 'center' }}>
            <div>{error}</div>
            <button type="button" onClick={() => void loadSkills()} className="mt-2 inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              <IconRefresh size={13} /> Retry
            </button>
          </div>
        )}
        {!loading && !error && filteredSkills.length === 0 && (
          <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {skills.length === 0 ? 'No enabled skills yet.' : 'No matching skills.'}
          </div>
        )}
        {!loading && !error && filteredSkills.map((skill) => {
          const selected = selectedSkillIds.includes(skill.id);
          return (
            <button
              key={skill.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={selected}
              onClick={() => toggleSkill(skill.id)}
              className="w-full flex items-start gap-2 rounded-[8px] text-left"
              style={{ padding: '8px 7px', background: selected ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}
            >
              <span className="flex items-center justify-center rounded-[4px] mt-[1px]" style={{ width: 17, height: 17, border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`, background: selected ? 'var(--accent)' : 'transparent', color: 'var(--accent-fg)', flexShrink: 0 }}>
                {selected && <IconCheck size={12} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="block truncate" style={{ fontSize: 13 }}>{skill.name}</span>
                {skill.description && <span className="block truncate" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{skill.description}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={manageSkills} style={{ color: 'var(--accent)', fontSize: 12 }}>Manage skills…</button>
        {onClose && <button type="button" onClick={onClose} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Done</button>}
      </div>
    </div>
  );
};
