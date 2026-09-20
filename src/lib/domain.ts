/*
 * Northstar's local domain boundary.
 *
 * The UI only sends typed commands here. This module owns validation,
 * idempotency, capacity, protected facts, audit entries and growth rules so
 * a model or a future renderer cannot bypass the product contract.
 */

export type Theme = 'dark' | 'light';
export type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'partial' | 'blocked' | 'not_worth_it';
export type RecordResult = 'completed' | 'partial' | 'blocked' | 'not_worth_it';
export type IdeaStatus = 'cooling' | 'extended' | 'promoted' | 'abandoned';
export type MemoryKind = 'statement' | 'observation' | 'inference';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'stale';

export type DomainCode =
  | 'SHAPE' | 'ID_REUSED' | 'NOT_AUTHORIZED' | 'STALE' | 'MULTIPLE_PRIMARY'
  | 'CAPACITY' | 'CAPACITY_CONFLICT' | 'OPERATION' | 'DUPLICATE_TARGET'
  | 'UNKNOWN_TASK' | 'PROTECTED' | 'HARD_DUE' | 'OUT_OF_WEEK' | 'RANK_COLLISION'
  | 'DEPENDENCY' | 'UNDO_CONFLICT' | 'UNDO_CAPACITY_CONFLICT' | 'NOT_UNDOABLE'
  | 'UNKNOWN_RECORD' | 'UNKNOWN_PROPOSAL' | 'PROPOSAL_STALE' | 'IMPORT_REJECTED';

