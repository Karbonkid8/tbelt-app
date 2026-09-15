import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { fieldOpsApi, type CngDispatch, type CngStageTotals, type CngTrailerTrend, type CreateCngDispatch, type Dashboard, type Site } from './api';
import { auth } from './firebase';
import type { Theme } from './theme';

type Props = { user: User; theme: Theme; onToggleTheme: () => void };
type DashboardView = 'location' | 'chemicals' | 'cng' | 'requisitions';
type DispatchTiming = { title: string; detail: string; tone: 'normal' | 'attention' | 'urgent' | 'unknown' };

const DASHBOARD_REFRESH_INTERVAL_MS = 15_000;

const timeAgo = (iso?: string | null) => {
  if (!iso) return 'No reading';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
};
const formatDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function pressureDeclineRate(trend?: CngTrailerTrend) {
  if (!trend || trend.readings.length < 2) return null;
  const latest = trend.readings.at(-1)!;
  const cutoff = new Date(latest.recordedAtIso).getTime() - 24 * 60 * 60 * 1000;
  const earliest = trend.readings.find(reading => new Date(reading.recordedAtIso).getTime() >= cutoff) ?? trend.readings[0];
  const elapsedHours = (new Date(latest.recordedAtIso).getTime() - new Date(earliest.recordedAtIso).getTime()) / 3600000;
  const decline = earliest.pressurePsi - latest.pressurePsi;
  return elapsedHours > .1 && decline > 0 ? decline / elapsedHours : null;
}

function dispatchTiming(currentPsi: number | undefined, rate: number | null, travelHours: number, targetPsi: number): DispatchTiming {
  if (currentPsi == null) return { title: 'Awaiting reading', detail: 'Enter a trailer PSI reading first.', tone: 'unknown' };
  if (rate == null) return { title: 'Awaiting trend', detail: 'Two declining readings are needed.', tone: 'unknown' };
  const dispatchIn = (currentPsi - targetPsi) / rate - travelHours;
  const projectedArrival = Math.max(0, currentPsi - rate * travelHours);
  if (dispatchIn <= 0) return { title: 'Dispatch now', detail: `Immediate arrival projects ${Math.round(projectedArrival).toLocaleString()} PSI.`, tone: 'urgent' };
  const rounded = Math.round(dispatchIn * 10) / 10;
  return { title: `Dispatch in ${rounded} hr${rounded === 1 ? '' : 's'}`, detail: `Planned arrival near ${Math.round(targetPsi).toLocaleString()} PSI.`, tone: currentPsi <= 1100 ? 'attention' : 'normal' };
}

export function Login({ theme, onToggleTheme }: Pick<Props, 'theme' | 'onToggleTheme'>) {
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await signInWithEmailAndPassword(auth, String(form.get('email')).trim(), String(form.get('password'))); }
    catch { setError('Unable to sign in with that administrator account.'); }
  }
  return <main className="login-shell"><button className="theme-toggle login-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? '☀ Light' : '☾ Night'}</button><form className="login-card" onSubmit={submit}><div className="mark">FO</div><p className="eyebrow">FIELDOPS</p><h1>Operations dashboard</h1><p>Use your administrator account to view live site status.</p><label>EMAIL<input required name="email" type="email" autoComplete="email" /></label><label>PASSWORD<input required name="password" type="password" autoComplete="current-password" /></label>{error && <p className="error">{error}</p>}<button type="submit">Sign in</button></form></main>;
}

