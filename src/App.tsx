import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronRight, Circle, Clock3, Download, FileText, Flag, Lightbulb, Moon, Play, RotateCcw, Settings2, Sparkles, Sun, Target, Trash2, X } from 'lucide-react';
import { NorthstarCore } from './components/NorthstarCore';
import { completionMetric, createStore, type AppState, type IdeaStatus, type RecordResult } from './lib/domain';
import './styles.css';

const store = createStore();

type View = 'today' | 'plans' | 'review' | 'ideas' | 'memory' | 'settings';

const navItems: Array<{ id: View; label: string; icon: typeof Circle }> = [
  { id: 'today', label: '今日', icon: Circle },
  { id: 'plans', label: '战略与计划', icon: CalendarDays },
  { id: 'review', label: '复盘', icon: RotateCcw },
  { id: 'ideas', label: '灵感停车场', icon: Lightbulb },
  { id: 'memory', label: '记忆', icon: FileText }
];

function useNorthstarState(): AppState {
  const [state, setState] = useState(() => store.state);
  useEffect(() => store.subscribe(() => setState(store.state)), []);
  return state;
}

function formatDate(dateIso: string): string {
  const date = new Date(`${dateIso}T12:00:00`);
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(date).toUpperCase();
}

function hours(minutes: number): string {
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;
}

function ratioPercent(value: number, total: number): number {
  return total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100));
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
    try { fn(); setToast(success); } catch (error) { setToast(error instanceof Error ? error.message : '操作未完成'); }
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar active={view} collapsed={sidebarCollapsed} onCollapse={() => setSidebarCollapsed((value) => !value)} onNavigate={setView} state={state} />
      <div className="app-main">
        <Header state={state} onTheme={() => action(() => store.setTheme(theme === 'dark' ? 'light' : 'dark'), theme === 'dark' ? '已切换浅色主题' : '已切换深色主题')} onReset={() => action(() => store.resetDemo(), '已恢复演示数据')} />
        <main className="page-content">
          {view === 'today' && <TodayPage state={state} onRecord={setRecordTaskId} onNavigate={setView} action={action} />}
          {view === 'plans' && <PlansPage state={state} action={action} />}
          {view === 'review' && <ReviewPage state={state} action={action} />}
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
  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="brand-row">
        <img src="/assets/brand/northstar-mark.svg" alt="" className="brand-mark" />
        {!collapsed && <span className="brand-name">NORTHSTAR</span>}
        <button className="collapse-button" type="button" onClick={onCollapse} aria-label={collapsed ? '展开侧栏' : '收起侧栏'}>{collapsed ? '›' : '‹'}</button>
      </div>
      {!collapsed && <p className="brand-subtitle">PERSONAL STRATEGY OS</p>}
      <nav className="nav-list">
        {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => onNavigate(id)} title={label}><Icon size={18} strokeWidth={1.5} /><span>{!collapsed && label}</span></button>)}
      </nav>
      {!collapsed && <div className="sidebar-cycle"><span>当前阶段</span><strong>能力与选择权积累</strong><em>CYCLE 01 / 12 WEEKS</em></div>}
      <div className="sidebar-bottom">
        <button type="button" className={`nav-item ${active === 'settings' ? 'active' : ''}`} onClick={() => onNavigate('settings')}><Settings2 size={18} strokeWidth={1.5} /><span>{!collapsed && '设置与数据'}</span></button>
        {!collapsed && <><span className="local-status"><i />本地优先</span><small>DESIGN REFERENCE · V2</small></>}
      </div>
    </aside>
  );
}