export class DomainError extends Error {
  readonly code: DomainCode;
  readonly details?: Record<string, unknown>;
  constructor(code: DomainCode, message: string = code, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  minutes: number;
  scheduledDate: string | null;
  rank: number;
  status: TaskStatus;
  pinned: boolean;
  hardDue: string | null;
  dependsOn: string[];
  goalId: string;
  planId: string;
  kind: 'growth' | 'maintenance' | 'responsibility';
}

export interface WeeklyPlan {
  id: string;
  start: string;
  end: string;
  timezone: string;
  outcome: string;
  focusId: string;
  capacityMinutes: number;
  version: number;
  autoAdjust: boolean;
}

export interface ExecutionRecord {
  id: string;
  taskId: string;
  result: RecordResult;
  actualMinutes: number | null;
  note: string;
  recordedAt: string;
}

export interface Idea {
  id: string;
  content: string;
  createdAt: string;
  coolUntil: string;
  status: IdeaStatus;
  alternativeId: string | null;
  promotionReason: string | null;
}

export interface Memory {
  id: string;
  content: string;
  kind: MemoryKind;
  sourceIds: string[];
  status: 'candidate' | 'confirmed' | 'deleted';
  createdAt: string;
}

export interface Proposal {
  id: string;
  summary: string;
  reason: string;
  evidenceIds: string[];
  baseVersion: number;
  changes: Array<{ type: 'change_weekly_outcome' | 'replace_primary_focus'; targetId: string; before: string; after: string }>;
  status: ProposalStatus;
  createdAt: string;
}

export interface GrowthEvent {
  key: string;
  type: 'weekly_outcome' | 'milestone' | 'review' | 'deliberate_tradeoff';
  sourceId: string;
  period: string;
  award: number;
  revoked: boolean;
  confirmed: boolean;
}

export interface AppSettings {
  theme: Theme;
  reducedMotion: boolean;
  autoAdjust: boolean;
  privacySensitiveContext: boolean;
  providerConfigured: boolean;
}

export interface AppState {
  schemaVersion: 1;
  today: string;
  primaryProjects: string[];
  profile: { displayName: string | null; timezone: string; confirmed: boolean };
  plan: WeeklyPlan;
  tasks: Task[];
  records: ExecutionRecord[];
  ideas: Idea[];
  memories: Memory[];
  proposals: Proposal[];
  growth: { events: GrowthEvent[]; seen: string[]; highestStage: number };
  settings: AppSettings;
  version: number;
}

export interface AuditEntry {
  id: string;
  actor: 'user' | 'model' | 'system';
  reason: string;
  before: AppState;
  after: AppState;
  undoOf?: string;
  createdAt: string;
}

export interface Receipt {
  hash: string;
  result: Record<string, unknown>;
}

export interface Snapshot {
  state: AppState;
  audit: AuditEntry[];
  receipts: Record<string, Receipt>;
}

export interface WeekChangeAction {
  type: 'schedule_task' | 'unschedule_task';
  taskId: string;
  date: string | null;
  rank: number;
}

export interface WeekChangeRequest {
  schemaVersion: 1;
  requestId: string;
  baseVersion: number;
  planId: string;
  reason: string;
  actions: WeekChangeAction[];
}

const STORAGE_KEY = 'northstar.local.snapshot.v1';
const RULES = {
  ruleVersion: 1,
  stageThresholds: [0, 100, 300, 700, 1500, 3000, 6000],
  weeklyCap: 60,
  awards: { weekly_outcome: 20, milestone: 30, review: 10, deliberate_tradeoff: 10 },
  limits: { weekly_outcome: 1, milestone: 2, review: 1, deliberate_tradeoff: 1 }
} as const;

const nowIso = () => new Date().toISOString();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalHash(value: unknown): string {
  let hash = 2166136261;
  for (const char of stableStringify(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function isoDate(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function mondayOf(dateIso: string): string {
  const date = new Date(`${dateIso}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return isoDate(date);
}

export function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function weekKey(dateIso: string): string {
  const monday = mondayOf(dateIso);
  const date = new Date(`${monday}T12:00:00`);
  const first = new Date(`${date.getFullYear()}-01-04T12:00:00`);
  const firstMonday = mondayOf(isoDate(first));
  const weeks = Math.round((date.getTime() - new Date(`${firstMonday}T12:00:00`).getTime()) / 604_800_000) + 1;
  return `${date.getFullYear()}-W${String(weeks).padStart(2, '0')}`;
}

function exactKeys(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('SHAPE');
  const actual = Object.keys(value as object);
  if (actual.length !== keys.length || keys.some((key) => !has(value as object, key))) throw new DomainError('SHAPE');
}

function text(value: unknown, max = 1000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && isoDate(new Date(`${value}T12:00:00`)) === value;
}

function totalScheduled(state: AppState): number {
  return state.tasks.filter((task) => task.scheduledDate && task.status !== 'completed').reduce((sum, task) => sum + task.minutes, 0);
}

function highestStage(xp: number): number {
  return RULES.stageThresholds.filter((threshold) => xp >= threshold).length;
}

function freshDemoState(today = isoDate()): AppState {
  const start = mondayOf(today);
  const end = addDays(start, 6);
  const planId = 'plan-current-cycle';
  const goalId = 'goal-capability';
  const tasks: Task[] = [
    { id: 'task-samples', title: '写好 3 个测试样例', detail: '输入 / 引用 / 导出', minutes: 30, scheduledDate: start, rank: 0, status: 'completed', pinned: false, hardDue: null, dependsOn: [], goalId, planId, kind: 'growth' },
    { id: 'task-verify', title: '验证核心流程', detail: '当前动作 · 完成后记录发现', minutes: 45, scheduledDate: start, rank: 1, status: 'planned', pinned: false, hardDue: null, dependsOn: ['task-samples'], goalId, planId, kind: 'growth' },
    { id: 'task-review', title: '整理一页验证记录', detail: '只保留事实、问题和下一步', minutes: 20, scheduledDate: addDays(start, 1), rank: 0, status: 'planned', pinned: false, hardDue: null, dependsOn: ['task-verify'], goalId, planId, kind: 'growth' },
    { id: 'task-responsibility', title: '处理本周固定责任', detail: '保留职责，不计作额外主线', minutes: 90, scheduledDate: addDays(start, 2), rank: 0, status: 'planned', pinned: true, hardDue: addDays(start, 3), dependsOn: [], goalId, planId, kind: 'responsibility' },
    { id: 'task-next', title: '确认下一步小实验', detail: '若证据不足，保持可逆', minutes: 60, scheduledDate: null, rank: 0, status: 'planned', pinned: false, hardDue: null, dependsOn: ['task-review'], goalId, planId, kind: 'growth' }
  ];
  return {
    schemaVersion: 1,
    today,
    primaryProjects: ['goal-capability'],
    profile: { displayName: null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai', confirmed: false },
    plan: { id: planId, start, end, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai', outcome: '跑通「输入 → 知识卡片 → 自测」的可用闭环', focusId: goalId, capacityMinutes: 600, version: 4, autoAdjust: true },
    tasks,
    records: [{ id: 'record-seed', taskId: 'task-samples', result: 'completed', actualMinutes: 35, note: '演示记录', recordedAt: nowIso() }],
    ideas: [{ id: 'idea-seed', content: '把验证结果整理成一张可复用卡片', createdAt: nowIso(), coolUntil: addDays(today, 14), status: 'cooling', alternativeId: null, promotionReason: null }],
    memories: [{ id: 'memory-seed', content: '先验证核心流程，再扩大范围。', kind: 'statement', sourceIds: ['record-seed'], status: 'candidate', createdAt: nowIso() }],
    proposals: [],
    growth: { events: [], seen: [], highestStage: 1 },
    settings: { theme: 'dark', reducedMotion: false, autoAdjust: true, privacySensitiveContext: false, providerConfigured: false },
    version: 4
  };
}

function defaultSnapshot(today = isoDate()): Snapshot {
  return { state: freshDemoState(today), audit: [], receipts: Object.create(null) as Record<string, Receipt> };
}

function loadSnapshot(): Snapshot {
  if (typeof window === 'undefined') return defaultSnapshot();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSnapshot();
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed || parsed.state?.schemaVersion !== 1 || !parsed.state.plan || !Array.isArray(parsed.state.tasks)) return defaultSnapshot();
    if (!Array.isArray(parsed.state.primaryProjects)) parsed.state.primaryProjects = ['goal-capability'];
    return parsed;
  } catch {
    return defaultSnapshot();
  }
}

export function completionMetric(records: Array<{ result?: string }>, minimumCoverage = 0.7): { coverage: number; rate: number | null } {
  if (!records.length) return { coverage: 0, rate: null };
  const eligible = records.filter((record) => record.result !== 'cancelled');
  if (!eligible.length) return { coverage: 0, rate: null };
  const known = eligible.filter((record) => ['completed', 'partial', 'blocked', 'not_worth_it'].includes(record.result ?? ''));
  const coverage = known.length / eligible.length;
  return { coverage, rate: coverage >= minimumCoverage ? known.filter((record) => record.result === 'completed').length / known.length : null };
}

export class NorthstarStore {
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();

  constructor(snapshot?: Snapshot) {
    this.snapshot = snapshot ? clone(snapshot) : loadSnapshot();
  }

  get state(): AppState { return clone(this.snapshot.state); }
  get audit(): AuditEntry[] { return clone(this.snapshot.audit); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private persist(): void {
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
      } catch {
        // Some embedded preview contexts expose no writable storage. The
        // domain state remains live for the session and is still exportable.
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  private commit(next: AppState, reason: string, actor: AuditEntry['actor'], before: AppState, id: string, undoOf?: string): void {
    this.snapshot.audit.push({ id, actor, reason, before: clone(before), after: clone(next), undoOf, createdAt: nowIso() });
    this.snapshot.state = clone(next);
    this.persist();
  }

  resetDemo(): void {
    this.snapshot = defaultSnapshot();
    this.persist();
  }

  applyWeekChange(request: WeekChangeRequest, actor: 'user' | 'model' | 'system' = 'system'): { version: number; scheduledMinutes: number; replayed: boolean } {
    exactKeys(request, ['schemaVersion', 'requestId', 'baseVersion', 'planId', 'reason', 'actions']);
    if (request.schemaVersion !== 1 || !text(request.requestId, 100) || !text(request.planId, 100) || !text(request.reason, 1000) || !Number.isSafeInteger(request.baseVersion) || request.baseVersion < 0) throw new DomainError('SHAPE');
    if (!Array.isArray(request.actions) || request.actions.length < 1 || request.actions.length > 20) throw new DomainError('SHAPE');
    const digest = canonicalHash(request);
    const receipt = has(this.snapshot.receipts, request.requestId) ? this.snapshot.receipts[request.requestId] : undefined;
    if (receipt) {
      if (receipt.hash !== digest) throw new DomainError('ID_REUSED');
      return { ...(receipt.result as { version: number; scheduledMinutes: number; replayed: boolean }), replayed: true };
    }
    const before = this.state;
    if (!before.plan.autoAdjust || !before.settings.autoAdjust) throw new DomainError('NOT_AUTHORIZED');
    if (before.primaryProjects.length > 1) throw new DomainError('MULTIPLE_PRIMARY');
    if (before.plan.id !== request.planId || before.plan.version !== request.baseVersion) throw new DomainError('STALE');
    if (!Number.isSafeInteger(before.plan.capacityMinutes) || before.plan.capacityMinutes < 0) throw new DomainError('CAPACITY');
    const next = clone(before);
    const seen = new Set<string>();
    for (const action of request.actions) {
      exactKeys(action, ['type', 'taskId', 'date', 'rank']);
      if (!['schedule_task', 'unschedule_task'].includes(action.type) || !text(action.taskId, 100) || !Number.isSafeInteger(action.rank) || action.rank < 0 || action.rank > 1000) throw new DomainError('SHAPE');
      if (seen.has(action.taskId)) throw new DomainError('DUPLICATE_TARGET');
      seen.add(action.taskId);
      const task = next.tasks.find((item) => item.id === action.taskId);
      if (!task) throw new DomainError('UNKNOWN_TASK');
      if (task.pinned || task.status === 'completed') throw new DomainError('PROTECTED');
      if (action.type === 'unschedule_task') {
        if (action.date !== null) throw new DomainError('SHAPE');
        if (task.hardDue) throw new DomainError('HARD_DUE');
        task.scheduledDate = null;
      } else {
        if (!validDate(action.date) || action.date < next.plan.start || action.date > next.plan.end) throw new DomainError('OUT_OF_WEEK');
        if (task.hardDue && action.date > task.hardDue) throw new DomainError('HARD_DUE');
        task.scheduledDate = action.date;
      }
      task.rank = action.rank;
    }
    const scheduled = next.tasks.filter((task) => task.scheduledDate && task.status !== 'completed');
    if (scheduled.reduce((sum, task) => sum + task.minutes, 0) > next.plan.capacityMinutes) throw new DomainError('CAPACITY');
    const slots = new Set<string>();
    for (const task of scheduled) {
      const slot = `${task.scheduledDate}:${task.rank}`;
      if (slots.has(slot)) throw new DomainError('RANK_COLLISION');
      slots.add(slot);
      for (const dependencyId of task.dependsOn) {
        const dependency = next.tasks.find((item) => item.id === dependencyId);
        if (!dependency) throw new DomainError('DEPENDENCY');
        if (dependency.status === 'completed') continue;
        if (!dependency.scheduledDate || dependency.scheduledDate > task.scheduledDate! || (dependency.scheduledDate === task.scheduledDate && dependency.rank >= task.rank)) throw new DomainError('DEPENDENCY');
      }
    }
    next.plan.version += 1;
    next.version = next.plan.version;
    const result = { version: next.plan.version, scheduledMinutes: totalScheduled(next), replayed: false };
    this.commit(next, request.reason, actor, before, request.requestId);
    this.snapshot.receipts[request.requestId] = { hash: digest, result: clone(result) };
    this.persist();
    return result;
  }

  undoLast(expectedVersion: number): number {
    const current = this.state;
    if (current.version !== expectedVersion) throw new DomainError('UNDO_CONFLICT');
    const last = this.snapshot.audit.at(-1);
    if (!last || last.undoOf) throw new DomainError('NOT_UNDOABLE');
    if (last.after.version !== current.version) throw new DomainError('UNDO_CONFLICT');
    const restored = clone(last.before);
    if (totalScheduled(restored) > current.plan.capacityMinutes) throw new DomainError('UNDO_CAPACITY_CONFLICT');
    restored.plan.capacityMinutes = current.plan.capacityMinutes;
    restored.plan.version = current.plan.version + 1;
    restored.version = current.version + 1;
    this.commit(restored, '撤销上一批计划变更', 'user', current, `undo:${last.id}`, last.id);
    return restored.plan.version;
  }

  setAutoAdjust(enabled: boolean): void {
    const before = this.state;
    const next = clone(before);
    next.plan.autoAdjust = enabled;
    next.settings.autoAdjust = enabled;
    next.version += 1;
    this.commit(next, enabled ? '用户开启自动调整' : '用户关闭自动调整', 'user', before, `settings:auto-adjust:${next.version}`);
  }

  setTheme(theme: Theme): void {
    const before = this.state;
    const next = clone(before);
    next.settings.theme = theme;
    next.version += 1;
    this.commit(next, theme === 'dark' ? '切换深色主题' : '切换浅色主题', 'user', before, `settings:theme:${next.version}`);
  }

  setReducedMotion(enabled: boolean): void {
    const before = this.state;
    const next = clone(before);
    next.settings.reducedMotion = enabled;
    next.version += 1;
    this.commit(next, enabled ? '启用减少动效' : '恢复常规动效', 'user', before, `settings:motion:${next.version}`);
  }

  setPrivacySensitiveContext(enabled: boolean): void {
    const before = this.state;
    const next = clone(before);
    next.settings.privacySensitiveContext = enabled;
    next.version += 1;
    this.commit(next, enabled ? '授权敏感上下文用于AI' : '关闭敏感上下文授权', 'user', before, `settings:privacy:${next.version}`);
  }

  setCapacity(minutes: number): { changed: boolean; unscheduled: string[]; conflict: string | null } {
    if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 24 * 60) throw new DomainError('CAPACITY');
    const before = this.state;
    const next = clone(before);
    const unscheduled: string[] = [];
    const candidates = next.tasks.filter((task) => task.scheduledDate && task.status !== 'completed' && !task.pinned && !task.hardDue).sort((a, b) => b.rank - a.rank);
    while (totalScheduled(next) > minutes) {
      const candidate = candidates.shift();
      if (!candidate) return { changed: false, unscheduled, conflict: '锁定事项或硬截止已占满当前容量' };
      candidate.scheduledDate = null;
      unscheduled.push(candidate.id);
    }
    if (totalScheduled(next) > minutes) return { changed: false, unscheduled, conflict: '容量不足以容纳锁定事项' };
    next.plan.capacityMinutes = minutes;
    next.plan.version += 1;
    next.version = next.plan.version;
    this.commit(next, `容量调整为 ${Math.floor(minutes / 60)}h`, 'user', before, `capacity:${next.plan.version}`);
    return { changed: true, unscheduled, conflict: null };
  }

  startTask(taskId: string): void {
    const before = this.state;
    const task = before.tasks.find((item) => item.id === taskId);
    if (!task) throw new DomainError('UNKNOWN_TASK');
    if (task.status === 'completed') throw new DomainError('PROTECTED');
    const next = clone(before);
    const target = next.tasks.find((item) => item.id === taskId)!;
    target.status = 'in_progress';
    next.version += 1;
    this.commit(next, `开始专注：${task.title}`, 'user', before, `start:${taskId}:${next.version}`);
  }

  recordTask(taskId: string, result: RecordResult, actualMinutes: number | null, note: string): ExecutionRecord {
    const before = this.state;
    const task = before.tasks.find((item) => item.id === taskId);
    if (!task) throw new DomainError('UNKNOWN_TASK');
    if (task.pinned && result !== 'completed' && task.hardDue && task.scheduledDate && task.scheduledDate < before.today) throw new DomainError('PROTECTED');
    if (actualMinutes !== null && (!Number.isSafeInteger(actualMinutes) || actualMinutes < 0 || actualMinutes > 24 * 60)) throw new DomainError('SHAPE');
    const next = clone(before);
    const target = next.tasks.find((item) => item.id === taskId)!;
    target.status = result === 'completed' ? 'completed' : result === 'partial' ? 'partial' : result === 'blocked' ? 'blocked' : 'not_worth_it';
    const record: ExecutionRecord = { id: `record:${taskId}:${next.records.length + 1}`, taskId, result, actualMinutes, note: note.trim().slice(0, 1000), recordedAt: nowIso() };
    next.records.push(record);
    next.version += 1;
    this.commit(next, `记录：${task.title}`, 'user', before, record.id);
    return record;
  }

  createReviewProposal(): Proposal {
    const state = this.state;
    const metric = completionMetric(state.records);
    const proposal: Proposal = {
      id: `proposal:${Date.now()}`,
      summary: metric.rate !== null && metric.rate < 0.6 ? '时间估计偏高，建议缩小范围再验证。' : '证据覆盖足够，建议保留当前主线。',
      reason: '依据：本周记录 / 成果验收 / 下周容量变化。',
      evidenceIds: state.records.map((record) => record.id),
      baseVersion: state.plan.version,
      changes: [{ type: 'change_weekly_outcome', targetId: state.plan.id, before: state.plan.outcome, after: '验证一个核心流程并记录可复用结论' }],
      status: 'pending',
      createdAt: nowIso()
    };
    const next = clone(state);
    next.proposals.push(proposal);
    next.version += 1;
    this.commit(next, '生成周复盘提案', 'system', state, proposal.id);
    return proposal;
  }

  approveProposal(proposalId: string): void {
    const before = this.state;
    const proposal = before.proposals.find((item) => item.id === proposalId);
    if (!proposal) throw new DomainError('UNKNOWN_PROPOSAL');
    if (proposal.status !== 'pending' || proposal.baseVersion !== before.plan.version) throw new DomainError('PROPOSAL_STALE');
    const next = clone(before);
    const target = next.proposals.find((item) => item.id === proposalId)!;
    target.status = 'approved';
    next.plan.outcome = proposal.changes[0].after;
    next.plan.version += 1;
    next.version = next.plan.version;
    this.commit(next, '用户批准复盘提案', 'user', before, `approve:${proposalId}`);
  }

  rejectProposal(proposalId: string): void {
    const before = this.state;
    const proposal = before.proposals.find((item) => item.id === proposalId);
    if (!proposal) throw new DomainError('UNKNOWN_PROPOSAL');
    const next = clone(before);
    next.proposals.find((item) => item.id === proposalId)!.status = 'rejected';
    next.version += 1;
    this.commit(next, '用户驳回复盘提案', 'user', before, `reject:${proposalId}`);
  }

  addIdea(content: string): Idea {
    if (!text(content, 500)) throw new DomainError('SHAPE');
    const before = this.state;
    const idea: Idea = { id: `idea:${Date.now()}`, content: content.trim(), createdAt: nowIso(), coolUntil: addDays(before.today, 14), status: 'cooling', alternativeId: null, promotionReason: null };
    const next = clone(before);
    next.ideas.push(idea);
    next.version += 1;
    this.commit(next, '记录灵感并进入冷却期', 'user', before, idea.id);
    return idea;
  }

  updateIdea(ideaId: string, status: IdeaStatus, reason = ''): void {
    const before = this.state;
    const idea = before.ideas.find((item) => item.id === ideaId);
    if (!idea) throw new DomainError('SHAPE');
    if (status === 'promoted' && idea.status === 'cooling' && before.today < idea.coolUntil) throw new DomainError('NOT_AUTHORIZED', '冷却期未结束，升级需要明确替代对象和理由');
    const next = clone(before);
    const target = next.ideas.find((item) => item.id === ideaId)!;
    target.status = status;
    target.promotionReason = reason.trim().slice(0, 500) || null;
    next.version += 1;
    this.commit(next, `灵感状态：${status}`, 'user', before, `idea:${ideaId}:${next.version}`);
  }

  confirmMemory(memoryId: string): void {
    const before = this.state;
    const memory = before.memories.find((item) => item.id === memoryId);
    if (!memory) throw new DomainError('SHAPE');
    const next = clone(before);
    next.memories.find((item) => item.id === memoryId)!.status = 'confirmed';
    next.version += 1;
    this.commit(next, '确认候选记忆', 'user', before, `memory:confirm:${memoryId}`);
  }

  deleteMemory(memoryId: string): void {
    const before = this.state;
    if (!before.memories.some((item) => item.id === memoryId)) throw new DomainError('SHAPE');
    const next = clone(before);
    next.memories.find((item) => item.id === memoryId)!.status = 'deleted';
    next.version += 1;
    this.commit(next, '删除记忆并排除检索', 'user', before, `memory:delete:${memoryId}`);
  }

  creditGrowth(type: GrowthEvent['type'], sourceId: string, confirmed: boolean, period = weekKey(this.state.today)): number {
    if (!confirmed || !text(sourceId, 100)) return 0;
    const before = this.state;
    const award = RULES.awards[type];
    const key = `${RULES.ruleVersion}:${type}:${sourceId}`;
    if (!award || before.growth.seen.includes(key)) return 0;
    const inPeriod = before.growth.events.filter((event) => event.period === period);
    if (inPeriod.filter((event) => event.type === type).length >= RULES.limits[type]) return 0;
    const remaining = Math.max(0, RULES.weeklyCap - inPeriod.reduce((sum, event) => sum + event.award, 0));
    const actualAward = Math.min(award, remaining);
    if (!actualAward) return 0;
    const next = clone(before);
    next.growth.seen.push(key);
    next.growth.events.push({ key, type, sourceId, period, award: actualAward, revoked: false, confirmed: true });
    next.growth.highestStage = Math.max(next.growth.highestStage, highestStage(next.growth.events.filter((event) => !event.revoked).reduce((sum, event) => sum + event.award, 0)));
    next.version += 1;
    this.commit(next, `确认成长证据：${type}`, 'user', before, `growth:${key}`);
    return actualAward;
  }

  revokeGrowth(key: string): number {
    const before = this.state;
    const event = before.growth.events.find((item) => item.key === key);
    if (!event) return this.validXP();
    const next = clone(before);
    next.growth.events.find((item) => item.key === key)!.revoked = true;
    next.version += 1;
    this.commit(next, '更正成长证据', 'user', before, `growth:revoke:${key}`);
    return this.validXP();
  }

  validXP(): number { return this.snapshot.state.growth.events.filter((event) => !event.revoked).reduce((sum, event) => sum + event.award, 0); }

  exportData(): string {
    const exported = clone(this.snapshot);
    // Credentials are deliberately absent from AppState; this assertion keeps the boundary explicit.
    delete (exported.state.settings as Partial<AppSettings> & { credential?: unknown }).credential;
    return JSON.stringify({ exportSchemaVersion: 1, exportedAt: nowIso(), snapshot: exported }, null, 2);
  }

  importData(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as { exportSchemaVersion?: number; snapshot?: Snapshot };
      if (parsed.exportSchemaVersion !== 1 || !parsed.snapshot?.state || parsed.snapshot.state.schemaVersion !== 1 || !Array.isArray(parsed.snapshot.state.tasks)) throw new Error('schema');
      if (!Array.isArray(parsed.snapshot.state.primaryProjects)) parsed.snapshot.state.primaryProjects = ['goal-capability'];
      this.snapshot = clone(parsed.snapshot);
      this.persist();
    } catch {
      throw new DomainError('IMPORT_REJECTED', '导入文件版本或结构不受支持');
    }
  }
}

export const createStore = (snapshot?: Snapshot) => new NorthstarStore(snapshot);
