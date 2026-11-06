export const MAX_SYSTEM_PROMPT_BYTES = 16 * 1024;

const encoder = new TextEncoder();

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

export interface OversizedSystemPrompt {
  key: string;
  bytes: number;
}

export function findOversizedSystemPrompts(
  prompts: Record<string, { text: string } | undefined>,
): OversizedSystemPrompt[] {
  return Object.entries(prompts).flatMap(([key, record]) => {
    if (typeof record?.text !== 'string') return [];
    const bytes = utf8ByteLength(record.text);
    return bytes > MAX_SYSTEM_PROMPT_BYTES ? [{ key, bytes }] : [];
  });
}