function Header({ state, onTheme, onReset }: { state: AppState; onTheme: () => void; onReset: () => void }) {
  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>工作台</span><ChevronRight size={14} aria-hidden="true" /><strong>{state.today === state.plan.start ? '今日' : '今日'}</strong></div>
      <div className="top-actions">
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
  const planned = state.tasks.filter((task) => task.scheduledDate && task.status !== 'completed').reduce((sum, task) => sum + task.minutes, 0);
  const used = state.records.reduce((sum, record) => sum + (record.actualMinutes ?? 0), 0);
  const status = state.settings.autoAdjust ? 'focused' : 'unknown';
  return (
    <div className="today-layout">
      <section className="today-left">
        <div className="page-kicker"><span>{formatDate(state.today)}</span><span className="capacity-pill"><Clock3 size={14} />标准周 · {hours(state.plan.capacityMinutes)}</span></div>
        <h1>今天，聚焦真正重要的事。</h1>
        <section className="priority-card panel">
          <div className="accent-line" />
          <span className="eyebrow">TODAY'S PRIORITY</span>
          <h2>{priority.title}</h2>
          <p>{priority.detail}。</p>
          <div className="task-meta"><span className="tag">主线 / 学习工具</span><span>{priority.minutes} 分钟</span><span>·</span><span>一个可验证的结果</span></div>
          <div className="priority-actions"><button type="button" className="primary-button" onClick={() => action(() => store.startTask(priority.id), '已开始专注')}><Play size={16} fill="currentColor" />开始专注</button><button type="button" className="secondary-button" onClick={() => onRecord(priority.id)}><FileText size={16} />记录进度</button><button type="button" className="text-button" onClick={() => onNavigate('plans')}>详情 <span aria-hidden="true">→</span></button></div>
        </section>
        <div className="section-heading"><h2>关键动作</h2><span>01 / 03</span></div>
        <section className="task-list panel">
          {visibleTasks.map((task) => <TaskRow key={task.id} task={task} onRecord={onRecord} />)}
        </section>
        <section className="outcome-card panel">
          <div><span className="eyebrow">本周唯一成果</span><strong>{state.plan.outcome}</strong></div>
          <div className="outcome-progress"><span>已用 {hours(used)} / 计划 {hours(state.plan.capacityMinutes)}</span><div className="progress-track"><i style={{ width: `${ratioPercent(used, state.plan.capacityMinutes)}%` }} /></div><button type="button" className="text-button" onClick={() => onNavigate('plans')}>周计划 →</button></div>
        </section>
      </section>
      <section className="today-right">
        <NorthstarCore theme={state.settings.theme} stage={state.growth.highestStage} status={status} reducedMotion={state.settings.reducedMotion} />
      </section>
    </div>
  );
}

function TaskRow({ task, onRecord }: { task: AppState['tasks'][number]; onRecord: (taskId: string) => void }) {
  const complete = task.status === 'completed';
  return <div className={`task-row ${complete ? 'complete' : ''}`}><button className="task-check" type="button" aria-label={`记录${task.title}`} onClick={() => onRecord(task.id)}>{complete ? <Check size={14} /> : <Circle size={18} />}</button><div className="task-copy"><strong>{task.title}</strong><span>{task.detail}</span></div><span className="task-time">{complete ? '已记录' : `${task.minutes} min`}</span></div>;
}

function PlansPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  const [capacity, setCapacity] = useState(state.plan.capacityMinutes);
  useEffect(() => setCapacity(state.plan.capacityMinutes), [state.plan.capacityMinutes]);
  const scheduled = state.tasks.filter((task) => task.scheduledDate && task.status !== 'completed');
  const scheduledMinutes = scheduled.reduce((sum, task) => sum + task.minutes, 0);
  const undo = () => action(() => store.undoLast(state.version), '已撤销上一批变更');
  const applyCapacity = (value: number) => action(() => { const result = store.setCapacity(value); if (result.conflict) throw new Error(result.conflict); }, `容量已调整为 ${hours(value)}`);
  return <div className="single-page"><PageTitle kicker="STRATEGY / PLAN" title="把长期方向，翻译成这一周。" subtitle="计划是可调整的草稿；已确认成果、锁定职责与历史事实有不同权限。" />
    <div className="plan-grid"><section className="panel plan-summary"><div className="stat-grid"><div><span>本周成果</span><strong>{state.plan.outcome}</strong></div><div><span>当前容量</span><strong>{hours(state.plan.capacityMinutes)}</strong></div><div><span>计划占用</span><strong>{hours(scheduledMinutes)}</strong></div></div><div className="capacity-control"><label htmlFor="capacity">容量：{hours(capacity)}</label><input id="capacity" type="range" min="0" max="840" step="30" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} onMouseUp={() => applyCapacity(capacity)} onKeyUp={(event) => { if (event.key === 'Enter') applyCapacity(capacity); }} /><div className="quick-capacity"><button type="button" className="text-button" onClick={() => { setCapacity(240); applyCapacity(240); }}>降至 4h</button><button type="button" className="text-button" onClick={() => { setCapacity(600); applyCapacity(600); }}>恢复 10h</button></div><small>容量下降时只会调整可选软排程；锁定职责和硬截止会生成冲突。</small></div><label className="switch-row"><input type="checkbox" checked={state.settings.autoAdjust} onChange={(event) => action(() => store.setAutoAdjust(event.target.checked), event.target.checked ? '已允许批准范围内自动调整' : '已关闭自动调整')} /><span className="switch" />允许批准范围内自动调整</label><div className="button-row"><button type="button" className="secondary-button" onClick={undo}><RotateCcw size={16} />撤销上一批变更</button></div></section><section className="panel plan-tasks"><div className="section-heading"><h2>本周排程</h2><span>{scheduled.length} 个事项</span></div>{state.tasks.map((task) => <div className="compact-task" key={task.id}><span className={`status-dot ${task.status}`} /> <div><strong>{task.title}</strong><small>{task.scheduledDate ?? '未安排'} · {task.minutes} min {task.pinned ? '· 锁定' : ''}</small></div></div>)}</section></div>
    <section className="audit-panel"><div><span className="eyebrow">领域回执</span><strong>每次变更都有版本、审计和撤销边界。</strong></div><span>当前版本 v{state.version}</span><button type="button" className="text-button" onClick={() => action(() => { const blob = new Blob([store.exportData()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'northstar-export.json'; anchor.click(); URL.revokeObjectURL(url); }, '已导出不含凭据的数据快照')}><Download size={14} />导出快照</button></section>
  </div>;
}

function ReviewPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  const metric = completionMetric(state.records);
  const latest = state.proposals.at(-1);
  return <div className="review-layout"><section className="review-main"><PageTitle kicker="WEEKLY REVIEW / CURRENT CYCLE" title="让计划，重新贴合现实。" subtitle="先展示事实与覆盖度，再给出需要你确认的建议。缺失数据不会被当成零。" /><section className="metric-card panel"><div><span>本周计划</span><strong>{hours(state.plan.capacityMinutes)}</strong></div><div><span>实际记录</span><strong>{hours(state.records.reduce((sum, item) => sum + (item.actualMinutes ?? 0), 0))}</strong></div><div><span>记录覆盖度</span><strong>{metric.coverage ? `${Math.round(metric.coverage * 100)}%` : '未知'}</strong></div><small>{metric.rate === null ? '数据不足，暂不计算完成率。' : `完成率 ${Math.round(metric.rate * 100)}% · 仅基于已记录事项`}</small></section><div className="section-heading"><h2>AI 复盘判断</h2><span className="tag">推断 · 待确认</span></div><section className="proposal-card panel"><h2>{latest?.summary ?? '还没有新的复盘提案。'}</h2><p>{latest?.reason ?? '完成一周记录后生成提案；提案不会直接改变战略层。'}</p>{latest && latest.status === 'pending' && <div className="proposal-actions"><button type="button" className="primary-button" onClick={() => action(() => store.approveProposal(latest.id), '提案已批准')}>批准提案</button><button type="button" className="secondary-button" onClick={() => action(() => store.rejectProposal(latest.id), '提案已驳回')}>暂不调整</button></div>}<button type="button" className="text-button" onClick={() => action(() => store.createReviewProposal(), '已生成待确认提案')}>{latest ? '重新生成提案' : '生成复盘提案'} <ChevronRight size={15} /></button></section></section><aside className="review-aside panel"><div className="aside-header"><h2>战略会话</h2><span className="tag">复盘模式</span></div><NorthstarCore theme={state.settings.theme} stage={state.growth.highestStage} status="focused" reducedMotion={state.settings.reducedMotion} /><div className="conversation-bubble">下周只有 {hours(Math.max(0, state.plan.capacityMinutes - 360))}。<br />保留主线，帮我把范围收窄。</div><span className="eyebrow">NORTHSTAR</span><h3>先保留核心验证，延后可选扩展。</h3><p>周排程可以按授权重排；月度目标的变化只提交提案，由你决定是否生效。</p></aside></div>;
}

function IdeasPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  const [idea, setIdea] = useState('');
  const statuses: Record<IdeaStatus, string> = { cooling: '冷却中', extended: '已延长', promoted: '已升级', abandoned: '已放弃' };
  return <div className="single-page"><PageTitle kicker="PARKING LOT" title="灵感先停在这里。" subtitle="新想法默认冷却 14 天；它可以被编辑、延长或放弃，不会悄悄变成第二条主线。" /><form className="inline-form panel" onSubmit={(event) => { event.preventDefault(); action(() => { store.addIdea(idea); setIdea(''); }, '已加入冷却期'); }}><input value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="记录一个想法，不急着执行" aria-label="新想法" /><button className="primary-button" type="submit" disabled={!idea.trim()}>放入停车场</button></form><div className="idea-list">{state.ideas.map((item) => <article className="panel idea-card" key={item.id}><div><span className={`tag status-${item.status}`}>{statuses[item.status]}</span><h2>{item.content}</h2><p>冷却至 {item.coolUntil} · 到期后再决定是否升级</p></div><div className="button-row">{item.status === 'cooling' && <button type="button" className="secondary-button" onClick={() => action(() => store.updateIdea(item.id, 'extended'), '已延长冷却期')}>延长</button>}<button type="button" className="text-button danger-text" onClick={() => action(() => store.updateIdea(item.id, 'abandoned'), '已放弃该想法')}><Trash2 size={14} />放弃</button></div></article>)}</div></div>;
}

function MemoryPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  return <div className="single-page"><PageTitle kicker="MEMORY" title="只保留你确认过的东西。" subtitle="候选记忆与已确认陈述分开；删除会立即排除后续检索，旧备份需另行处理。" /><div className="memory-list">{state.memories.filter((memory) => memory.status !== 'deleted').map((memory) => <article className="panel memory-card" key={memory.id}><div className="memory-type"><span className="tag">{memory.kind === 'statement' ? '陈述' : memory.kind === 'observation' ? '行为' : '推断'}</span><span>{memory.status === 'candidate' ? '待确认' : '已确认'}</span></div><h2>{memory.content}</h2><p>来源：{memory.sourceIds.join('、') || '用户直接输入'}</p><div className="button-row">{memory.status === 'candidate' && <button type="button" className="primary-button" onClick={() => action(() => store.confirmMemory(memory.id), '记忆已确认')}>确认记忆</button>}<button type="button" className="text-button danger-text" onClick={() => action(() => store.deleteMemory(memory.id), '记忆已删除')}><Trash2 size={14} />删除</button></div></article>)}</div></div>;
}

function SettingsPage({ state, action }: { state: AppState; action: (fn: () => void, success: string) => void }) {
  return <div className="single-page"><PageTitle kicker="SETTINGS / LOCAL ONLY" title="把边界设清楚，再让工具帮忙。" subtitle="当前版本不连接云端、账号或外部平台；没有 Key 也能完成手动规划、记录、复盘和导出。" /><div className="settings-grid"><section className="panel settings-card"><h2>显示</h2><label className="setting-row"><span>主题</span><button type="button" className="secondary-button" onClick={() => action(() => store.setTheme(state.settings.theme === 'dark' ? 'light' : 'dark'), '主题已切换')}>{state.settings.theme === 'dark' ? '深色' : '浅色'}</button></label><label className="setting-row"><span>减少动效</span><input type="checkbox" checked={state.settings.reducedMotion} onChange={(event) => action(() => store.setReducedMotion(event.target.checked), event.target.checked ? '已减少动效' : '已恢复动效')} /></label></section><section className="panel settings-card"><h2>AI 权限</h2><p className="muted-copy">AI 只能提出候选命令；本地领域层仍会检查版本、容量、锁定项和权限。</p><label className="setting-row"><span>敏感上下文授权</span><input type="checkbox" checked={state.settings.privacySensitiveContext} onChange={(event) => action(() => store.setPrivacySensitiveContext(event.target.checked), event.target.checked ? '已授权敏感上下文' : '已关闭敏感上下文')} /></label><div className="provider-state"><span className="status-dot" />Provider 未配置 · 无 Key 演示模式</div></section><section className="panel settings-card"><h2>本地数据</h2><p className="muted-copy">当前开发版使用浏览器本地持久化，重启开发窗口后仍保留。SQLite 一致性备份和 Windows 凭据库等待 Tauri/Rust 环境。</p><button type="button" className="secondary-button" onClick={() => action(() => { const blob = new Blob([store.exportData()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'northstar-export.json'; anchor.click(); URL.revokeObjectURL(url); }, '已导出本地快照')}><Download size={16} />导出 JSON</button></section></div></div>;
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
