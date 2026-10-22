import { CodeBlockDetails, extractCodeBlocksAndText } from '@/utils/app/codeblock';

/**
 * Split an artifact version into the numbered parts (`A0`, `A1`, …) that a new version can reference as `~A0`
 * instead of repeating them. Prose is kept as-is; each code block is re-fenced with its language.
 */
export function buildArtifactContentMap(content: string): Record<string, string> {
  const parts = extractCodeBlocksAndText(content).map((detail: CodeBlockDetails) =>
    detail.extension === '.txt' ? detail.code : `\`\`\`${detail.language} \n${detail.code} \n\`\`\` `,
  );
  const map: Record<string, string> = {};
  parts.forEach((part: string, index: number) => {
    map[`A${index}`] = part;
  });
  return map;
}

/**
 * The version the one being written builds on, and so the one whose parts `~A#` refers to.
 * A fresh run builds on the latest version. Resuming a cut-off run has already added its own partial
 * version as the latest, so it builds on the one before that.
 */
export function pickBaseVersion<T>(versions: T[], resuming: boolean): T | undefined {
  return versions[versions.length - (resuming ? 2 : 1)];
}
