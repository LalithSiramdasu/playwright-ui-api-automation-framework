import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, Code2,
  Copy, Download, ExternalLink, FileCode2, FileText, Filter, GitBranch,
  Github, Layers3, LayoutDashboard, ListChecks, LoaderCircle, Menu,
  Monitor, MoreHorizontal, Play, RefreshCw, Search, Server, Settings2,
  ShieldCheck, ShieldAlert, Square, TerminalSquare, TrendingUp, X,
  XCircle, Zap, AlertCircle,
} from 'lucide-react';
import { runsForProject, enabledProjects, selectableSuites, chooseSuite, effectiveBrowser, dashboardCanExecuteEnvironment } from './project-selection.mjs';
import ReportsWorkbench from './ReportsWorkbench.jsx';

const nav = [
  { id: 'overview', name: 'Overview', icon: LayoutDashboard },
  { id: 'runs', name: 'Test runs', icon: ListChecks },
  { id: 'suites', name: 'Test suites', icon: Layers3 },
  { id: 'reports', name: 'Reports', icon: BarChart3 },
  { id: 'setup', name: 'Environment', icon: Settings2 },
];
const defaultSuites = [
  { id: 'all', name: 'Full validation', description: 'UI and API across projects' },
  { id: 'smoke', name: 'Smoke suite', description: 'Critical-path checks' },
  { id: 'regression', name: 'Regression', description: 'Broader behavior coverage' },
  { id: 'ui', name: 'Browser UI', description: 'End-to-end browser tests' },
  { id: 'api', name: 'REST API', description: 'HTTP contracts and responses' },
  { id: 'negative', name: 'Negative paths', description: 'Validation and error cases' },
  { id: 'accessibility', name: 'Accessibility', description: 'Keyboard and label checks' },
];
const suiteIcons = {
  all: Layers3, smoke: Zap, regression: ShieldCheck, ui: Monitor,
  api: Server, negative: ShieldAlert, accessibility: Activity,
};
const codeCommand = 'npm install && npx playwright install';
const statusText = { passed: 'Passed', failed: 'Failed', running: 'Running', cancelling: 'Stopping', cancelled: 'Cancelled', interrupted: 'Interrupted' };
const fmtDate = (value) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const fmtDuration = (ms) => ms == null ? '—' : ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`;
const percent = (pass, total) => total > 0 ? Math.round((pass / total) * 100) : null;
const trimTitle = (title) => title?.split(' / ').slice(-2).join(' / ') || 'Unnamed case';

async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}
function StatusPill({ status }) {
  return <span className={`status-pill status-${status ?? 'unknown'}`}>
    <span className="status-dot" />{statusText[status] ?? 'Unknown'}
  </span>;
}
function Empty({ icon: Icon = Activity, title, detail, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={23} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
function SectionHeader({ eyebrow, title, action }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}
function IconButton({ children, ...props }) { return <button type="button" className="icon-button" {...props}>{children}</button>; }
function MiniTrend({ runs }) {
  const values = runs.filter((run) => run.counts?.total > 0).slice(0, 12).reverse()
    .map((run) => percent(run.counts.passed, run.counts.total));
  if (values.length < 2) return <div className="empty-chart"><Activity size={26} /><span>Trend appears after at least two completed runs</span></div>;
  const x = (index) => 18 + index * 664 / (values.length - 1);
  const y = (value) => 170 - value * 1.32;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const area = `M${x(0)},186 L${points.replaceAll(' ', ' L')} L${x(values.length - 1)},186 Z`;
  return <div className="trend-chart"><svg viewBox="0 0 700 200" preserveAspectRatio="none" role="img" aria-label="Recent test pass-rate trend">
    <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#56E8BE" stopOpacity=".23" /><stop offset="1" stopColor="#56E8BE" stopOpacity="0" /></linearGradient></defs>
    {[25, 75, 125, 175].map((line) => <line key={line} x1="0" x2="700" y1={line} y2={line} stroke="#273246" strokeDasharray="4 7" />)}
    <path d={area} fill="url(#chart-fill)" /><polyline fill="none" stroke="#56E8BE" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points} />
    {values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="4.5" fill="#56E8BE" stroke="#111a2c" strokeWidth="3" />)}
  </svg><span>Older runs</span><span>Most recent</span></div>;
}
function RunRow({ run, onClick }) {
  const done = run.counts;
  return <button type="button" className="run-row" onClick={onClick}>
    <div className={`run-symbol run-${run.status}`}>{run.status === 'passed' ? <Check size={17} /> : run.status === 'failed' ? <X size={17} /> : run.status === 'running' || run.status === 'cancelling' ? <LoaderCircle size={17} className="spin" /> : <Clock3 size={17} />}</div>
    <div className="run-main"><strong>{run.suite === 'all' ? 'Full validation' : `${run.suite[0].toUpperCase()}${run.suite.slice(1)} tests`}</strong><span>{run.browser === 'all' ? 'All applicable browsers' : run.browser} <span className="inline-dot">·</span> {fmtDate(run.startedAt)}</span></div>
    <span className="run-result">{done ? <><span className="ok-text">{done.passed} passed</span>{done.failed > 0 && <span className="fail-text">{done.failed} failed</span>}</> : <span className="muted">Awaiting results</span>}</span>
    <span className="run-time">{run.finishedAt ? fmtDuration(run.durationMs) : 'Live'}</span>
    <ChevronRight size={17} className="muted" />
  </button>;
}
function StatCard({ icon: Icon, label, value, detail, variant }) {
  return <div className={`stat-card ${variant ?? ''}`}><div className="stat-card-top"><span>{label}</span><span className="stat-icon"><Icon size={19} /></span></div><div className="stat-value">{value}</div><p>{detail}</p></div>;
}

export default function App() {
  const [view, setView] = useState('overview');
  const [runs, setRuns] = useState([]);
  const [suites, setSuites] = useState(defaultSuites);
  const [health, setHealth] = useState(null);
  const [projects, setProjects] = useState([]);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [projectId, setProjectId] = useState('northline-goods');
  const [environment, setEnvironment] = useState('local');
  const [suite, setSuite] = useState('smoke');
  const [browser, setBrowser] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, status, suiteList, registry] = await Promise.all([api('/api/runs'), api('/api/health'), api('/api/suites'), api('/api/projects')]);
      setRuns(list.runs);
      setHealth(status);
      setSuites(suiteList.suites);
      setProjects(registry.projects);
      setRegistryLoaded(true);
      setRefreshError('');
    } catch (error) {
      // Do not leave a stale "runner available" indication after data loss.
      setHealth(null);
      setRefreshError(error.message);
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    const load = async () => { try { const data = await api(`/api/runs/${selectedId}`); if (!cancelled) setDetail(data.run); } catch (error) { if (!cancelled) setAlert(error.message); } };
    load(); const timer = setInterval(load, 1800);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selectedId]);
  const availableProjects = useMemo(() => enabledProjects(projects), [projects]);
  const selectedProject = availableProjects.find((project) => project.id === projectId) ?? null;
  const environments = selectedProject?.environments ?? [];
  const selectedEnvironment = selectedProject?.environmentDetails?.find((target) => target.id === environment);
  const allowedSuites = useMemo(() => selectableSuites(suites, selectedProject), [suites, selectedProject]);
  const allowedSuite = allowedSuites.some((item) => item.id === suite);
  const browserChoice = effectiveBrowser(selectedProject, suite, browser);
  const scopedRuns = useMemo(() => runsForProject(runs, projectId, environment), [runs, projectId, environment]);
  const completed = useMemo(() => scopedRuns.filter((run) => run.counts && ['passed','failed','cancelled','interrupted'].includes(run.status)), [scopedRuns]);
  const totalTests = completed.reduce((sum, run) => sum + run.counts.total, 0);
  const passedTests = completed.reduce((sum, run) => sum + run.counts.passed, 0);
  const failedTests = completed.reduce((sum, run) => sum + run.counts.failed, 0);
  const last = completed[0];
  const active = runs.find((run) => run.status === 'running' || run.status === 'cancelling');
  const selectedSuite = allowedSuites.find((item) => item.id === suite) || allowedSuites[0];
  const visibleRuns = scopedRuns.filter((run) => (filter === 'all' || run.status === filter) && `${run.suite} ${run.browser} ${run.id}`.toLowerCase().includes(search.toLowerCase()));
  const pickProject = (id) => {
    const next = availableProjects.find((project) => project.id === id);
    if (!next) return;
    setProjectId(next.id);
    setEnvironment(next.environments.includes('local') ? 'local' : next.environments[0]);
    setSuite(chooseSuite(next, suites));
    setBrowser('all');
    setSelectedId(null);
    setDetail(null);
    setFilter('all');
    setSearch('');
  };
  const pickEnvironment = (next) => {
    if (!environments.includes(next)) return;
    setEnvironment(next);
    setSelectedId(null);
    setDetail(null);
    setFilter('all');
    setSearch('');
  };
  const pickSuite = (next) => {
    if (!allowedSuites.some((item) => item.id === next)) return;
    setSuite(next);
    if (next === 'api' || selectedProject?.type === 'api') setBrowser('all');
  };
  const chooseView = (name) => { setView(name); setMenuOpen(false); };
  const openRun = (run) => { setSelectedId(run.id); setView('runs'); };
  const execute = async () => {
    setBusy(true); setAlert('');
    try {
      const data = await api('/api/runs', { method: 'POST', body: JSON.stringify({ projectId, environment, suite, browser: browserChoice }) });
      setSelectedId(data.run.id); setView('runs'); await refresh();
    } catch (error) { setAlert(error.message); }
    finally { setBusy(false); }
  };
  const stopRun = async () => {
    if (!active) return;
    try { await api(`/api/runs/${active.id}/cancel`, { method: 'POST', body: '{}' }); await refresh(); }
    catch (error) { setAlert(error.message); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(codeCommand); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setAlert('Copy unavailable; select the command manually.'); } };
  const canRun = Boolean(registryLoaded && selectedProject && dashboardCanExecuteEnvironment(selectedEnvironment) && environments.includes(environment) && allowedSuite && health?.dependenciesReady && !busy && !active);
  const runButton = <button className="primary-button" type="button" onClick={execute} disabled={!canRun}>
    {busy ? <LoaderCircle className="spin" size={16} /> : <Play size={16} fill="currentColor" />}
    {selectedEnvironment?.remote ? 'Use approved CLI for external tests' : active ? 'Run in progress' : 'Run selected suite'}
  </button>;

  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Activity size={24} strokeWidth={2.7} /></div><div><strong>QA CONTROL</strong><span>ENGINEERING CONSOLE</span></div></div>
      <div className="workspace-pill"><span className="workspace-avatar">P</span><div><strong>{selectedProject?.name ?? 'Playwright workspace'}</strong><span>{environment} · {selectedProject?.type ?? 'loading'}</span></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Dashboard pages">{nav.map(({ id, name, icon: Icon }) => <button className={`nav-link ${view === id ? 'nav-active' : ''}`} aria-current={view === id ? 'page' : undefined} key={id} onClick={() => chooseView(id)} type="button"><Icon size={18} /><span>{name}</span>{id === 'runs' && scopedRuns.length > 0 && <span className="nav-counter">{scopedRuns.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="system-state"><span className={`live-dot ${health?.dependenciesReady ? '' : 'warning-dot'}`} /><div><strong>{health?.dependenciesReady ? 'Runner available' : 'Setup required'}</strong><span>{health?.dependenciesReady ? 'Local runner ready' : 'Install root dependencies'}</span></div></div><a href="https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework" target="_blank" rel="noopener noreferrer" className="repository-link"><Github size={17} /> GitHub repository <ExternalLink size={14} /></a></div>
    </aside>
    <main className="main" id="main-content" tabIndex={-1}>
      <header className="topbar"><div className="topbar-left"><IconButton aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}><Menu size={19} /></IconButton><span className="breadcrumbs">Workspace <ChevronRight size={14} /> <strong>{nav.find((item) => item.id === view)?.name}</strong></span></div><div className="topbar-right"><span className="local-tag"><span className="live-dot" /> {environment.toUpperCase()} ENVIRONMENT</span><IconButton aria-label="Refresh results" onClick={refresh}><RefreshCw size={18} /></IconButton><div className="user-avatar">QA</div></div></header>
      <div className="content">
        {refreshError && <div className="alert" role="alert"><AlertCircle size={17} /><span>Dashboard data unavailable: {refreshError}</span><IconButton aria-label="Retry dashboard data" onClick={refresh}><RefreshCw size={17} /></IconButton></div>}
        {alert && <div className="alert" role="alert"><AlertCircle size={17} /><span>{alert}</span><IconButton aria-label="Dismiss message" onClick={() => setAlert('')}><X size={17} /></IconButton></div>}
        <section className="project-context" aria-label="Testing target">
          <div className="context-intro"><span className="eyebrow">ACTIVE TEST TARGET</span><strong>{selectedProject?.name ?? 'Loading registered projects…'}</strong><small>{selectedProject?.type === 'api' ? 'REST API testing' : selectedProject?.type === 'web' ? 'Browser website testing' : 'Website and REST API testing'}</small></div>
          <div className="context-field"><label htmlFor="project-select">PROJECT</label><select id="project-select" value={projectId} onChange={(event) => pickProject(event.target.value)} disabled={!registryLoaded || !availableProjects.length}>{projects.map((project) => <option key={project.id} value={project.id} disabled={!project.enabled}>{project.name}{project.enabled ? '' : ' — not configured'}</option>)}</select></div>
          <div className="context-field"><label htmlFor="environment-select">ENVIRONMENT</label><select id="environment-select" value={environment} onChange={(event) => pickEnvironment(event.target.value)} disabled={!selectedProject}>{environments.map((name) => <option key={name} value={name}>{name}{selectedProject?.environmentDetails?.find((item) => item.id === name)?.readOnly ? ' · read-only' : ''}</option>)}</select></div>
          <span className={`context-status ${selectedEnvironment?.readOnly ? 'context-status-restricted' : ''}`}>{selectedEnvironment?.remote ? 'Approval required' : selectedEnvironment?.readOnly ? 'Read-only tests' : 'Local test target'}</span>
        </section>
        {selectedEnvironment?.remote && <div className="context-warning" role="note">External testing requires prior authorization and server-side approval. The dashboard cannot bypass the safety policy.</div>}
        {!selectedProject && registryLoaded && <div className="alert" role="alert">No enabled test project is available. Check project profiles.</div>}
        {view === 'overview' && <>
          <div className="hero"><div><span className="eyebrow"><span className="eyebrow-line" /> TEST OPERATIONS / OVERVIEW</span><h1>Quality at a glance<span className="accent-period">.</span></h1><p>Real test outcomes. One command center for UI, API and regression validation.</p></div><div className="hero-aside"><span className="hero-date">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())}</span>{runButton}</div></div>
          <div className="stats-grid"><StatCard icon={ListChecks} label="Tests executed" value={totalTests ? totalTests.toLocaleString() : '—'} detail={`${completed.length} completed ${completed.length === 1 ? 'run' : 'runs'}`} /><StatCard icon={CheckCircle2} label="Pass rate" value={totalTests ? `${percent(passedTests, totalTests)}%` : '—'} detail={`${passedTests} passed tests`} variant="mint" /><StatCard icon={XCircle} label="Failed tests" value={totalTests ? String(failedTests) : '—'} detail={totalTests ? (failedTests ? 'Investigate run details' : 'No recorded failures') : 'No completed test runs'} variant="rose" /><StatCard icon={Clock3} label="Latest execution" value={last ? fmtDuration(last.durationMs) : '—'} detail={last ? `${last.suite} · ${fmtDate(last.startedAt)}` : 'No runs recorded yet'} /></div>
          <div className="overview-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Execution quality</h2><p>Pass rate across recent completed runs</p></div><span className="small-badge"><TrendingUp size={14} /> Real results</span></div><MiniTrend runs={scopedRuns} /></section>
            <section className="panel launch-panel"><div className="panel-heading"><div><h2>Launch a test run</h2><p>Choose a suite supported by {selectedProject?.name ?? 'the selected project'}</p></div><div className="launch-icon"><Zap size={20} /></div></div><label className="field-label" htmlFor="suite-select">TEST SUITE</label><select id="suite-select" value={allowedSuite ? suite : (selectedSuite?.id ?? '')} onChange={(e) => pickSuite(e.target.value)} disabled={!selectedProject}>{allowedSuites.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><p className="field-hint">{selectedSuite?.description}</p><label className="field-label" htmlFor="browser-select">BROWSER PROJECT</label><select id="browser-select" value={browserChoice} onChange={(e) => setBrowser(e.target.value)} disabled={selectedProject?.type === 'api' || suite === 'api'}><option value="all">All applicable browsers</option><option value="chromium">Chromium</option><option value="firefox">Firefox</option><option value="webkit">WebKit</option></select><p className="field-hint">API-only runs do not require a browser. A specific browser excludes API cases.</p>{runButton}{active && <button className="text-button" type="button" onClick={stopRun}><Square size={13} /> Stop active run</button>}</section></div>
          <section className="panel runs-panel"><div className="panel-heading"><div><h2>Recent executions</h2><p>Live status from the local Playwright runner</p></div><button type="button" className="ghost-action" onClick={() => chooseView('runs')}>View all <ArrowRight size={16} /></button></div>{scopedRuns.length ? <div>{scopedRuns.slice(0, 5).map((run) => <RunRow key={run.id} run={run} onClick={() => openRun(run)} />)}</div> : <Empty icon={TerminalSquare} title="No executions yet" detail="Choose a suite above and launch your first test run. Metrics will populate from actual results." />}</section>
        </>}
        {view === 'runs' && <><div className="page-header"><div><span className="eyebrow">TEST EXECUTION</span><h1>Test runs<span className="accent-period">.</span></h1><p>Inspect live logs, failures, retries and run evidence.</p></div>{runButton}</div><div className="runs-layout"><section className="panel history-panel"><div className="panel-heading"><div><h2>Run history</h2><p>{scopedRuns.length} executions for {selectedProject?.name ?? projectId} / {environment}</p></div><div className="filter-row"><div className="search-wrap"><Search size={16} /><input aria-label="Search runs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search runs" /></div><select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All statuses</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="running">Running</option><option value="cancelled">Cancelled</option></select></div></div>{visibleRuns.length ? visibleRuns.map((run) => <RunRow key={run.id} run={run} onClick={() => setSelectedId(run.id)} />) : <Empty icon={Filter} title="No matching executions" detail="Clear filters or run a suite to create an execution record." />}</section><section className="panel detail-panel"><div className="panel-heading"><div><h2>Execution details</h2><p>{detail ? `Run ${detail.id.slice(0, 8)}` : 'Select a run to inspect it'}</p></div>{detail && <StatusPill status={detail.status} />}</div>{detail && scopedRuns.some((run) => run.id === detail.id) ? <><div className="detail-metrics"><div><span>Tests</span><strong>{detail.counts?.total ?? '—'}</strong></div><div><span>Passed</span><strong className="ok-text">{detail.counts?.passed ?? '—'}</strong></div><div><span>Failed</span><strong className="fail-text">{detail.counts?.failed ?? '—'}</strong></div><div><span>Duration</span><strong>{fmtDuration(detail.durationMs || (Date.now() - Date.parse(detail.startedAt)))}</strong></div></div><div className="detail-meta"><span>{detail.projectId ?? 'northline-goods'} / {detail.environment ?? 'local'} · {detail.suite} · {detail.browser}</span><span>{fmtDate(detail.startedAt)}</span></div><div className="detail-actions">{detail.reportAvailable && <a href={`/reports/${detail.id}/`} target="_blank" rel="noopener noreferrer" className="outline-button"><FileText size={15} /> HTML report <ExternalLink size={14} /></a>}{active?.id === detail.id && <button className="outline-button stop-button" type="button" onClick={stopRun}><Square size={13} /> Stop run</button>}</div><h3 className="minor-heading">Test cases</h3>{detail.cases?.length ? <div className="test-cases">{detail.cases.map((test, i) => <details key={`${test.title}-${i}`} className="case-row"><summary><span className={test.status === 'failed' ? 'fail-text' : 'ok-text'}>{test.status === 'failed' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}</span><span className="case-name">{trimTitle(test.title)}<small>{test.project} · {test.status} · {fmtDuration(test.durationMs)}{test.retries > 0 ? ` · ${test.retries} retry attempt(s)` : ''}</small></span><ChevronDown size={14} /></summary>{test.error && <pre className="case-error">{test.error}</pre>}</details>)}</div> : <p className="detail-placeholder">{detail.status === 'running' ? 'Tests are running. Cases will appear when the report completes.' : 'No structured test results available for this run.'}</p>}<h3 className="minor-heading">Execution log <span className="live-caption">{detail.status === 'running' ? 'LIVE' : 'ARCHIVED'}</span></h3><div className="console" role="log" aria-label="Execution logs">{detail.logs?.length ? detail.logs.slice(-120).join('\n') : 'Waiting for output…'}</div></> : <Empty icon={FileCode2} title="Select a test run" detail="Choose an execution on the left to view test cases, logs and downloadable reports." />}</section></div></>}
        {view === 'suites' && <><div className="page-header"><div><span className="eyebrow">TEST COVERAGE</span><h1>Test suites<span className="accent-period">.</span></h1><p>Purpose-built suites powered by reusable Playwright fixtures.</p></div>{runButton}</div><div className="suite-grid">{allowedSuites.map((item, i) => { const Icon = suiteIcons[item.id] ?? Layers3; return <button type="button" onClick={() => { pickSuite(item.id); chooseView('overview'); }} className={`suite-card ${suite === item.id ? 'suite-selected' : ''}`} key={item.id}><div className={`suite-icon tone-${i % 4}`}><Icon size={22} /></div><div><strong>{item.name}</strong><p>{item.description}</p></div><div className="suite-foot"><span>{scopedRuns.filter((run) => run.suite === item.id).length} past runs</span><span className="suite-action">Select suite <ArrowUpRight size={14} /></span></div></button>; })}</div><div className="notice"><CircleHelp size={20} /><div><strong>How suite selection works</strong><p>Smoke, regression, negative, and accessibility use test tags. UI and API suites filter by directory. Selecting a single browser runs that project only; API cases are excluded in that mode.</p></div></div></>}
        {view === 'reports' && <><div className="page-header"><div><span className="eyebrow">EVIDENCE &amp; ANALYTICS</span><h1>Reports<span className="accent-period">.</span></h1><p>Shareable HTML reports generated by actual Playwright executions.</p></div><button className="outline-button" onClick={refresh} type="button"><RefreshCw size={16} /> Refresh</button></div><section className="panel reports-panel"><div className="panel-heading"><div><h2>Available reports</h2><p>Reports are stored locally and are not published publicly by this dashboard</p></div><span className="small-badge">{scopedRuns.filter((run) => run.reportAvailable).length} available</span></div>{scopedRuns.some((run) => run.reportAvailable) ? scopedRuns.filter((run) => run.reportAvailable).map((run) => <div className="report-row" key={run.id}><div className="report-icon"><FileText size={19} /></div><div><strong>{run.projectId ?? 'northline-goods'} / {run.environment ?? 'local'} / {run.suite} / {run.browser}</strong><span>{fmtDate(run.startedAt)} · {run.counts?.total ?? '—'} test cases</span></div><StatusPill status={run.status} /><a href={`/reports/${run.id}/`} target="_blank" rel="noopener noreferrer" className="outline-button">Open <ExternalLink size={14} /></a></div>) : <Empty icon={FileText} title="No reports generated" detail="Run a suite from the Overview tab. The HTML report link will appear here after execution." />}</section></>}
        {view === 'reports' && <ReportsWorkbench key={`${projectId}/${environment}`} projectId={projectId} environment={environment} runs={scopedRuns} active={active} refresh={refresh} onDeleted={(runId) => { if (!runId || selectedId === runId) { setSelectedId(null); setDetail(null); } }} reportError={setAlert} />}
        {view === 'setup' && <><div className="page-header"><div><span className="eyebrow">LOCAL DEVELOPMENT</span><h1>Environment<span className="accent-period">.</span></h1><p>Runner readiness, active project scope, and project onboarding.</p></div></div><div className="setup-grid"><section className="panel setup-panel"><div className="panel-heading"><div><h2>System readiness</h2><p>Environment checks on this machine</p></div><Server size={20} className="muted" /></div><div className="readiness-row"><span>Node.js runtime</span><strong>{health?.node ?? 'Checking…'}</strong></div><div className="readiness-row"><span>Playwright dependencies</span><strong className={health?.dependenciesReady ? 'ok-text' : 'fail-text'}>{health?.dependenciesReady ? 'Installed' : 'Missing'}</strong></div><div className="readiness-row"><span>Dashboard API</span><strong className={health ? 'ok-text' : 'fail-text'}>{health ? 'Connected' : 'Unavailable'}</strong></div><div className="readiness-row"><span>Running process</span><strong>{active ? `${active.projectId ?? 'northline-goods'} / ${active.suite}` : 'Idle'}</strong></div><div className="readiness-row"><span>Selected project</span><strong>{selectedProject?.name ?? 'Unavailable'}</strong></div><div className="readiness-row"><span>Selected environment</span><strong>{environment}</strong></div></section><section className="panel setup-panel"><div className="panel-heading"><div><h2>Setup commands</h2><p>Run these from the repository root</p></div><Code2 size={20} className="muted" /></div><div className="code-command"><code>{codeCommand}</code><IconButton onClick={copy} aria-label="Copy install command">{copied ? <Check size={17} /> : <Copy size={17} />}</IconButton></div><p className="setup-tip">This installs the Playwright test runner and browser engines. The dashboard does not install dependencies or execute commands from user input.</p><a className="documentation-link" href="https://github.com/LalithSiramdasu/playwright-ui-api-automation-framework/blob/main/docs/DASHBOARD.md" target="_blank" rel="noopener noreferrer">Read dashboard documentation <ArrowUpRight size={16} /></a></section></div></>}
        <footer><span>QA CONTROL CENTER <span className="inline-dot">/</span> LOCAL TEST OPERATIONS</span><span>Powered by Playwright · TypeScript · React</span></footer>
      </div>
    </main>
  </div>;
}
