import { describe, expect, it, vi } from 'vitest';
import { lookupAssistant } from '@/services/assistantService';

const mocks = vi.hoisted(() => ({ doRequestOp: vi.fn() }));
vi.mock('@/services/doRequestOp', () => ({ doRequestOp: mocks.doRequestOp }));

const respond = (statusCode: number, body: Record<string, unknown>) =>
  mocks.doRequestOp.mockResolvedValueOnce({ statusCode, body: JSON.stringify(body) });

describe('lookupAssistant', () => {
  it('finds a registered path', async () => {
    respond(200, { success: true, data: { assistantId: 'ast/1', astPath: 'bot', public: true } });
    expect(await lookupAssistant('Bot')).toMatchObject({ success: true, assistantId: 'ast/1' });
    expect(mocks.doRequestOp.mock.calls.at(-1)?.[0].data).toEqual({ astPath: 'bot' });
  });

  it('a path nobody holds is free', async () => {
    respond(404, { success: false, message: 'No assistant found for path: bot' });
    expect(await lookupAssistant('bot')).toMatchObject({ success: false, inUse: false });
  });

  it('a released path is free', async () => {
    respond(404, { success: false, message: 'Path is no longer associated with an assistant' });
    expect((await lookupAssistant('bot')) as any).toMatchObject({ inUse: false });
  });

  it('a path held by an assistant this user may not open is taken, not free', async () => {
    respond(403, { success: false, message: 'User is not authorized to access this assistant' });
    expect(await lookupAssistant('bot')).toMatchObject({ success: false, inUse: true });
    respond(403, { success: false, message: 'User is not authorized to access the group associated with this assistant' });
    expect(await lookupAssistant('team-bot')).toMatchObject({ success: false, inUse: true });
  });
});
