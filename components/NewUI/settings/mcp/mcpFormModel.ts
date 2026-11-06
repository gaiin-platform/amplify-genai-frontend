/**
 * mcpFormModel — the rules behind Settings → MCP Servers → "Add MCP server". No React imports.
 *
 * What gets SAVED is unchanged from the legacy form: `{ name, url, transport, headers }` where
 * `headers` is `{ Authorization: <trimmed value> }` or `{}`. No `trustMode` is sent, so the backend
 * stores every new server as `untrusted` / `user_added` (client-side only).
 *
 * Preset rules — the form holds only its field values; "which preset is selected" is DERIVED:
 *  - A preset is selected exactly while name, URL and transport all equal the preset's values.
 *    Edit one and it is no longer selected; change it back and it is again.
 *  - Clicking a preset replaces name, URL and transport. If that would throw away something the user
 *    typed, the form asks first (`presetOverwrite`).
 *  - The Authorization header is never part of a preset: a preset neither sets nor clears it, and it
 *    does not count toward a match.
 *
 * Location: components/NewUI/settings/mcp/mcpFormModel.ts
 */

import { MCPTransport, validateMCPServerUrlWithReason } from '@/types/mcp';
import type { McpPreset } from './mcpPresets';

export const DEFAULT_TRANSPORT: MCPTransport = 'http';

export interface McpFormValues {
  name: string;
  url: string;
  transport: MCPTransport;
  authHeader: string;
}

export const emptyFormValues = (): McpFormValues => ({
  name: '',
  url: '',
  transport: DEFAULT_TRANSPORT,
  authHeader: '',
});

export function editField<K extends keyof McpFormValues>(
  values: McpFormValues,
  field: K,
  value: McpFormValues[K],
): McpFormValues {
  return { ...values, [field]: value };
}

// ── Presets ──────────────────────────────────────────────────────────────────

/** Every field a preset sets. Anything not listed here (the auth header) is ignored when matching. */
const PRESET_FIELDS = ['name', 'url', 'transport'] as const;
type PresetField = (typeof PRESET_FIELDS)[number];

const FIELD_LABEL: Record<PresetField, string> = {
  name: 'server name',
  url: 'server URL',
  transport: 'transport',
};

/** Exact match on every field the preset sets. */
export const matchesPreset = (values: McpFormValues, preset: McpPreset): boolean =>
  PRESET_FIELDS.every((f) => values[f] === preset[f]);

/** The preset the form currently equals, or `null`. Derived — never stored. */
export const selectedPresetId = (values: McpFormValues, presets: readonly McpPreset[]): string | null =>
  presets.find((p) => matchesPreset(values, p))?.id ?? null;

/** Click on a preset: its values replace name, URL and transport; the auth header is left alone. */
export const applyPreset = (values: McpFormValues, preset: McpPreset): McpFormValues => ({
  ...values,
  name: preset.name,
  url: preset.url,
  transport: preset.transport,
});

/** Did the user type something here? Transport always has a value, so only a non-default one counts. */
const isTyped = (values: McpFormValues, field: PresetField): boolean =>
  field === 'transport' ? values.transport !== DEFAULT_TRANSPORT : values[field].trim() !== '';

/**
 * Would applying `preset` discard something the user entered?
 *  - `labels`: the typed fields the preset would change (empty ⇒ nothing is lost).
 *  - `needsConfirm`: true when there are such fields — unless the form is exactly some other preset
 *    (then it was filled by a click, not typed, so switching presets is just switching).
 */
export function presetOverwrite(
  values: McpFormValues,
  preset: McpPreset,
  presets: readonly McpPreset[],
): { needsConfirm: boolean; labels: string[] } {
  const labels = PRESET_FIELDS.filter((f) => isTyped(values, f) && values[f] !== preset[f]).map((f) => FIELD_LABEL[f]);
  const needsConfirm = labels.length > 0 && selectedPresetId(values, presets) === null;
  return { needsConfirm, labels };
}

