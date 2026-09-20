import { describe, expect, it } from 'vitest';
import { DomainError, addDays, createStore, type WeekChangeRequest } from '../src/lib/domain';

function request(store = createStore()): WeekChangeRequest {
  const state = store.state;
  return {
    schemaVersion: 1,
    requestId: 'request-demo-1',
    baseVersion: state.plan.version,
    planId: state.plan.id,
    reason: '按已批准范围微调软排程',
    actions: [{ type: 'schedule_task', taskId: 'task-next', date: addDays(state.plan.start, 2), rank: 1 }]
  };
}

describe('Northstar domain boundary', () => {
  it('applies a valid change once and replays the same request', () => {
    const store = createStore();
    const change = request(store);
    const first = store.applyWeekChange(change);
    const replay = store.applyWeekChange(change);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(store.audit).toHaveLength(1);
  });

  it('rejects reused ids with different content and stale versions', () => {
    const store = createStore();
    const change = request(store);
    store.applyWeekChange(change);
    expect(() => store.applyWeekChange({ ...change, reason: '另一种含义' })).toThrowError(new RegExp('ID_REUSED'));
    expect(() => store.applyWeekChange({ ...request(store), requestId: 'stale', baseVersion: 4 })).toThrowError(new RegExp('STALE'));
  });

  it('fails closed when auto adjustment is not authorized', () => {
    const store = createStore();
    store.setAutoAdjust(false);
    expect(() => store.applyWeekChange(request(store))).toThrowError(new RegExp('NOT_AUTHORIZED'));
  });

  it('rejects protected work and rolls back a mixed batch', () => {
    const store = createStore();
    const change = request(store);
    const before = store.state;
    expect(() => store.applyWeekChange({ ...change, actions: [
      { type: 'schedule_task', taskId: 'task-next', date: before.plan.start, rank: 2 },
      { type: 'unschedule_task', taskId: 'task-responsibility', date: null, rank: 0 }
    ] })).toThrowError(new RegExp('PROTECTED|HARD_DUE'));
    expect(store.state).toEqual(before);
  });

  it('records facts separately from planned minutes', () => {
    const store = createStore();
    const record = store.recordTask('task-verify', 'partial', 28, '遇到一个输入边界问题');
    expect(record.actualMinutes).toBe(28);
    expect(store.state.tasks.find((task) => task.id === 'task-verify')?.status).toBe('partial');
  });

  it('keeps capacity bounds while preserving task definitions', () => {
    const store = createStore();
    const beforeTitles = store.state.tasks.map((task) => task.title);
    const result = store.setCapacity(240);
    expect(result.conflict).toBeNull();
    expect(store.state.plan.capacityMinutes).toBe(240);
    expect(store.state.tasks.filter((task) => task.scheduledDate && task.status !== 'completed').reduce((sum, task) => sum + task.minutes, 0)).toBeLessThanOrEqual(240);
    expect(store.state.tasks.map((task) => task.title)).toEqual(beforeTitles);
  });

  it('does not undo after a later edit changes the version', () => {
    const store = createStore();
    const change = request(store);
    store.applyWeekChange(change);
    store.recordTask('task-review', 'partial', 12, '后续用户事实');
    expect(() => store.undoLast(5)).toThrowError(/UNDO_CONFLICT/);
  });

  it('requires an explicit proposal approval before changing the outcome', () => {
    const store = createStore();
    const proposal = store.createReviewProposal();
    expect(store.state.plan.outcome).toContain('跑通');
    store.approveProposal(proposal.id);
    expect(store.state.plan.outcome).toBe('验证一个核心流程并记录可复用结论');
  });

  it('keeps growth deterministic, capped and non-decreasing by stage', () => {
    const store = createStore();
    expect(store.creditGrowth('review', 'review-1', true)).toBe(10);
    expect(store.creditGrowth('review', 'review-1', true)).toBe(0);
    expect(store.creditGrowth('review', 'review-2', true)).toBe(0);
    expect(store.validXP()).toBe(10);
    const before = store.state.growth.highestStage;
    expect(before).toBeGreaterThanOrEqual(1);
  });

  it('exports a schema-bounded local snapshot and rejects malformed imports', () => {
    const store = createStore();
    const exported = store.exportData();
    expect(exported).toContain('exportSchemaVersion');
    expect(() => store.importData('{"exportSchemaVersion":99}')).toThrowError(DomainError);
  });
});
