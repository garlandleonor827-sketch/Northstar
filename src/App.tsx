import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Download,
  FileText,
  Flag,
  Gauge,
  Lightbulb,
  MessageCircle,
  Moon,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Sun,
  Target,
  Trash2,
  X,
  Zap
} from 'lucide-react';
import { NorthstarCore, type CoreStatus } from './components/NorthstarCore';
import { completionMetric, createStore, type AppState, type IdeaStatus, type RecordResult } from './lib/domain';
import './styles.css';

const store = createStore();

type View = 'today' | 'plans' | 'review' | 'ai' | 'ideas' | 'memory' | 'settings';

const navItems: Array<{ id: View; label: string; icon: typeof Circle; group?: string }> = [
  { id: 'today', label: '今日', icon: Circle, group: '工作台' },
  { id: 'plans', label: '战略与计划', icon: CalendarDays, group: '工作台' },
  { id: 'review', label: '周复盘', icon: RotateCcw, group: '工作台' },
  { id: 'ai', label: 'AI 战略会话', icon: MessageCircle, group: '工作台' },
  { id: 'ideas', label: '灵感停车场', icon: Lightbulb, group: '资料' },
  { id: 'memory', label: '记忆', icon: FileText, group: '资料' }
];

const viewMeta: Record<View, { kicker: string; label: string }> = {
  today: { kicker: 'COMMAND DESK', label: '今日' },
  plans: { kicker: 'STRATEGY / PLAN', label: '战略与计划' },
  review: { kicker: 'WEEKLY REVIEW', label: '周复盘' },
  ai: { kicker: 'AI STRATEGY SESSION', label: '战略会话' },
  ideas: { kicker: 'PARKING LOT', label: '灵感停车场' },
  memory: { kicker: 'MEMORY', label: '记忆' },
  settings: { kicker: 'SETTINGS', label: '设置与数据' }
};

function useNorthstarState(): AppState {
  const [state, setState] = useState(() => store.state);
  useEffect(() => store.subscribe(() => setState(store.state)), []);
  return state;
}

function formatDate(dateIso: string): string {
  const date = new Date(dateIso + 'T12:00:00');
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(date).toUpperCase();
}

function hours(minutes: number): string {
  return (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1) + 'h';
}

function ratioPercent(value: number, total: number): number {
  return total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100));
}

/**
 * Core state is derived from facts already held by the local domain store.
 * The renderer never treats a prompt or an animation as authority.
 */
function deriveCoreStatus(state: AppState): CoreStatus {
  const scheduledMinutes = state.tasks
    .filter((task) => task.scheduledDate && task.status !== 'completed')
    .reduce((sum, task) => sum + task.minutes, 0);
  const focus = state.tasks.find((task) => task.id === state.plan.focusId) ?? state.tasks.find((task) => task.id === 'task-verify');
  if (scheduledMinutes > state.plan.capacityMinutes) return 'overloaded';
  if (state.plan.capacityMinutes <= 240) return 'recovering';
  if (focus?.status === 'in_progress') return 'flow';
  if (focus?.status === 'blocked' || state.records.some((record) => record.result === 'blocked')) return 'drifting';
  if (!state.records.length) return 'dormant';
  return 'focused';
}

