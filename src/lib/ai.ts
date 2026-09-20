import { stableStringify, type WeekChangeRequest } from './domain';

export class AiAdapterError extends Error {
  readonly code: 'BAD_URL' | 'HTTPS_REQUIRED' | 'API_ROOT_REQUIRED' | 'TIMEOUT' | 'CANCELLED' | 'HTTP_ERROR' | 'INVALID_JSON' | 'REFUSED' | 'TRUNCATED' | 'SCHEMA' | 'CONTEXT_NOT_AUTHORIZED';
  readonly status?: number;
  constructor(code: AiAdapterError['code'], message: string = code, status?: number) {
    super(message);
    this.name = 'AiAdapterError';
    this.code = code;
    this.status = status;
  }
}

export interface ProviderConfig {
  name: string;
  apiRoot: string;
  modelId: string;
  allowLocalHttp?: boolean;
  capabilities?: { stream?: boolean; jsonSchema?: boolean };
}

export interface ContextItem {
  id: string;
  category: 'strategy' | 'plan' | 'fact' | 'memory' | 'finance' | 'family';
  text: string;
  confirmed: boolean;
}

export interface ContextAuthorization {
  destination: string;
  includeSensitive: boolean;
  approvedAt: string;
}

const isLoopback = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

export function normalizeEndpoint(apiRoot: string, allowLocalHttp = false): string {
  let url: URL;
  try { url = new URL(apiRoot); } catch { throw new AiAdapterError('BAD_URL', 'API Root 不是有效 URL'); }
  if (url.username || url.password || url.search || url.hash) throw new AiAdapterError('BAD_URL', 'API Root 不得包含凭据、查询参数或片段');
  if (url.protocol !== 'https:' && !(allowLocalHttp && isLoopback(url.hostname) && url.protocol === 'http:')) throw new AiAdapterError('HTTPS_REQUIRED', '远端 Provider 必须使用 HTTPS');
  if (/\/(chat\/completions|responses)\/?$/.test(url.pathname)) throw new AiAdapterError('API_ROOT_REQUIRED', '请填写 API Root，不要填写完整接口路径');
  url.pathname = url.pathname.replace(/\/+$/, '') + '/chat/completions';
  return url.toString();
}

export function buildContextPreview(items: ContextItem[], authorization?: ContextAuthorization): { ids: string[]; categories: string[]; excluded: string[] } {
  const includeSensitive = Boolean(authorization?.includeSensitive && authorization.destination);
  return {
    ids: items.filter((item) => item.confirmed && (includeSensitive || !['finance', 'family'].includes(item.category))).map((item) => item.id),
    categories: [...new Set(items.filter((item) => item.confirmed && (includeSensitive || !['finance', 'family'].includes(item.category))).map((item) => item.category))],
    excluded: items.filter((item) => !item.confirmed || (!includeSensitive && ['finance', 'family'].includes(item.category))).map((item) => item.id)
  };
}

function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new AiAdapterError('SCHEMA', '候选命令结构不符合本地契约');
}

export function validateWeekChangeCandidate(value: unknown): WeekChangeRequest {
  exact(value, ['schemaVersion', 'requestId', 'baseVersion', 'planId', 'reason', 'actions']);
  const candidate = value as unknown as WeekChangeRequest;
  if (candidate.schemaVersion !== 1 || typeof candidate.requestId !== 'string' || typeof candidate.planId !== 'string' || typeof candidate.reason !== 'string' || !Number.isSafeInteger(candidate.baseVersion) || !Array.isArray(candidate.actions) || candidate.actions.length < 1 || candidate.actions.length > 20) throw new AiAdapterError('SCHEMA');
  candidate.actions.forEach((action) => {
    exact(action, ['type', 'taskId', 'date', 'rank']);
    if (!['schedule_task', 'unschedule_task'].includes(action.type) || typeof action.taskId !== 'string' || !Number.isSafeInteger(action.rank) || action.rank < 0 || action.rank > 1000 || (action.date !== null && (typeof action.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(action.date)))) throw new AiAdapterError('SCHEMA');
  });
  return candidate;
}

function parseBody(response: Response): Promise<unknown> {
  return response.json().catch(() => { throw new AiAdapterError('INVALID_JSON', 'Provider 返回了非法 JSON'); });
}

