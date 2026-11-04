import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Download, Trash2, TrendingUp } from 'lucide-react';

async function request(path, init) {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

/** All tools operate on the currently selected, validated project/environment. */
export default function ReportsWorkbench({ projectId, environment, runs, active, refresh, onDeleted, reportError }) {
  const [olderId, setOlderId] = useState('');
  const [newerId, setNewerId] = useState('');
  const [comparison, setComparison] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const done = useMemo(() => runs.filter((run) => run.counts && ['passed', 'failed', 'interrupted', 'cancelled'].includes(run.status)), [runs]);
  const older = done.some((run) => run.id === olderId) ? olderId : done[1]?.id ?? '';
  const newer = done.some((run) => run.id === newerId) ? newerId : done[0]?.id ?? '';
  const counts = done.reduce((acc, run) => {
    acc.flaky += run.counts.flaky ?? 0;
    acc.retries += run.counts.retries ?? 0;
    return acc;
  }, { flaky: 0, retries: 0 });
  const query = new URLSearchParams({ projectId, environment });
  useEffect(() => { setComparison(null); setConfirmText(''); setOlderId(''); setNewerId(''); }, [projectId, environment]);

  const compare = async () => {
    if (!older || !newer || older === newer) return;
    setBusy(true);
    try { const result = await request(`/api/runs/${newer}/compare?with=${older}`); setComparison(result.comparison); }
    catch (error) { reportError(error.message); }
    finally { setBusy(false); }
  };
  const deleteOne = async (run) => {
    if (!window.confirm(`Delete ${run.id.slice(0, 8)} and its local reports? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await request(`/api/runs/${run.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: run.id }) });
      setComparison(null);
      await refresh();
      onDeleted(run.id);
    } catch (error) { reportError(error.message); }
    finally { setBusy(false); }
  };
  const clearHistory = async () => {
    if (confirmText !== 'DELETE HISTORY') return;
    setBusy(true);
    try {
      await request('/api/history', { method: 'DELETE', body: JSON.stringify({ projectId, environment, confirm: confirmText }) });
      setConfirmText(''); setComparison(null);
      await refresh(); onDeleted(null);
    } catch (error) { reportError(error.message); }
    finally { setBusy(false); }
  };

  return <div className="reporting-workbench">
    <section className="panel reporting-operations" aria-label="Results export">
      <div className="panel-heading"><div><h2>Export project results</h2><p>Downloads include summary counts and metadata, not raw logs or secrets</p></div><Download size={19} /></div>
      <div className="reporting-content reporting-row">
        <a className="outline-button" href={`/api/exports?${query}&format=csv`} download><Download size={15} /> Export CSV</a>
        <a className="outline-button" href={`/api/exports?${query}&format=json`} download><Download size={15} /> Export JSON</a>
        <span className="reporting-muted">{runs.length} stored run(s) · {counts.flaky} flaky case(s) · {counts.retries} retry attempt(s)</span>
      </div>
    </section>
    <section className="panel reporting-operations" aria-label="Compare test runs">
      <div className="panel-heading"><div><h2>Compare executions</h2><p>Check changes in failures, flaky cases and duration between completed runs</p></div><ArrowLeftRight size={19} /></div>
      <div className="reporting-content">
        <div className="reporting-row">
          <label>Older run <select aria-label="Older run" value={older} onChange={(event) => { setOlderId(event.target.value); setComparison(null); }}>{done.map((run) => <option key={run.id} value={run.id}>{run.id.slice(0, 8)} · {run.suite} · {run.status}</option>)}</select></label>
          <label>Newer run <select aria-label="Newer run" value={newer} onChange={(event) => { setNewerId(event.target.value); setComparison(null); }}>{done.map((run) => <option key={run.id} value={run.id}>{run.id.slice(0, 8)} · {run.suite} · {run.status}</option>)}</select></label>
          <button className="outline-button" type="button" onClick={compare} disabled={busy || !older || !newer || older === newer}>Compare runs</button>
        </div>
        {comparison ? <div className="comparison-result" role="status"><TrendingUp size={18} /><div>
          <strong>Passes {comparison.delta.passed >= 0 ? '+' : ''}{comparison.delta.passed} · Failures {comparison.delta.failed >= 0 ? '+' : ''}{comparison.delta.failed} · Flaky {comparison.delta.flaky >= 0 ? '+' : ''}{comparison.delta.flaky}</strong>
          <p>Matching cases: {comparison.comparableCases} · Resolved failures: {comparison.resolved.length} · Newly failing: {comparison.newlyFailed.length} · Duration change: {Math.round(comparison.delta.durationMs / 1000)}s</p>
          {comparison.newlyFailed.length > 0 && <p>New failures: {comparison.newlyFailed.join('; ')}</p>}
        </div></div> : <p className="reporting-muted">Select two different completed runs from the same environment to compare their actual results.</p>}
      </div>
    </section>
    <section className="panel reporting-operations" aria-label="History management">
      <div className="panel-heading"><div><h2>Manage local history</h2><p>Deletion removes JSON records and stored report artifacts, only for this project and environment</p></div><Trash2 size={19} /></div>
      <div className="reporting-content">
        {runs.length > 0 && <div className="reporting-deletion-list">{runs.slice(0, 8).map((run) => <div className="reporting-delete-row" key={run.id}><span>{run.id.slice(0, 8)} · {run.suite} · {run.status}</span><button type="button" onClick={() => deleteOne(run)} disabled={busy || Boolean(active)} aria-label={`Delete run ${run.id.slice(0, 8)}`}><Trash2 size={15} /> Delete</button></div>)}</div>}
        <p className="reporting-muted">To delete all {runs.length} runs for <strong>{projectId} / {environment}</strong>, type <code>DELETE HISTORY</code>. This cannot be undone.</p>
        <div className="reporting-row"><input aria-label="Confirm history deletion" value={confirmText} placeholder="DELETE HISTORY" onChange={(e) => setConfirmText(e.target.value)} /><button type="button" className="danger-button" onClick={clearHistory} disabled={busy || Boolean(active) || runs.length === 0 || confirmText !== 'DELETE HISTORY'}><Trash2 size={15} /> Delete scoped history</button></div>
        {active && <p className="reporting-muted">Stop the active run before deleting any history.</p>}
      </div>
    </section>
  </div>;
}