function App() {
  const state = useNorthstarState();
  const [view, setView] = useState<View>('today');
  const [recordTaskId, setRecordTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const theme = state.settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.motion = state.settings.reducedMotion ? 'reduced' : 'full';
  }, [theme, state.settings.reducedMotion]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const action = (fn: () => void, success: string) => {
    try {
      fn();
      setToast(success);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '操作未完成');
    }
  };

  return (
    <div className={'app-shell ' + (sidebarCollapsed ? 'sidebar-collapsed' : '')}>
      <Sidebar active={view} collapsed={sidebarCollapsed} onCollapse={() => setSidebarCollapsed((value) => !value)} onNavigate={setView} state={state} />
      <div className="app-main">
        <Header view={view} state={state} onTheme={() => action(() => store.setTheme(theme === 'dark' ? 'light' : 'dark'), theme === 'dark' ? '已切换浅色主题' : '已切换深色主题')} onReset={() => action(() => store.resetDemo(), '已恢复演示数据')} />
        <main className="page-content" key={view}>
          {view === 'today' && <TodayPage state={state} onRecord={setRecordTaskId} onNavigate={setView} action={action} />}
          {view === 'plans' && <PlansPage state={state} action={action} />}
          {view === 'review' && <ReviewPage state={state} action={action} onNavigate={setView} />}
          {view === 'ai' && <AiStrategyPage state={state} onNavigate={setView} />}
          {view === 'ideas' && <IdeasPage state={state} action={action} />}
          {view === 'memory' && <MemoryPage state={state} action={action} />}
          {view === 'settings' && <SettingsPage state={state} action={action} />}
        </main>
      </div>
      {recordTaskId && <RecordModal task={state.tasks.find((item) => item.id === recordTaskId)!} onClose={() => setRecordTaskId(null)} onSave={(result, minutes, note) => action(() => { store.recordTask(recordTaskId, result, minutes, note); setRecordTaskId(null); }, '进度已记录')} />}
      {toast && <div className="toast" role="status"><Check size={16} aria-hidden="true" />{toast}</div>}
    </div>
  );
}

function Sidebar({ active, collapsed, onCollapse, onNavigate, state }: { active: View; collapsed: boolean; onCollapse: () => void; onNavigate: (view: View) => void; state: AppState }) {
  let lastGroup = '';
  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="brand-row">
        <img src="/assets/brand/northstar-mark.svg" alt="" className="brand-mark" />
        {!collapsed && <span className="brand-name">NORTHSTAR</span>}
        <button className="collapse-button" type="button" onClick={onCollapse} aria-label={collapsed ? '展开侧栏' : '收起侧栏'}>{collapsed ? '›' : '‹'}</button>
      </div>
      {!collapsed && <p className="brand-subtitle">PERSONAL STRATEGY OS</p>}
      <nav className="nav-list">
        {navItems.map(({ id, label, icon: Icon, group }) => {
          const showGroup = !collapsed && group !== lastGroup;
          lastGroup = group ?? '';
          return <div className="nav-entry" key={id}>{showGroup && <span className="nav-group-label">{group}</span>}<button type="button" className={'nav-item ' + (active === id ? 'active' : '')} onClick={() => onNavigate(id)} title={label}><Icon size={17} strokeWidth={1.6} /><span>{!collapsed && label}</span></button></div>;
        })}
      </nav>
      {!collapsed && <div className="sidebar-cycle"><span>当前阶段</span><strong>能力与选择权积累</strong><em>CYCLE 01 / 12 WEEKS</em></div>}
      <div className="sidebar-bottom">
        <button type="button" className={'nav-item ' + (active === 'settings' ? 'active' : '')} onClick={() => onNavigate('settings')}><Settings2 size={17} strokeWidth={1.6} /><span>{!collapsed && '设置与数据'}</span></button>
        {!collapsed && <><span className="local-status"><i />本地优先 · 无 Key 演示</span><small>DESIGN REFERENCE · V2</small></>}
      </div>
    </aside>
  );
}

function Header({ view, state, onTheme, onReset }: { view: View; state: AppState; onTheme: () => void; onReset: () => void }) {
  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>{viewMeta[view].kicker}</span><ChevronRight size={14} aria-hidden="true" /><strong>{viewMeta[view].label}</strong></div>
      <div className="top-actions">
        <span className="top-status"><i />本地工作区</span>
        <button className="top-pill" type="button" onClick={onReset}><Sparkles size={14} />演示数据</button>
        <button className="top-pill" type="button" onClick={onTheme}>{state.settings.theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}{state.settings.theme === 'dark' ? '深色' : '浅色'}</button>
        <span className="shortcut">Ctrl K</span>
      </div>
    </header>
  );
}