/** "server name", "server name and server URL", "server name, server URL and transport". */
export const joinLabels = (labels: string[]): string =>
  labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

/** Has the user entered (or been filled) anything that Cancel would lose? */
export function isFormDirty(values: McpFormValues): boolean {
  return (
    values.name.trim() !== '' ||
    values.url.trim() !== '' ||
    values.authHeader.trim() !== '' ||
    values.transport !== DEFAULT_TRANSPORT
  );
}

// ── URL ──────────────────────────────────────────────────────────────────────

export type UrlAssessment =
  | { state: 'empty'; insecure: false }
  | { state: 'invalid'; message: string; insecure: false }
  | { state: 'valid'; insecure: boolean };

/** `localhost`, `*.localhost`, 127.x and ::1 — plain http is expected there. */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h.endsWith('.localhost') || h.startsWith('127.') || h === '::1';
}

/** Plain-language versions of the validator's messages (`utils/app/urlValidation`). */
export function friendlyUrlError(error: string | undefined): string {
  const e = error ?? '';
  if (e === 'URL is required') return 'Enter the server URL.';
  if (e === 'Invalid URL format') return 'Enter a full URL, including https://, for example https://example.com/mcp.';
  if (e.startsWith('Only http')) return 'The URL must start with https:// (or http://).';
  if (e.startsWith('URLs with embedded credentials')) {
    return 'Remove the username and password from the URL and use the Authorization header instead.';
  }
  if (e.startsWith('Access to')) {
    return "Local and private network addresses (such as localhost) aren't allowed for MCP servers.";
  }
  return e || 'This URL can’t be used for an MCP server.';
}

/**
 * Format + safety check of the URL. Uses the SAME validator the save path uses
 * (`validateMCPServerUrlWithReason`), so "valid" here means the save won't reject it.
 */
export function assessServerUrl(raw: string): UrlAssessment {
  if (raw.trim() === '') return { state: 'empty', insecure: false };
  const check = validateMCPServerUrlWithReason(raw);
  if (!check.valid) return { state: 'invalid', message: friendlyUrlError(check.error), insecure: false };
  let insecure = false;
  try {
    const parsed = new URL(raw);
    insecure = parsed.protocol === 'http:' && !isLoopbackHost(parsed.hostname);
  } catch {
    // The validator already parsed it; nothing to flag.
  }
  return { state: 'valid', insecure };
}

export const canTestConnection = (values: McpFormValues): boolean =>
  assessServerUrl(values.url).state === 'valid';

/** "Add server" is enabled only for a non-blank name and a valid URL. */
export const canSubmit = (values: McpFormValues): boolean =>
  values.name.trim() !== '' && canTestConnection(values);

// ── Save payload ─────────────────────────────────────────────────────────────

/** Exactly what the legacy form passed to `addMCPServer`. */
export function buildSavePayload(values: McpFormValues): {
  name: string;
  url: string;
  transport: MCPTransport;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  if (values.authHeader.trim()) headers['Authorization'] = values.authHeader.trim();
  return { name: values.name, url: values.url, transport: values.transport, headers };
}

// ── Test-result identity & secrecy ───────────────────────────────────────────

/** A test result is only valid for the url + transport + auth header it was run with. */
export const testSignature = (values: McpFormValues): string =>
  JSON.stringify([values.url, values.transport, values.authHeader]);

/**
 * Remove the auth header (and its token part) from text that will be shown to the user.
 * A server's error body can echo what it was sent; the secret must never reach the screen.
 */
export function redactSecret(text: string, secret: string): string {
  const full = secret.trim();
  if (!full) return text;
  const parts = [full];
  const space = full.indexOf(' ');
  if (space > 0 && full.length - space - 1 >= 4) parts.push(full.slice(space + 1).trim());
  // Longest first, so the whole header goes before its token.
  return parts
    .sort((a, b) => b.length - a.length)
    .reduce((out, s) => (s ? out.split(s).join('[redacted]') : out), text);
}
