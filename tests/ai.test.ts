import { describe, expect, it } from 'vitest';
import { AiAdapterError, buildContextPreview, normalizeEndpoint, requestCompletion, validateWeekChangeCandidate } from '../src/lib/ai';

describe('compatible provider boundary', () => {
  it('keeps /v1 and custom roots without duplicating the endpoint', () => {
    expect(normalizeEndpoint('https://example.com/v1/')).toBe('https://example.com/v1/chat/completions');
    expect(normalizeEndpoint('https://example.com/team/api/')).toBe('https://example.com/team/api/chat/completions');
    expect(() => normalizeEndpoint('http://example.com/v1', true)).toThrowError(AiAdapterError);
    expect(normalizeEndpoint('http://127.0.0.1:11434/v1', true)).toBe('http://127.0.0.1:11434/v1/chat/completions');
    expect(() => normalizeEndpoint('https://user:secret@example.com/v1')).toThrowError(/API Root/);
  });

  it('filters sensitive context until a destination authorization exists', () => {
    const items = [
      { id: 'goal-1', category: 'strategy' as const, text: '主线', confirmed: true },
      { id: 'finance-1', category: 'finance' as const, text: '金额', confirmed: true },
      { id: 'candidate-1', category: 'memory' as const, text: '候选', confirmed: false }
    ];
    expect(buildContextPreview(items).ids).toEqual(['goal-1']);
    expect(buildContextPreview(items).excluded).toEqual(['finance-1', 'candidate-1']);
    expect(buildContextPreview(items, { destination: 'provider-a', includeSensitive: true, approvedAt: 'now' }).ids).toEqual(['goal-1', 'finance-1']);
  });

  it('rejects extra authority fields in model output', () => {
    expect(() => validateWeekChangeCandidate({ schemaVersion: 1, requestId: 'r', baseVersion: 1, planId: 'p', reason: 'r', approved: true, actions: [] })).toThrowError(expect.objectContaining({ code: 'SCHEMA' }));
  });

  it('retries bounded server errors and sends the key only in the request header', async () => {
    let calls = 0;
    const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      if (calls < 3) return new Response('{}', { status: 503 });
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
      return new Response(JSON.stringify({ choices: [{ message: { content: '候选内容' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const response = await requestCompletion({ name: 'mock', apiRoot: 'https://example.com/v1', modelId: 'custom-model' }, 'secret-key', { system: 'system', user: 'user' }, fetcher);
    expect(response.text).toBe('候选内容');
    expect(response.attempts).toBe(3);
    expect(calls).toBe(3);
  });

  it('does not retry 401 and does not write on refusal', async () => {
    let calls = 0;
    const fetcher = async () => { calls += 1; return new Response('{}', { status: 401 }); };
    await expect(requestCompletion({ name: 'mock', apiRoot: 'https://example.com/v1', modelId: 'model' }, 'key', { system: 's', user: 'u' }, fetcher)).rejects.toMatchObject({ status: 401 });
    expect(calls).toBe(1);
  });
});