function TodayPage({ state, onRecord, onNavigate, action }: { state: AppState; onRecord: (taskId: string) => void; onNavigate: (view: View) => void; action: (fn: () => void, success: string) => void }) {
  const priority = state.tasks.find((task) => task.id === state.plan.focusId && task.status !== 'completed') ?? state.tasks.find((task) => task.id === 'task-verify' && task.status !== 'completed') ?? state.tasks.find((task) => task.status !== 'completed')!;
  const visibleTasks = state.tasks.filter((task) => task.id !== priority.id).slice(0, 3);
  const used = state.records.reduce((sum, record) => sum + (record.actualMinutes ?? 0), 0);
  const completed = state.tasks.filter((task) => task.status === 'completed').length;
  const coreStatus = deriveCoreStatus(state);
  const progress = priority.status === 'completed' ? 100 : priority.status === 'in_progress' ? 42 : 8;
  return (
    <div className="today-layout page-enter">
      <section className="today-left">
        <div className="today-hero">
          <div className="page-kicker"><span className="eyebrow">{formatDate(state.today)}</span><span className="capacity-pill"><Clock3 size={13} />标准周 · {hours(state.plan.capacityMinutes)}</span></div>
          <div className="hero-title-row"><div><h1>今天，<em>聚焦真正重要的事。</em></h1><p>把注意力放在一个可验证的结果上，其他事情保持清晰的次序。</p></div><div className="hero-quote"><span>LESS DRIFT</span><strong>A BIGGER YOU.</strong></div></div>
        </div>

        <section className="priority-card panel panel--focus">
          <div className="accent-line" />
          <div className="priority-topline"><span className="eyebrow">TODAY'S PRIORITY</span><span className={'state-chip state-chip--' + coreStatus}><Activity size={13} />{coreStatus === 'flow' ? '进行中' : coreStatus === 'focused' ? '已确认' : '需要留意'}</span></div>
          <div className="priority-body"><div className="progress-ring" style={{ '--progress': progress * 3.6 + 'deg' } as CSSProperties}><span>{progress}%</span></div><div className="priority-copy"><h2>{priority.title}</h2><p>{priority.detail}。</p><div className="task-meta"><span className="tag">{priority.kind === 'responsibility' ? '责任 / 固定事项' : '主线 / 当前周期'}</span><span>{priority.minutes} 分钟</span><span>·</span><span>一个可验证的结果</span></div></div></div>
          <div className="priority-actions"><button type="button" className="primary-button" onClick={() => action(() => store.startTask(priority.id), '已开始专注')}><Play size={16} fill="currentColor" />{priority.status === 'in_progress' ? '继续专注' : '开始专注'}</button><button type="button" className="secondary-button" onClick={() => onRecord(priority.id)}><FileText size={16} />记录进度</button><button type="button" className="text-button" onClick={() => onNavigate('plans')}>查看周计划 <ArrowUpRight size={15} /></button></div>
        </section>

        <div className="section-heading task-heading"><div><span className="eyebrow">NEXT MOVES</span><h2>关键动作</h2></div><span>{completed} / {state.tasks.length} 已记录</span></div>
        <section className="task-list panel panel--quiet">
          {visibleTasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} onRecord={onRecord} />)}
        </section>

        <section className="outcome-strip panel"><div className="outcome-label"><Flag size={17} /><span>本周唯一成果</span></div><strong>{state.plan.outcome}</strong><div className="outcome-progress"><span>已用 {hours(used)} / 计划 {hours(state.plan.capacityMinutes)}</span><div className="progress-track"><i style={{ width: ratioPercent(used, state.plan.capacityMinutes) + '%' }} /></div><button type="button" className="text-button" onClick={() => onNavigate('review')}>去复盘 <ArrowUpRight size={14} /></button></div></section>
      </section>

      <aside className="today-right">
        <NorthstarCore theme={state.settings.theme} stage={state.growth.highestStage} status={coreStatus} reducedMotion={state.settings.reducedMotion} onOpenSession={() => onNavigate('ai')} />
        <div className="today-signal-grid"><div className="signal-stat"><span>当前阶段</span><strong>Stage {Math.max(1, state.growth.highestStage)} · {state.growth.events.length ? '持续积累' : '种子已醒'}</strong></div><div className="signal-stat"><span>记录覆盖度</span><strong>{state.records.length ? Math.round(completionMetric(state.records).coverage * 100) + '%' : '尚未记录'}</strong></div></div>
      </aside>
    </div>
  );
}