function AlertList({ dashboard }: { dashboard: Dashboard }) { return <article className="card alerts"><div className="card-heading"><h2>Needs attention</h2><span>{dashboard.alerts.length} alerts</span></div><ul>{dashboard.alerts.length ? dashboard.alerts.map(alert => <li className={`alert ${alert.severity}`} key={`${alert.type}-${alert.resourceId}`}><b>{alert.resourceName}</b><span>{alert.message}</span></li>) : <li className="all-clear">All readings are current.</li>}</ul></article>; }
function ActiveWells({ dashboard }: { dashboard: Dashboard }) { return <article className="card"><div className="card-heading"><h2>Active wells</h2><span>{dashboard.activeWells.length} online</span></div>{dashboard.activeWells.length ? <ul>{dashboard.activeWells.map(well => <li className="well-row" key={well.id}><span style={{ color: well.color }} aria-hidden="true">●</span><div><b>{well.name}</b><small>{well.plannedStages} planned stages</small></div></li>)}</ul> : <p className="empty">No active wells at this location.</p>}</article>; }
function CngStageTotals({ totals }: { totals: CngStageTotals }) { return <article className="card"><div className="card-heading"><h2>CNG stage totals</h2><span><b>{totals.totalMscf.toLocaleString(undefined, { maximumFractionDigits: 1 })} MSCF</b> · {totals.completedStageCount} posted stages</span></div>{totals.stages.length ? <table><thead><tr><th>Well</th><th>Stage</th><th>MSCF</th><th>Posted</th></tr></thead><tbody>{totals.stages.map(stage => <tr key={stage.id}><td><b>{stage.wellName || 'Unassigned well'}</b>{stage.note && <small>{stage.note}</small>}</td><td>Stage {stage.stageNumber}</td><td><b>{stage.mscf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b></td><td>{timeAgo(stage.endedAtIso)}</td></tr>)}</tbody></table> : <p className="empty">No CNG stage totals have been posted for this location.</p>}</article>; }
function TrailerTable({ dashboard }: { dashboard: Dashboard }) { return <article className="card"><div className="card-heading"><h2>Trailer readings</h2><span>Location-wide</span></div>{dashboard.trailers.length ? <table><thead><tr><th>Trailer</th><th>Pressure</th><th>Temp</th><th>Last reading</th></tr></thead><tbody>{dashboard.trailers.map(trailer => <tr key={trailer.id}><td><b>{trailer.trailerNumber}</b><small>Position {trailer.position}</small></td><td>{trailer.latestReading ? `${trailer.latestReading.pressurePsi.toLocaleString()} PSI` : '—'}</td><td>{trailer.latestReading?.temperatureF == null ? '—' : `${trailer.latestReading.temperatureF} °F`}</td><td>{timeAgo(trailer.latestReading?.recordedAtIso)}</td></tr>)}</tbody></table> : <p className="empty">No active trailers.</p>}</article>; }
function InventoryTable({ dashboard }: { dashboard: Dashboard }) { const { inventory } = dashboard; return <article className="card"><div className="card-heading"><h2>Container inventory</h2><span>{inventory.containers.length} containers · Low ISO threshold {inventory.lowIsoThresholdInches} in</span></div>{inventory.containers.length ? <table><thead><tr><th>Container</th><th>Type</th><th>Strap</th><th>Updated</th></tr></thead><tbody>{inventory.containers.map(container => <tr key={container.id}><td><b>{container.name}</b><small>{container.chemical} · {container.area}</small></td><td>{container.type}</td><td>{container.strap == null ? '—' : `${container.strap} in`}</td><td>{timeAgo(container.updatedAtIso)}</td></tr>)}</tbody></table> : <p className="empty">No containers at this location.</p>}</article>; }
function LocationView({ dashboard, lowIsos }: { dashboard: Dashboard; lowIsos: number }) { return <><section className="metrics"><article><small>ACTIVE TRAILERS</small><strong>{dashboard.trailers.length}</strong></article><article><small>LOW ISO TANKS</small><strong>{lowIsos}</strong></article><article><small>NEEDS ATTENTION</small><strong>{dashboard.alerts.length}</strong></article><article><small>ACTIVE WELLS</small><strong>{dashboard.activeWells.length}</strong></article></section><section className="grid"><AlertList dashboard={dashboard} /><ActiveWells dashboard={dashboard} /></section></>; }
function RequisitionsView() { return <article className="card requisition-placeholder"><p className="eyebrow">NEXT INTEGRATION</p><h2>Requisitions</h2><p>Requisition data will appear here once we add the secured REST endpoint for submitted requests, requested items, delivery status, and requester details.</p><span>API endpoint planned: <code>GET /v1/sites/{'{siteId}'}/requisitions</code></span></article>; }

function CngDispatchPlanner({ dashboard, trends, dispatches, onDispatch, onResolve }: { dashboard: Dashboard; trends: CngTrailerTrend[]; dispatches: CngDispatch[]; onDispatch: (request: CreateCngDispatch) => Promise<void>; onResolve: (dispatchId: string, status: 'arrived' | 'cancelled') => Promise<void> }) {
  const [travelHours, setTravelHours] = useState(5);
  const [targetPsi, setTargetPsi] = useState(800);
  const [replacementNumbers, setReplacementNumbers] = useState<Record<string, string>>({});
  const [savingTrailerId, setSavingTrailerId] = useState('');
  const [resolvingId, setResolvingId] = useState('');
  const [error, setError] = useState('');
  const trendsByTrailer = useMemo(() => new Map(trends.map(trend => [trend.trailerId, trend])), [trends]);
  const dispatchesByTrailer = useMemo(() => new Map(dispatches.map(dispatch => [dispatch.sourceTrailerId, dispatch])), [dispatches]);
  async function markDispatched(trailerId: string, trailerNumber: string) {
    if (!window.confirm(`Mark a replacement for Trailer ${trailerNumber} as dispatched?`)) return;
    setSavingTrailerId(trailerId); setError('');
    try { await onDispatch({ sourceTrailerId: trailerId, replacementTrailerNumber: replacementNumbers[trailerId]?.trim() || undefined, travelTimeHours: travelHours, targetArrivalPsi: targetPsi }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to record the dispatch.'); }
    finally { setSavingTrailerId(''); }
  }
  async function resolveDispatch(dispatch: CngDispatch, status: 'arrived' | 'cancelled') {
    if (!window.confirm(`${status === 'arrived' ? 'Mark' : 'Cancel'} the replacement for Trailer ${dispatch.sourceTrailerNumber}?`)) return;
    setResolvingId(dispatch.id); setError('');
    try { await onResolve(dispatch.id, status); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update the dispatch.'); }
    finally { setResolvingId(''); }
  }
  return <article className="card dispatch-planner"><div className="card-heading"><div><h2>CNG dispatch planner</h2><small>Attention begins at 1,100 PSI.</small></div><span>Target delivery planning</span></div><div className="dispatch-controls"><label>TRAVEL TIME TO LOCATION<input type="number" min="0" max="48" step="0.5" value={travelHours} onChange={event => setTravelHours(Math.min(48, Math.max(0, Number(event.target.value))))} /><em>hours</em></label><label>TARGET ARRIVAL PSI<input type="number" min="100" max="2500" step="50" value={targetPsi} onChange={event => setTargetPsi(Math.min(2500, Math.max(100, Number(event.target.value))))} /><em>PSI</em></label></div>{error && <p className="dispatch-error" role="alert">{error}</p>}<div className="dispatch-list">{dashboard.trailers.map(trailer => { const activeDispatch = dispatchesByTrailer.get(trailer.id); const rate = pressureDeclineRate(trendsByTrailer.get(trailer.id)); const timing = dispatchTiming(trailer.latestReading?.pressurePsi, rate, travelHours, targetPsi); return <section className="dispatch-row" key={trailer.id}><div className="dispatch-trailer"><b>Trailer {trailer.trailerNumber}</b><span>{trailer.latestReading ? `${trailer.latestReading.pressurePsi.toLocaleString()} PSI · ${timeAgo(trailer.latestReading.recordedAtIso)}` : 'No current PSI reading'}</span></div><div className="dispatch-rate"><b>{rate == null ? '—' : `↓ ${Math.round(rate)} PSI/hr`}</b><span>{rate == null ? 'Trend unavailable' : 'Recent decline rate'}</span></div>{activeDispatch ? <><div className="dispatch-in-transit"><b>Replacement in transit</b><span>{activeDispatch.replacementTrailerNumber ? `Trailer ${activeDispatch.replacementTrailerNumber} · ` : ''}ETA {formatDateTime(activeDispatch.projectedArrivalIso)}</span></div><div className="resolve-actions"><button type="button" disabled={resolvingId === activeDispatch.id} onClick={() => resolveDispatch(activeDispatch, 'arrived')}>Mark arrived</button><button type="button" className="cancel" disabled={resolvingId === activeDispatch.id} onClick={() => resolveDispatch(activeDispatch, 'cancelled')}>Cancel</button></div></> : <><div className={`dispatch-recommendation ${timing.tone}`}><b>{timing.title}</b><span>{timing.detail}</span></div><div className="dispatch-action"><label className="replacement-label">REPLACEMENT TRAILER<input value={replacementNumbers[trailer.id] ?? ''} placeholder="Optional number" onChange={event => setReplacementNumbers(current => ({ ...current, [trailer.id]: event.target.value }))} /></label><button type="button" disabled={savingTrailerId === trailer.id} onClick={() => markDispatched(trailer.id, trailer.trailerNumber)}>{savingTrailerId === trailer.id ? 'Saving…' : 'Mark dispatched'}</button></div></>}</section>; })}</div></article>;
}

function PressureTrendChart({ trends }: { trends: CngTrailerTrend[] }) {
  const [hours, setHours] = useState(24);
  const colors = ['#ee2827', '#28764a', '#4267c5', '#a96b00'];
  const points = trends.flatMap((trend, trendIndex) => trend.readings.map(reading => ({ ...reading, trailerNumber: trend.trailerNumber, color: colors[trendIndex % colors.length] })));
  const latest = Math.max(...points.map(point => new Date(point.recordedAtIso).getTime()), 0);
  const cutoff = latest - hours * 3600000;
  const visible = points.filter(point => new Date(point.recordedAtIso).getTime() >= cutoff);
  const left = 52, top = 18, width = 720, height = 230, bottom = 35, maxPsi = 2400;
  const x = (time: number) => left + ((time - cutoff) / (latest - cutoff || 1)) * (width - left - 18);
  const y = (psi: number) => top + ((maxPsi - Math.max(0, Math.min(maxPsi, psi))) / maxPsi) * (height - top - bottom);
  return <article className="card pressure-chart"><div className="card-heading"><div><h2>Trailer pressure trend</h2><small>Recorded PSI readings with the 1,100 PSI attention line.</small></div><span><button type="button" className={hours === 12 ? 'selected' : ''} onClick={() => setHours(12)}>12h</button><button type="button" className={hours === 24 ? 'selected' : ''} onClick={() => setHours(24)}>24h</button><button type="button" className={hours === 48 ? 'selected' : ''} onClick={() => setHours(48)}>48h</button></span></div>{visible.length ? <><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="CNG trailer pressure trend"><line x1={left} x2={width - 18} y1={y(1100)} y2={y(1100)} className="attention-line" /><text x={width - 18} y={y(1100) - 6} textAnchor="end" className="chart-note">Attention 1,100 PSI</text>{[0, 800, 1600, 2400].map(value => <g key={value}><line x1={left} x2={width - 18} y1={y(value)} y2={y(value)} className="chart-grid" /><text x={left - 8} y={y(value) + 4} textAnchor="end" className="chart-label">{value.toLocaleString()}</text></g>)}{trends.map((trend, index) => { const readings = trend.readings.filter(reading => new Date(reading.recordedAtIso).getTime() >= cutoff); if (!readings.length) return null; const path = readings.map((reading, pointIndex) => `${pointIndex ? 'L' : 'M'} ${x(new Date(reading.recordedAtIso).getTime())} ${y(reading.pressurePsi)}`).join(' '); const last = readings.at(-1)!; return <g key={trend.trailerId}><path d={path} fill="none" stroke={colors[index % colors.length]} strokeWidth="3" /><circle cx={x(new Date(last.recordedAtIso).getTime())} cy={y(last.pressurePsi)} r="4" fill={colors[index % colors.length]} /><text x={x(new Date(last.recordedAtIso).getTime()) + 7} y={y(last.pressurePsi) - 7} fill={colors[index % colors.length]} className="chart-note">{trend.trailerNumber}</text></g>; })}<text x={left} y={height - 10} className="chart-label">{new Date(cutoff).toLocaleTimeString([], { hour: 'numeric' })}</text><text x={width - 18} y={height - 10} textAnchor="end" className="chart-label">Latest reading</text></svg><div className="trend-legend">{trends.map((trend, index) => <span key={trend.trailerId}><i style={{ background: colors[index % colors.length] }} />Trailer {trend.trailerNumber}</span>)}</div></> : <p className="empty">No pressure readings are available in this time window.</p>}</article>;
}

function DispatchHistory({ dispatches }: { dispatches: CngDispatch[] }) { return <article className="card dispatch-history"><div className="card-heading"><h2>Recent dispatch history</h2><span>{dispatches.length} records</span></div>{dispatches.length ? <table><thead><tr><th>Trailer</th><th>Status</th><th>Dispatched</th><th>Resolved</th></tr></thead><tbody>{dispatches.slice(0, 10).map(dispatch => <tr key={dispatch.id}><td><b>{dispatch.sourceTrailerNumber}</b>{dispatch.replacementTrailerNumber && <small>Replacement {dispatch.replacementTrailerNumber}</small>}</td><td><span className={`dispatch-status ${dispatch.status}`}>{dispatch.status}</span></td><td>{formatDateTime(dispatch.dispatchedAtIso)}</td><td>{dispatch.resolvedAtIso ? formatDateTime(dispatch.resolvedAtIso) : 'In transit'}</td></tr>)}</tbody></table> : <p className="empty">No CNG replacement dispatches recorded yet.</p>}</article>; }

export function App({ user, theme, onToggleTheme }: Props) {
  const [sites, setSites] = useState<Site[]>([]); const [siteId, setSiteId] = useState(''); const [dashboard, setDashboard] = useState<Dashboard>(); const [cngStageTotals, setCngStageTotals] = useState<CngStageTotals>(); const [cngTrends, setCngTrends] = useState<CngTrailerTrend[]>([]); const [cngDispatches, setCngDispatches] = useState<CngDispatch[]>([]); const [cngDispatchHistory, setCngDispatchHistory] = useState<CngDispatch[]>([]); const [view, setView] = useState<DashboardView>('location'); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { fieldOpsApi.listSites(user).then(foundSites => { setSites(foundSites); if (foundSites.length === 1) setSiteId(foundSites[0].id); }).catch(reason => setError(reason.message)); }, [user]);
  useEffect(() => { if (!siteId) return; setLoading(true); setError(''); Promise.all([fieldOpsApi.dashboard(user, siteId), fieldOpsApi.cngStageTotals(user, siteId), fieldOpsApi.cngPressureTrends(user, siteId), fieldOpsApi.cngDispatches(user, siteId), fieldOpsApi.cngDispatchHistory(user, siteId)]).then(([nextDashboard, totals, trends, dispatches, history]) => { setDashboard(nextDashboard); setCngStageTotals(totals); setCngTrends(trends); setCngDispatches(dispatches); setCngDispatchHistory(history); }).catch(reason => setError(reason.message)).finally(() => setLoading(false)); }, [siteId, user, refreshKey]);
  useEffect(() => { if (!siteId) return; const timer = window.setInterval(() => setRefreshKey(key => key + 1), DASHBOARD_REFRESH_INTERVAL_MS); return () => window.clearInterval(timer); }, [siteId]);
  async function createCngDispatch(request: CreateCngDispatch) { const dispatch = await fieldOpsApi.createCngDispatch(user, siteId, request); setCngDispatches(current => [dispatch, ...current]); setCngDispatchHistory(current => [dispatch, ...current]); }
  async function resolveCngDispatch(dispatchId: string, status: 'arrived' | 'cancelled') { const dispatch = await fieldOpsApi.resolveCngDispatch(user, siteId, dispatchId, status); setCngDispatches(current => current.filter(item => item.id !== dispatch.id)); setCngDispatchHistory(current => current.map(item => item.id === dispatch.id ? dispatch : item)); }
  const lowIsos = dashboard?.inventory.alerts.filter(alert => alert.type === 'low-iso').length ?? 0;
  return <>
    <header><div className="brand"><span>FO</span><strong>FieldOps</strong><small>Operations dashboard</small></div><div className="actions"><button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? '☀ Light' : '☾ Night'}</button><button className="secondary" disabled={!siteId || loading} onClick={() => setRefreshKey(key => key + 1)}>Refresh</button><button className="link" onClick={() => signOut(auth)}>Sign out</button></div></header>
    <main className="page">
      <section className="heading"><div><p className="eyebrow">LIVE OPERATIONS</p><h1>Dashboard</h1><p className="muted">{dashboard ? <>Location: <strong>{dashboard.site.name}</strong> · ID: <code>{dashboard.site.id}</code> · Updated {new Date(dashboard.generatedAtIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</> : 'Select a location to load its current status.'}</p></div><label className="site-picker">LOCATION<select value={siteId} onChange={event => setSiteId(event.target.value)}><option value="">Choose a location</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name} · {site.id}</option>)}</select></label></section>
      {dashboard && <nav className="view-tabs" aria-label="Dashboard views">{([{ id: 'location', label: 'Location' }, { id: 'chemicals', label: 'Chemicals' }, { id: 'cng', label: 'CNG' }, { id: 'requisitions', label: 'Requisitions' }] as const).map(item => <button key={item.id} type="button" className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>}
      {error ? <p className="empty">{error}</p> : loading ? <p className="empty">Loading live site data…</p> : dashboard ? <section className="view-content">
        {view === 'location' && <LocationView dashboard={dashboard} lowIsos={lowIsos} />}
        {view === 'chemicals' && <InventoryTable dashboard={dashboard} />}
        {view === 'cng' && <><CngDispatchPlanner dashboard={dashboard} trends={cngTrends} dispatches={cngDispatches} onDispatch={createCngDispatch} onResolve={resolveCngDispatch} /><PressureTrendChart trends={cngTrends} /><DispatchHistory dispatches={cngDispatchHistory} />{cngStageTotals && <CngStageTotals totals={cngStageTotals} />}<TrailerTable dashboard={dashboard} /></>}
        {view === 'requisitions' && <RequisitionsView />}
      </section> : <p className="empty">Choose a location to load live operational data.</p>}
    </main>
  </>;
}
