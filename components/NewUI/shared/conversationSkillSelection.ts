import type { SkillSelectionMode } from '@/types/skill';

export const CONVERSATION_SKILL_IDS_KEY = 'nuiSkillIds';
export const CONVERSATION_SKILL_MODE_KEY = 'nuiSkillSelectionMode';
export const MAX_CONVERSATION_SKILLS = 3;

export interface ConversationSkillSelection {
  skillIds: string[];
  mode: SkillSelectionMode;
}

const normalizeSkillIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))).slice(0, MAX_CONVERSATION_SKILLS);
};

export const getConversationSkillSelection = (conversation: any): ConversationSkillSelection => {
  const skillIds = normalizeSkillIds(conversation?.data?.[CONVERSATION_SKILL_IDS_KEY]);
  const rawMode = conversation?.data?.[CONVERSATION_SKILL_MODE_KEY];
  const mode: SkillSelectionMode = rawMode === 'auto' || rawMode === 'hybrid' ? rawMode : 'manual';
  return { skillIds, mode };
};

export const withConversationSkillSelection = <T extends { data?: any }>(
  conversation: T,
  skillIds: string[],
  mode: SkillSelectionMode = 'manual',
): T => ({
  ...conversation,
  data: {
    ...(conversation.data ?? {}),
    [CONVERSATION_SKILL_IDS_KEY]: normalizeSkillIds(skillIds),
    [CONVERSATION_SKILL_MODE_KEY]: mode,
  },
});

export const skillSelectionOptions = (selection: ConversationSkillSelection) =>
  selection.skillIds.length > 0
    ? { skills: selection.skillIds, skillSelectionMode: selection.mode }
    : undefined;