function TaskRow({ task, index, onRecord }: { task: AppState['tasks'][number]; index: number; onRecord: (taskId: string) => void }) {
  const complete = task.status === 'completed';
  return <div className={'task-row ' + (complete ? 'complete' : '')}><span className="task-index">0{index + 1}</span><button className="task-check" type="button" aria-label={'记录' + task.title} onClick={() => onRecord(task.id)}>{complete ? <Check size={14} /> : <Circle size={18} />}</button><div className="task-copy"><strong>{task.title}</strong><span>{task.detail}</span></div><span className="task-time">{complete ? '已记录' : task.minutes + ' min'}</span><ChevronRight size={15} className="task-arrow" aria-hidden="true" /></div>;
}

function PlansPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  const [capacity, setCapacity] = useState(state.plan.capacityMinutes);
  useEffect(() => setCapacity(state.plan.capacityMinutes), [state.plan.capacityMinutes]);
  const scheduled = state.tasks.filter((task) => task.scheduledDate && task.status !== 'completed');
  const scheduledMinutes = scheduled.reduce((sum, task) => sum + task.minutes, 0);
  const undo = () => action(() => store.undoLast(state.version), '已撤销上一批变更');
  const applyCapacity = (value: number) => action(() => { const result = store.setCapacity(value); if (result.conflict) throw new Error(result.conflict); }, '容量已调整为 ' + hours(value));
  return <div className="single-page page-enter"><PageTitle kicker="STRATEGY / PLAN" title="把长期方向，翻译成这一周。" subtitle="计划是可调整的草稿；已确认成果、锁定职责与历史事实有不同权限。" />
    <div className="plan-grid"><section className="panel plan-summary"><div className="stat-grid"><div><span>本周成果</span><strong>{state.plan.outcome}</strong></div><div><span>当前容量</span><strong>{hours(state.plan.capacityMinutes)}</strong></div><div><span>计划占用</span><strong>{hours(scheduledMinutes)}</strong></div></div><div className="capacity-control"><label htmlFor="capacity">容量：{hours(capacity)}</label><input id="capacity" type="range" min="0" max="840" step="30" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} onMouseUp={() => applyCapacity(capacity)} onKeyUp={(event) => { if (event.key === 'Enter') applyCapacity(capacity); }} /><div className="quick-capacity"><button type="button" className="text-button" onClick={() => { setCapacity(240); applyCapacity(240); }}>降至 4h</button><button type="button" className="text-button" onClick={() => { setCapacity(600); applyCapacity(600); }}>恢复 10h</button></div><small>容量下降时只会调整可选软排程；锁定职责和硬截止会生成冲突。</small></div><label className="switch-row"><input type="checkbox" checked={state.settings.autoAdjust} onChange={(event) => action(() => store.setAutoAdjust(event.target.checked), event.target.checked ? '已允许批准范围内自动调整' : '已关闭自动调整')} /><span className="switch" />允许批准范围内自动调整</label><div className="button-row"><button type="button" className="secondary-button" onClick={undo}><RotateCcw size={16} />撤销上一批变更</button></div></section><section className="panel plan-tasks"><div className="section-heading"><h2>本周排程</h2><span>{scheduled.length} 个事项</span></div>{state.tasks.map((task) => <div className="compact-task" key={task.id}><span className={'status-dot ' + task.status} /> <div><strong>{task.title}</strong><small>{task.scheduledDate ?? '未安排'} · {task.minutes} min {task.pinned ? '· 锁定' : ''}</small></div></div>)}</section></div>
    <section className="audit-panel"><div><span className="eyebrow">领域回执</span><strong>每次变更都有版本、审计和撤销边界。</strong></div><span>当前版本 v{state.version}</span><button type="button" className="text-button" onClick={() => action(() => { const blob = new Blob([store.exportData()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'northstar-export.json'; anchor.click(); URL.revokeObjectURL(url); }, '已导出不含凭据的数据快照')}><Download size={14} />导出快照</button></section>
  </div>;
}

function ReviewPage({ state, action, onNavigate }: { state: AppState; action: (fn: () => void, success: string) => void; onNavigate: (view: View) => void }) {
  const metric = completionMetric(state.records);
  const latest = state.proposals.at(-1);
  const actualMinutes = state.records.reduce((sum, item) => sum + (item.actualMinutes ?? 0), 0);
  const completed = state.tasks.filter((task) => task.status === 'completed');
  return <div className="review-layout page-enter"><section className="review-main"><div className="review-hero"><span className="eyebrow">WEEKLY REVIEW / CURRENT CYCLE</span><h1>让计划，重新贴合现实。</h1><p>先看发生了什么，再决定下周保留、停止或调整什么。缺失数据不会被当成零。</p><span className="hero-quote hero-quote--review">KEEP · STOP · CHANGE</span></div>
    <section className="fact-rail panel"><div className="fact-item"><span>计划投入</span><strong>{hours(state.plan.capacityMinutes)}</strong><small>标准容量</small></div><div className="fact-item"><span>实际记录</span><strong>{hours(actualMinutes)}</strong><small>仅计已记录事实</small></div><div className="fact-item"><span>记录覆盖度</span><strong>{metric.coverage ? Math.round(metric.coverage * 100) + '%' : '未知'}</strong><small>{metric.rate === null ? '证据不足，暂不判定' : '完成率 ' + Math.round(metric.rate * 100) + '%'}</small></div><div className="fact-item fact-item--signal"><Activity size={17} /><span>{state.records.length ? '本周有可复核信号' : '等待更多事实记录'}</span></div></section>
    <div className="review-triad"><ReviewColumn tone="keep" icon={<Check size={18} />} title="KEEP" subtitle="继续保持" items={[state.plan.outcome, completed[0]?.title ?? '已经记录的有效行动', '保留可验证的小步节奏']} /><ReviewColumn tone="stop" icon={<X size={18} />} title="STOP" subtitle="停止消耗" items={['把模糊扩展先放回停车场', '不为未记录的结果补造解释', '暂不增加第二条主线']} /><ReviewColumn tone="change" icon={<Zap size={18} />} title="CHANGE" subtitle="下周调整" items={[latest?.summary ?? '把最难的一步提前到精力更好的时段', '将可选动作压到容量以内', '每次只验证一个关键假设']} /></div>
    <section className="proposal-card panel proposal-card--wide"><div className="proposal-kicker"><span className="eyebrow">AI ADJUSTMENT · CANDIDATE</span><span className="tag">需要确认</span></div><h2>{latest?.summary ?? '让下一周只围绕一个可验证结果推进。'}</h2><p>{latest?.reason ?? '生成提案只读取当前计划和已记录事实，不会直接改变战略层。'}</p>{latest && latest.status === 'pending' && <div className="proposal-actions"><button type="button" className="primary-button" onClick={() => action(() => store.approveProposal(latest.id), '提案已批准')}>批准提案</button><button type="button" className="secondary-button" onClick={() => action(() => store.rejectProposal(latest.id), '已保留当前计划')}>暂不调整</button></div>}<button type="button" className="text-button" onClick={() => action(() => store.createReviewProposal(), '已生成待确认提案')}>{latest ? '重新生成提案' : '生成复盘提案'} <ChevronRight size={15} /></button></section>
  </section><aside className="review-side"><NorthstarCore theme={state.settings.theme} stage={state.growth.highestStage} status="focused" reducedMotion={state.settings.reducedMotion} compact onOpenSession={() => onNavigate('ai')} /><section className="review-note panel"><span className="eyebrow">复盘提示</span><strong>把事实与推断分开，下一步会更轻。</strong><p>本周只记录了 {state.records.length} 条事实。Core 会保留当前阶段，不因漏记自动退步。</p></section></aside></div>;
}

function ReviewColumn({ tone, icon, title, subtitle, items }: { tone: 'keep' | 'stop' | 'change'; icon: ReactNode; title: string; subtitle: string; items: string[] }) {
  return <section className={'review-column review-column--' + tone}><div className="review-column-title"><span className="review-column-icon">{icon}</span><div><strong>{title}</strong><small>{subtitle}</small></div></div><ul>{items.map((item) => <li key={item}><span />{item}</li>)}</ul></section>;
}

type SessionMode = 'think' | 'plan' | 'challenge' | 'review';
const sessionModes: Array<{ id: SessionMode; label: string; icon: typeof Bot }> = [
  { id: 'think', label: '思考', icon: Bot },
  { id: 'plan', label: '规划', icon: CalendarDays },
  { id: 'challenge', label: '挑战', icon: Target },
  { id: 'review', label: '复盘', icon: RotateCcw }
];

function AiStrategyPage({ state, onNavigate }: { state: AppState; onNavigate: (view: View) => void }) {
  const [mode, setMode] = useState<SessionMode>('think');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'core'; text: string }>>([
    { role: 'user', text: '我想确认，当前主线是否值得继续投入？' },
    { role: 'core', text: '我会先看已确认的周期成果、实际记录和容量，再把建议写成可撤销的候选方案。' }
  ]);
  const context = useMemo(() => [
    { icon: Target, label: '本季度主线', value: '能力与选择权积累', meta: '已确认' },
    { icon: Flag, label: '本周成果', value: state.plan.outcome, meta: 'Week · ' + hours(state.plan.capacityMinutes) },
    { icon: Gauge, label: '事实记录', value: state.records.length + ' 条可复核记录', meta: '不含推断' }
  ], [state.plan.capacityMinutes, state.plan.outcome, state.records.length]);
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { role: 'user', text }, { role: 'core', text: mode === 'challenge' ? '先保留问题本身。下一步只验证一个最小假设，再决定是否扩大范围。' : mode === 'plan' ? '可以把它拆成一个 45 分钟的可验证动作，完成后再回到这里记录事实。' : '我会把这条输入当作候选思路，不会直接改变已确认计划。' }]);
    setDraft('');
  };
  return <div className="ai-layout page-enter"><section className="ai-context panel"><div className="ai-context-heading"><span className="eyebrow">AI STRATEGY SESSION</span><span className="local-badge"><i />无 Key 演示</span></div><h1>让更好的选择，来自更清晰的思考。</h1><p className="ai-lede">与 Core 一起，从更高的视角看问题，把想法放进已确认的战略上下文。</p><div className="context-list">{context.map(({ icon: Icon, label, value, meta }) => <article className="context-item" key={label}><span className="context-icon"><Icon size={17} /></span><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></article>)}</div><div className="context-guard"><Sparkles size={16} /><div><strong>上下文边界</strong><p>只读取本次会话相关的战略、计划和事实；财务、家庭等敏感内容默认不发送。</p></div></div><button type="button" className="text-button" onClick={() => onNavigate('today')}>回到今日工作台 <ArrowUpRight size={15} /></button></section><section className="ai-session panel"><div className="ai-session-top"><div><span className="eyebrow">NORTHSTAR CORE / SESSION</span><h2>当前战略空间</h2></div><NorthstarCore theme={state.settings.theme} stage={state.growth.highestStage} status="flow" reducedMotion={state.settings.reducedMotion} compact onOpenSession={() => undefined} /></div><div className="session-mode-tabs" role="tablist" aria-label="会话角色">{sessionModes.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={mode === id ? 'active' : ''} onClick={() => setMode(id)} role="tab" aria-selected={mode === id}><Icon size={16} /><span>{label}</span><small>{id === 'think' ? '分析问题' : id === 'plan' ? '制定方案' : id === 'challenge' ? '发现盲点' : '沉淀结论'}</small></button>)}</div><div className="session-thread" aria-live="polite">{messages.map((message, index) => <div className={'session-message session-message--' + message.role} key={message.role + '-' + index}><span className="message-avatar">{message.role === 'user' ? '我' : 'N'}</span><p>{message.text}</p></div>)}</div><div className="session-suggestion"><span className="suggestion-label">我的建议</span><strong>{mode === 'challenge' ? '先验证最小假设，再决定扩大范围。' : mode === 'plan' ? '把下一个动作压缩成 45 分钟，并写出完成证据。' : mode === 'review' ? '记录本周事实，保留可解释的变化。' : '继续围绕当前主线，减少同时打开的选项。'}</strong><small>候选建议 · 需要你确认后才会改变计划</small></div><div className="session-composer"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') send(); }} placeholder="继续提问，或记录一个可能性…" aria-label="输入战略问题" /><button type="button" className="primary-button" onClick={send} disabled={!draft.trim()}><MessageCircle size={16} />发送</button></div></section></div>;
}

function IdeasPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  const [idea, setIdea] = useState('');
  const statuses: Record<IdeaStatus, string> = { cooling: '冷却中', extended: '已延长', promoted: '已升级', abandoned: '已放弃' };
  return <div className="single-page page-enter"><PageTitle kicker="PARKING LOT" title="灵感先停在这里。" subtitle="新想法默认冷却 14 天；它可以被编辑、延长或放弃，不会悄悄变成第二条主线。" /><form className="inline-form panel" onSubmit={(event) => { event.preventDefault(); action(() => { store.addIdea(idea); setIdea(''); }, '已加入冷却期'); }}><input value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="记录一个想法，不急着执行" aria-label="新想法" /><button className="primary-button" type="submit" disabled={!idea.trim()}>放入停车场</button></form><div className="idea-list">{state.ideas.map((item) => <article className="panel idea-card" key={item.id}><div><span className={'tag status-' + item.status}>{statuses[item.status]}</span><h2>{item.content}</h2><p>冷却至 {item.coolUntil} · 到期后再决定是否升级</p></div><div className="button-row">{item.status === 'cooling' && <button type="button" className="secondary-button" onClick={() => action(() => store.updateIdea(item.id, 'extended'), '已延长冷却期')}>延长</button>}<button type="button" className="text-button danger-text" onClick={() => action(() => store.updateIdea(item.id, 'abandoned'), '已放弃该想法')}><Trash2 size={14} />放弃</button></div></article>)}</div></div>;
}

function MemoryPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  return <div className="single-page page-enter"><PageTitle kicker="MEMORY" title="只保留你确认过的东西。" subtitle="候选记忆与已确认陈述分开；删除会立即排除后续检索，旧备份需另行处理。" /><div className="memory-list">{state.memories.filter((memory) => memory.status !== 'deleted').map((memory) => <article className="panel memory-card" key={memory.id}><div className="memory-type"><span className="tag">{memory.kind === 'statement' ? '陈述' : memory.kind === 'observation' ? '行为' : '推断'}</span><span>{memory.status === 'candidate' ? '待确认' : '已确认'}</span></div><h2>{memory.content}</h2><p>来源：{memory.sourceIds.join('、') || '用户直接输入'}</p><div className="button-row">{memory.status === 'candidate' && <button type="button" className="primary-button" onClick={() => action(() => store.confirmMemory(memory.id), '记忆已确认')}>确认记忆</button>}<button type="button" className="text-button danger-text" onClick={() => action(() => store.deleteMemory(memory.id), '记忆已删除')}><Trash2 size={14} />删除</button></div></article>)}</div></div>;
}

function SettingsPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  return <div className="single-page page-enter"><PageTitle kicker="SETTINGS / LOCAL ONLY" title="把边界设清楚，再让工具帮忙。" subtitle="当前版本不连接云端、账号或外部平台；没有 Key 也能完成手动规划、记录、复盘和导出。" /><div className="settings-grid"><section className="panel settings-card"><h2>显示</h2><label className="setting-row"><span>主题</span><button type="button" className="secondary-button" onClick={() => action(() => store.setTheme(state.settings.theme === 'dark' ? 'light' : 'dark'), '主题已切换')}>{state.settings.theme === 'dark' ? '深色' : '浅色'}</button></label><label className="setting-row"><span>减少动效</span><input type="checkbox" checked={state.settings.reducedMotion} onChange={(event) => action(() => store.setReducedMotion(event.target.checked), event.target.checked ? '已减少动效' : '已恢复动效')} /></label></section><section className="panel settings-card"><h2>AI 权限</h2><p className="muted-copy">AI 只能提出候选命令；本地领域层仍会检查版本、容量、锁定项和权限。</p><label className="setting-row"><span>敏感上下文授权</span><input type="checkbox" checked={state.settings.privacySensitiveContext} onChange={(event) => action(() => store.setPrivacySensitiveContext(event.target.checked), event.target.checked ? '已授权敏感上下文' : '已关闭敏感上下文')} /></label><div className="provider-state"><span className="status-dot" />Provider 未配置 · 无 Key 演示模式</div></section><section className="panel settings-card"><h2>本地数据</h2><p className="muted-copy">当前开发版使用浏览器本地持久化，重启开发窗口后仍保留。SQLite 一致性备份和 Windows 凭据库等待 Tauri/Rust 环境。</p><button type="button" className="secondary-button" onClick={() => action(() => { const blob = new Blob([store.exportData()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'northstar-export.json'; anchor.click(); URL.revokeObjectURL(url); }, '已导出本地快照')}><Download size={16} />导出 JSON</button></section></div></div>;
}

function PageTitle({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return <div className="page-title"><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{subtitle}</p></div>;
}

function RecordModal({ task, onClose, onSave }: { task: AppState['tasks'][number]; onClose: () => void; onSave: (result: RecordResult, minutes: number | null, note: string) => void }) {
  const [result, setResult] = useState<RecordResult>(task.status === 'in_progress' ? 'completed' : 'partial');
  const [minutes, setMinutes] = useState(task.minutes);
  const [note, setNote] = useState('');
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="record-title"><div className="modal-header"><div><span className="eyebrow">记录事实</span><h2 id="record-title">{task.title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button></div><label>结果<select value={result} onChange={(event) => setResult(event.target.value as RecordResult)}><option value="completed">完成</option><option value="partial">部分完成</option><option value="blocked">卡住</option><option value="not_worth_it">不值得继续</option></select></label><label>实际耗时（分钟）<input type="number" min="0" max="1440" value={minutes} onChange={(event) => setMinutes(event.target.value === '' ? 0 : Number(event.target.value))} /></label><label>备注<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="只记录事实、阻碍和下一步" rows={3} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" onClick={() => onSave(result, Number.isFinite(minutes) ? minutes : null, note)}>保存记录</button></div></section></div>;
}

export default App;
