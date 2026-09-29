import { afterEach, describe, expect, it, vi } from 'vitest';

const doRequestOp = vi.fn();

vi.mock('@/services/doRequestOp', () => ({
  doRequestOp: (...args: any[]) => doRequestOp(...args),
}));

afterEach(() => {
  doRequestOp.mockReset();
});

describe('presentationApi', () => {
  it('starts a job without sending empty optional fields', async () => {
    doRequestOp.mockResolvedValue({ success: true, data: { jobId: 'job-1' } });
    const { startPresentation } = await import('@/components/NewUI/shared/presentationApi');

    const result = await startPresentation({
      templateName: 'celestial.pptx',
      content: '# Notes',
      title: '',
      instructions: undefined,
      conversationId: 'conv-1',
    });

    expect(result.data?.jobId).toBe('job-1');
    expect(doRequestOp).toHaveBeenCalledWith({
      method: 'POST',
      path: '/presentation',
      op: '/start',
      data: { templateName: 'celestial.pptx', content: '# Notes', conversationId: 'conv-1' },
      service: 'presentation',
    });
  });

  it('polls status with the job id as a query parameter', async () => {
    doRequestOp.mockResolvedValue({ success: true, data: { jobId: 'job-1', status: 'running', stage: 'planning', progress: 12 } });
    const { getPresentationStatus } = await import('@/components/NewUI/shared/presentationApi');

    const result = await getPresentationStatus('job-1');

    expect(result.data?.stage).toBe('planning');
    expect(doRequestOp).toHaveBeenCalledWith(
      { method: 'GET', path: '/presentation', op: '/status', queryParams: { jobId: 'job-1' }, service: 'presentation' },
      null,
    );
  });

  it('requests template analysis', async () => {
    doRequestOp.mockResolvedValue({ success: true, data: { jobId: 'template-analysis:a.pptx' } });
    const { analyzePresentationTemplate } = await import('@/components/NewUI/shared/presentationApi');
    await analyzePresentationTemplate('a.pptx');
    expect(doRequestOp).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', op: '/template/analyze', data: { templateName: 'a.pptx' } }),
    );
  });
});
