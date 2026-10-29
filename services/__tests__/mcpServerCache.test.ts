import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ doRequestOp: vi.fn() }));
vi.mock('@/services/doRequestOp', () => ({ doRequestOp: mocks.doRequestOp }));

import {
  deleteMCPServer,
  invalidateMCPServerCache,
  listMCPServers,
  listMCPServersCached,
  toggleMCPServer,
} from '@/services/mcpService';

const servers = (...ids: string[]) => ({ success: true, data: ids.map((id) => ({ id, name: id, enabled: true, tools: [] })) });
const isList = (call: any[]) => call[0].op === '/mcp/servers' && call[0].method === 'GET';
const listCalls = () => mocks.doRequestOp.mock.calls.filter(isList).length;

describe('MCP server list cache', () => {
  beforeEach(() => {
    invalidateMCPServerCache();
    mocks.doRequestOp.mockReset();
  });

  it('reads the backend once for repeated cached reads', async () => {
    mocks.doRequestOp.mockResolvedValue(servers('a'));

    await listMCPServersCached();
    await listMCPServersCached();
    await listMCPServersCached();

    expect(listCalls()).toBe(1);
  });

  it('shares one request between concurrent cached reads', async () => {
    mocks.doRequestOp.mockResolvedValue(servers('a'));

    await Promise.all([listMCPServersCached(), listMCPServersCached()]);

    expect(listCalls()).toBe(1);
  });

  it('listMCPServers always reads the backend', async () => {
    mocks.doRequestOp.mockResolvedValue(servers('a'));

    await listMCPServers();
    await listMCPServers();

    expect(listCalls()).toBe(2);
  });

  it('a management read refreshes what the cached reader returns', async () => {
    mocks.doRequestOp.mockResolvedValueOnce(servers('a'));
    await listMCPServersCached();

    mocks.doRequestOp.mockResolvedValueOnce(servers('a', 'b'));
    await listMCPServers();

    const cached = await listMCPServersCached();
    expect(cached.map((s) => s.id)).toEqual(['a', 'b']);
    expect(listCalls()).toBe(2);
  });

  it('does not cache a failed read', async () => {
    mocks.doRequestOp.mockResolvedValueOnce({ success: false });
    expect(await listMCPServersCached()).toEqual([]);

    mocks.doRequestOp.mockResolvedValueOnce(servers('a'));
    expect((await listMCPServersCached()).map((s) => s.id)).toEqual(['a']);
  });

  it.each([
    ['toggle', () => toggleMCPServer('a', false)],
    ['delete', () => deleteMCPServer('a')],
  ])('a %s drops the cached list', async (_name, mutate) => {
    mocks.doRequestOp.mockResolvedValue(servers('a'));
    await listMCPServersCached();
    expect(listCalls()).toBe(1);

    await mutate();
    await listMCPServersCached();

    expect(listCalls()).toBe(2);
  });
});