async function readStream(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) throw new AiAdapterError('TRUNCATED', 'Provider 未返回可读取的流');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let done = false;
  while (!done) {
    if (signal.aborted) throw new AiAdapterError('CANCELLED', '请求已取消');
    const chunk = await reader.read();
    done = chunk.done;
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let parsed: unknown;
      try { parsed = JSON.parse(data); } catch { throw new AiAdapterError('INVALID_JSON', '流式响应包含非法 JSON'); }
      const item = parsed as { choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null; message?: { refusal?: string } }> };
      const choice = item.choices?.[0];
      if (choice?.message?.refusal) throw new AiAdapterError('REFUSED', choice.message.refusal);
      text += choice?.delta?.content ?? '';
      if (choice?.finish_reason === 'length') throw new AiAdapterError('TRUNCATED', 'Provider 在输出完成前截断了响应');
    }
  }
  if (!text.trim()) throw new AiAdapterError('TRUNCATED', 'Provider 没有返回完整内容');
  return text;
}

export interface CompletionRequest {
  system: string;
  user: string;
  stream?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  contextAuthorization?: ContextAuthorization;
  context?: ContextItem[];
}

export async function requestCompletion(config: ProviderConfig, credential: string, request: CompletionRequest, fetcher: typeof fetch = fetch): Promise<{ text: string; endpoint: string; attempts: number }> {
  if (!credential || credential.length < 3) throw new AiAdapterError('HTTP_ERROR', '未提供 Provider Key');
  const endpoint = normalizeEndpoint(config.apiRoot, config.allowLocalHttp ?? false);
  if (request.context) {
    if (request.context.some((item) => item.confirmed && ['finance', 'family'].includes(item.category)) && !request.contextAuthorization?.includeSensitive) throw new AiAdapterError('CONTEXT_NOT_AUTHORIZED', '敏感上下文尚未获得本次目的地授权');
  }
  const timeoutMs = Math.max(1000, Math.min(request.timeoutMs ?? 30_000, 120_000));
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal?.addEventListener('abort', abort, { once: true });
  let attempts = 0;
  try {
    while (attempts < 3) {
      attempts += 1;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` }, body: JSON.stringify({ model: config.modelId, messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }], stream: Boolean(request.stream && config.capabilities?.stream) }), signal: controller.signal });
        clearTimeout(timer);
        if (response.status === 401) throw new AiAdapterError('HTTP_ERROR', 'Provider 身份验证失败', 401);
        if (response.status === 429 || response.status >= 500) {
          if (attempts < 3) continue;
          throw new AiAdapterError('HTTP_ERROR', `Provider 暂时不可用（${response.status}）`, response.status);
        }
        if (!response.ok) throw new AiAdapterError('HTTP_ERROR', `Provider 返回 ${response.status}`, response.status);
        if (request.stream && config.capabilities?.stream) return { text: await readStream(response, controller.signal), endpoint, attempts };
        const body = await parseBody(response) as { choices?: Array<{ message?: { content?: string; refusal?: string }; finish_reason?: string }> };
        const choice = body.choices?.[0];
        if (choice?.message?.refusal) throw new AiAdapterError('REFUSED', choice.message.refusal);
        if (choice?.finish_reason === 'length') throw new AiAdapterError('TRUNCATED');
        if (!choice?.message?.content) throw new AiAdapterError('INVALID_JSON', 'Provider 响应缺少 choices[0].message.content');
        return { text: choice.message.content, endpoint, attempts };
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof AiAdapterError) {
          if (error.code === 'HTTP_ERROR' && error.status && error.status !== 401 && (error.status === 429 || error.status >= 500) && attempts < 3) continue;
          throw error;
        }
        if (controller.signal.aborted) {
          if (request.signal?.aborted) throw new AiAdapterError('CANCELLED');
          throw new AiAdapterError('TIMEOUT');
        }
        if (attempts >= 3) throw new AiAdapterError('HTTP_ERROR', 'Provider 网络请求失败');
      }
    }
    throw new AiAdapterError('HTTP_ERROR');
  } finally {
    request.signal?.removeEventListener('abort', abort);
  }
}

export function safeRequestLog(input: { endpoint: string; durationMs: number; status: string; contextIds?: string[] }): string {
  return stableStringify({ endpoint: input.endpoint, durationMs: Math.max(0, Math.round(input.durationMs)), status: input.status, contextIds: input.contextIds ?? [] });
}
