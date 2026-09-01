import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithCustomToken, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

const storageKey = 'fieldops-demo-v1';
const APP_VERSION = 'v0.2.0';
const firebaseConfig = window.FIELDOPS_FIREBASE_CONFIG;
const liveMode = Boolean(firebaseConfig?.projectId);
let auth;
let database;
let joinSite;
let createSite;
let updateSite;
let deleteSite;

if (liveMode) {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  database = getFirestore(firebaseApp);
  joinSite = httpsCallable(getFunctions(firebaseApp, 'us-west3'), 'joinSite');
  createSite = httpsCallable(getFunctions(firebaseApp, 'us-west3'), 'createSite');
  updateSite = httpsCallable(getFunctions(firebaseApp, 'us-west3'), 'updateSite');
  deleteSite = httpsCallable(getFunctions(firebaseApp, 'us-west3'), 'deleteSite');
}

const isoIcon = () => `<span class="tank-icon" aria-label="Blue framed ISO tank"><svg viewBox="0 0 66 44" role="img"><rect x="3" y="4" width="60" height="35" rx="2" fill="#205c8d"/><rect x="7" y="8" width="52" height="27" fill="#d9e1e5"/><ellipse cx="33" cy="21.5" rx="20" ry="12.5" fill="#b8c5cb" stroke="#6e8089"/><path d="M8 8h50v27H8zM8 12h50M8 31h50M15 6v31m36-31v31" fill="none" stroke="#164b76" stroke-width="2.5"/></svg></span>`;
const polyIcon = () => `<span class="tank-icon" aria-label="White caged poly tote"><svg viewBox="0 0 66 44" role="img"><rect x="10" y="5" width="46" height="31" rx="4" fill="#f3f5f1" stroke="#a6adb0"/><path d="M11 13h44M11 21h44M11 29h44M20 6v29m12-29v29m12-29v29" stroke="#8c9699" stroke-width="1.5"/><path d="M8 37h50v4H8z" fill="#252d33"/><rect x="28" y="2" width="11" height="4" rx="1" fill="#262d31"/><path d="M47 29h8v4h-8z" fill="#1c252a"/></svg></span>`;
const stationRows = [
  { belt: 1, station: 5, key: 'b1s5' }, { belt: 1, station: 4, key: 'b1s4' }, { belt: 1, station: 3, key: 'b1s3' }, { belt: 1, station: 2, key: 'b1s2' }, { belt: 1, station: 1, key: 'b1s1' },
  { belt: 2, station: 5, key: 'b2s5' }, { belt: 2, station: 4, key: 'b2s4' }, { belt: 2, station: 3, key: 'b2s3' }, { belt: 2, station: 2, key: 'b2s2' }, { belt: 2, station: 1, key: 'b2s1' },
];
const emptyStations = () => Object.fromEntries(stationRows.map(row => [row.key, '']));

const seed = {
  siteId: '', siteName: '', userName: '', signedIn: false, isAdmin: false, authMode: 'site', area: 'Frac', tab: 'chemicals', requisitions: [], sites: [],
  pumping: { view: false, programs: { Frac: { pumpedBbl: '' }, 'Pump Down': { pumpedBbl: '' } } },
  cng: {
    selectedWellId: 'well-green', rangeHours: 12,
    wells: [
      { id:'well-green', name:'Anthem 14-23H', color:'green', plannedStages:42, active:true },
      { id:'well-blue', name:'Anthem 14-24H', color:'blue', plannedStages:38, active:true },
    ],
    trailers: [
      { id:'trailer-200034', position:1, trailerNumber:'200034', active:true },
      { id:'trailer-200871', position:2, trailerNumber:'200871', active:true },
      { id:'trailer-200442', position:3, trailerNumber:'200442', active:true },
      { id:'trailer-200117', position:4, trailerNumber:'200117', active:true },
    ],
    readings: [],
    stages: [
      { id:'stage-11', wellId:'well-green', stageNumber:11, mscf:79.8, note:'', endedAtIso:'2026-09-01T18:35:00.000Z', endedAt:'Today, 12:35 PM', by:'Demo operator', revisions:[] },
    ],
  },
  rundown: { values: emptyStations(), partialStart: '', phoneNumber: '', recipientOpen: true, previewOpen: false, compact: false },
  containers: [
    { id:'iso-014', name:'ISO #014', type:'ISO tank', area:'Frac', chemical:'Friction Reducer', strap:56, updatedAt:'Today, 9:42 AM', updatedAtIso:new Date().toISOString(), history:[{strap:56, by:'Demo operator', at:'Today, 9:42 AM'}] },
    { id:'poly-05', name:'Poly #05', type:'Poly 330 gal', area:'Frac', chemical:'Scale Inhibitor', strap:31, updatedAt:'Aug 27', updatedAtIso:'2026-08-27T12:00:00.000Z', history:[{strap:31, by:'Demo operator', at:'Aug 27'}] },
    { id:'iso-021', name:'ISO #021', type:'ISO tank', area:'Pump Down', chemical:'Biocide', strap:48.5, updatedAt:'Yesterday', updatedAtIso:'2026-08-28T12:00:00.000Z', history:[{strap:48.5, by:'Demo operator', at:'Yesterday'}] },
    { id:'poly-08', name:'Poly #08', type:'Poly 330 gal', area:'Pump Down', chemical:'Corrosion Inhibitor', strap:null, updatedAt:'Not entered', updatedAtIso:null, history:[] },
  ],
};

const load = () => ({ ...seed, ...JSON.parse(localStorage.getItem(storageKey) || '{}') });
let state = load();
state.pumping = { ...seed.pumping, ...(state.pumping || {}), programs: { ...seed.pumping.programs, ...(state.pumping?.programs || {}) } };
state.cng = { ...seed.cng, ...(state.cng || {}), wells: state.cng?.wells || seed.cng.wells, trailers: state.cng?.trailers || seed.cng.trailers, readings: state.cng?.readings || seed.cng.readings, stages: state.cng?.stages || seed.cng.stages };
if (liveMode) {
  state.signedIn = false;
  state.siteId = '';
}
const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
const app = document.querySelector('#app');

function formatStrap(value) { return value === null || value === '' ? '—' : `${value} in`; }
function typeIcon(type) { return type === 'ISO tank' ? isoIcon() : polyIcon(); }
function areaContainers() { return state.containers.filter(container => container.area === state.area); }
function pumpingProgramId(area = state.area) { return area === 'Pump Down' ? 'pump-down' : 'frac'; }
function pumpingProgram() { return state.pumping.programs[state.area] || { pumpedBbl: '' }; }
function cngWells() { return state.cng.wells.filter(well => well.active); }
function selectedWell() { return cngWells().find(well => well.id === state.cng.selectedWellId) || cngWells()[0] || null; }
function activeTrailers() { return state.cng.trailers.filter(trailer => trailer.active).sort((a, b) => Number(a.position) - Number(b.position)); }
function stagesForWell(wellId = selectedWell()?.id) { return state.cng.stages.filter(stage => stage.wellId === wellId).sort((a, b) => Number(a.stageNumber) - Number(b.stageNumber)); }
function nextStageNumber(wellId = selectedWell()?.id) { return Math.max(0, ...stagesForWell(wellId).map(stage => Number(stage.stageNumber) || 0)) + 1; }
function formatDateTime(value) { return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(new Date(value)); }
function targetGallons(pumpedBbl, setPointGpt) { const hasPumpedVolume = pumpedBbl !== '' && pumpedBbl !== null && pumpedBbl !== undefined; const hasSetPoint = setPointGpt !== '' && setPointGpt !== null && setPointGpt !== undefined; const bbl = Number(pumpedBbl); const gpt = Number(setPointGpt); if (!hasPumpedVolume || !hasSetPoint || !Number.isFinite(bbl) || !Number.isFinite(gpt) || bbl < 0 || gpt < 0) return '—'; const gallons = bbl * 42 / 1000 * gpt; return `${gallons.toLocaleString(undefined, { maximumFractionDigits: 1 })} gal`; }
function updatePumpingTargets() { const program = pumpingProgram(); document.querySelectorAll('[data-target]').forEach(node => { const container = state.containers.find(item => item.id === node.dataset.target); node.textContent = targetGallons(program.pumpedBbl, container?.setPointGpt); }); }
function render() {
  app.innerHTML = `${state.signedIn ? shell() : gate()}${state.signedIn ? content() : ''}`;
  bind();
}

function gate() {
  if (state.authMode === 'admin') return `<section class="overlay"><form class="gate" id="admin-gate"><div class="gate-mark">FO</div><h2>Administrator sign in</h2><p>Use your FieldOps administrator email and password to manage worksite access.</p><label class="field">EMAIL<input required name="email" type="email" autocomplete="email" /></label><label class="field">PASSWORD<input required name="password" type="password" autocomplete="current-password" /></label><button class="primary" type="submit">Sign in as administrator</button><button class="link-button auth-switch" type="button" data-site-login>← Back to Site Code</button><div class="app-version">FieldOps ${APP_VERSION} · Field beta</div></form></section>`;
  return `<section class="overlay"><form class="gate" id="site-gate"><div class="gate-mark">FO</div><h2>Welcome to FieldOps</h2><p>Enter the Site Code for this work location. You will only see data assigned to that site.</p><label class="field">SITE CODE<input required name="siteCode" autocomplete="off" placeholder="Enter site code" /></label><label class="field">YOUR NAME <input required name="userName" autocomplete="name" placeholder="Used on strap history" /></label><button class="primary" type="submit">Enter FieldOps</button><button class="link-button auth-switch" type="button" data-admin-login>Administrator sign in</button><div class="gate-note">${liveMode ? 'Your Site Code is checked securely before FieldOps opens.' : 'Demo mode accepts any Site Code.'}</div><div class="app-version">FieldOps ${APP_VERSION} · Field beta</div></form></section>`;
}

function shell() { return `<header class="topbar"><div class="brand">FieldOps <small>Worksite Operations · ${APP_VERSION}</small></div>${state.isAdmin ? '<div class="admin-label">Administrator console</div>' : `<nav class="tabs" aria-label="FieldOps sections"><button data-tab="rundown" class="${state.tab === 'rundown' ? 'active' : ''}">T-Belt RunDown</button><button data-tab="chemicals" class="${state.tab === 'chemicals' ? 'active' : ''}">Chemicals</button><button data-tab="cng" class="${state.tab === 'cng' ? 'active' : ''}">CNG</button><button data-tab="requisitions" class="${state.tab === 'requisitions' ? 'active' : ''}">Requisitions</button></nav>`}<div class="site-actions"><span class="site-chip">${state.isAdmin ? 'System Admin' : `Location: ${escapeHtml(state.siteName)} · ID: ${escapeHtml(state.siteId)}`}</span><button class="sign-out" data-sign-out type="button">Sign out</button></div></header>`; }

function content() { const locationContext = !state.isAdmin ? `<div class="location-context" role="status"><span>Current location</span><strong>${escapeHtml(state.siteName)}</strong><i aria-hidden="true">·</i><span>ID: ${escapeHtml(state.siteId)}</span></div>` : ''; return `<main class="page">${locationContext}${state.isAdmin ? adminDashboard() : state.tab === 'chemicals' ? chemicals() : state.tab === 'cng' ? cng() : state.tab === 'requisitions' ? requisitions() : rundown()}</main>`; }
function adminDashboard() { const activeCount = state.sites.filter(site => site.active).length; const wells = state.adminWells || []; return `<section><div class="heading"><div><h1>Administrator console</h1><p class="subhead">Manage FieldOps locations, wells, and access.</p></div><div class="admin-actions"><button class="secondary" data-open="well">+ Add well</button><button class="primary" data-open="location">+ Add location</button></div></div><section class="panel"><div class="panel-heading"><strong>Locations</strong><span>${activeCount} active</span></div>${state.sites.length ? `<table class="responsive-table"><thead><tr><th>Location</th><th>Status</th><th>Location ID</th><th></th></tr></thead><tbody>${state.sites.map(site => `<tr><td data-label="Location"><b>${escapeHtml(site.name)}</b></td><td data-label="Status"><span class="badge">${site.active ? 'Active' : 'Inactive'}</span></td><td data-label="Location ID" class="muted">${escapeHtml(site.id)}</td><td data-label="Actions"><div class="location-actions"><button class="link-button" data-rotate-site="${escapeHtml(site.id)}">Rotate code</button><button class="link-button" data-toggle-site="${escapeHtml(site.id)}" data-site-active="${site.active}">${site.active ? 'Deactivate' : 'Activate'}</button><button class="link-button danger-link" data-remove-site="${escapeHtml(site.id)}">Remove</button></div></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No locations are available.</div>'}</section><section class="panel admin-wells"><div class="panel-heading"><strong>Wells</strong><span>${wells.filter(well => well.active).length} active</span></div>${wells.length ? `<table class="responsive-table"><thead><tr><th>Well</th><th>Location</th><th>Stages</th><th>Status</th><th></th></tr></thead><tbody>${wells.map(well => `<tr><td data-label="Well"><span class="well-dot well-${escapeHtml(well.color)}"></span><b>${escapeHtml(well.name)}</b></td><td data-label="Location">${escapeHtml(well.siteName || well.siteId)}</td><td data-label="Stages">${escapeHtml(well.plannedStages)}</td><td data-label="Status"><span class="badge">${well.active ? 'Active' : 'Inactive'}</span></td><td data-label="Actions"><div class="location-actions"><button class="link-button" data-edit-well="${escapeHtml(well.id)}">Edit</button><button class="link-button" data-toggle-well="${escapeHtml(well.id)}" data-well-active="${well.active}">${well.active ? 'Deactivate' : 'Activate'}</button></div></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Create a well to begin CNG tracking.</div>'}</section></section>`; }
function reportPreview() { const entry = state.rundown; const line = (key, station) => `Stn${station}:${entry.values[key]?.trim() ? ` ${entry.values[key].trim()}` : ''}${entry.partialStart === key ? ' Start' : ''}`; return ['T-Belt 1', line('b1s5', 5), line('b1s4', 4), line('b1s3', 3), line('b1s2', 2), line('b1s1', 1), '', 'T-Belt 2', line('b2s5', 5), line('b2s4', 4), line('b2s3', 3), line('b2s2', 2), line('b2s1', 1)].join('\n'); }
function beltRows(belt) { const entry = state.rundown; return stationRows.filter(row => row.belt === belt).map((row, index) => `<div class="station-row ${index % 2 ? 'alternate' : ''}"><label>Stn${row.station}:</label><input data-station="${row.key}" inputmode="decimal" value="${escapeHtml(entry.values[row.key] || '')}" placeholder="Enter value" /><button class="start-marker ${entry.partialStart === row.key ? 'selected' : ''}" data-start="${row.key}" type="button" aria-label="Mark Station ${row.station} as Start">${entry.partialStart === row.key ? '● Start' : '⌖ Start'}</button></div>`).join(''); }
function rundown() { const entry = state.rundown; return `<section class="tbelt ${entry.compact ? 'compact' : ''}"><div class="tbelt-head"><div><h1>T-Belt RunDown</h1><p class="subhead">Enter station readings, mark the partial start, and send the engineer report.</p></div><div class="tbelt-actions"><button class="secondary" data-rundown-toggle="recipient" type="button">Engineer’s #</button><button class="secondary" data-rundown-toggle="preview" type="button">Preview</button><button class="secondary" data-rundown-toggle="compact" type="button">${entry.compact ? 'Standard view' : 'Compact view'}</button></div></div>${entry.recipientOpen ? `<section class="tbelt-panel"><label class="field">ENGINEER’S PHONE NUMBER<div class="phone-row"><input id="engineer-phone" inputmode="tel" value="${escapeHtml(entry.phoneNumber)}" placeholder="Enter phone number" /><button class="primary" data-rundown-done type="button">Done</button></div></label></section>` : ''}${entry.previewOpen ? `<section class="tbelt-panel"><strong>MESSAGE PREVIEW</strong><pre>${escapeHtml(reportPreview())}</pre></section>` : ''}<section class="belt-grid"><article class="belt-card"><header><span class="belt-badge">T</span><h2>T-BELT 1</h2><span>START</span></header>${beltRows(1)}</article><article class="belt-card"><header><span class="belt-badge">T</span><h2>T-BELT 2</h2><span>START</span></header>${beltRows(2)}</article></section><div class="tbelt-footer"><button class="secondary" data-rundown-clear type="button">Clear entry</button><button class="primary" data-rundown-send type="button">Send report</button></div></section>`; }

function chemicalAlert(container) { if (container.strap === null || container.strap === undefined) return { label:'Strap needed', kind:'missing' }; if (container.updatedAtIso && Date.now() - new Date(container.updatedAtIso).getTime() > 36 * 60 * 60 * 1000) return { label:'Review strap', kind:'review' }; return { label:'Current', kind:'current' }; }
function chemicals() {
  const containers = areaContainers();
  const isoCount = containers.filter(item => item.type === 'ISO tank').length;
  const pumpingView = state.pumping.view;
  const program = pumpingProgram();
  const tableHeaders = pumpingView ? '<th>Container</th><th>Chemical</th><th>Strap</th><th>Set point</th><th>Target volume</th><th></th>' : '<th>Container</th><th>Type</th><th>Chemical</th><th>Strap</th><th>Status</th><th>Last updated</th><th></th>';
  return `<section><div class="heading"><div><div class="title-row"><h1>Chemicals</h1><div class="segment" aria-label="Chemical area"><button data-area="Frac" class="${state.area === 'Frac' ? 'active' : ''}">Frac</button><button data-area="Pump Down" class="${state.area === 'Pump Down' ? 'active' : ''}">Pump Down</button></div><button class="pumping-toggle ${pumpingView ? 'active' : ''}" data-toggle-pumping type="button" aria-pressed="${pumpingView}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.75" width="16" height="18.5" rx="2.25"/><path d="M7.5 6.5h9M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/></svg><span>${pumpingView ? 'Calculator on' : 'Usage calculator'}</span></button></div><p class="subhead">${pumpingView ? `${state.area} chemical containers and expected usage.` : `${state.area} chemical containers and latest strap measurements.`}</p></div><button class="primary" data-open="container">+ Add container</button></div><section class="metrics"><div class="metric"><small>Containers assigned to ${state.area}</small><strong>${containers.length}</strong></div><div class="metric"><small>ISO tanks</small><strong>${isoCount}</strong></div></section><section class="panel chemical-inventory ${pumpingView ? 'pumping-active' : ''}"><div class="panel-heading"><strong>${state.area} container inventory</strong>${pumpingView ? `<label class="pumped-volume">Pumped volume <span><input data-pumped-bbl type="number" min="0" step="1" value="${escapeHtml(program.pumpedBbl ?? '')}" placeholder="0" /> BBL</span></label>` : '<span>Latest strap entries</span>'}</div>${containers.length ? `<table><thead><tr>${tableHeaders}</tr></thead><tbody>${containers.map(row).join('')}</tbody></table>` : '<div class="empty">No containers have been added to this area.</div>'}</section></section>`;
}

function cng() {
  const well = selectedWell();
  const trailers = activeTrailers();
  if (!well) return `<section><div class="heading"><div><h1>CNG</h1><p class="subhead">Select a well before recording CNG activity.</p></div></div><section class="panel"><div class="empty">No active wells are set up for this location. Ask an administrator to add one.</div></section></section>`;
  const stageNumber = nextStageNumber(well.id);
  const completed = stagesForWell(well.id).length;
  const wellOptions = cngWells().map(item => `<option value="${escapeHtml(item.id)}" ${item.id === well.id ? 'selected' : ''}>${escapeHtml(item.color[0].toUpperCase() + item.color.slice(1))} · ${escapeHtml(item.name)}</option>`).join('');
  const stageControls = `<div class="cng-well-controls cng-stage-controls well-selection-${escapeHtml(well.color)}"><label>ACTIVE WELL<select data-cng-well>${wellOptions}</select></label><label class="stage-inline-field">STAGE NUMBER<span><input required form="end-stage-form" name="stageNumber" type="number" min="1" step="1" value="${stageNumber}" /><small>of ${well.plannedStages}</small></span></label><button class="secondary" data-stage-history type="button">Stage history</button></div>`;
  const latestReading = trailerId => state.cng.readings.filter(reading => reading.wellId === well.id && reading.trailerId === trailerId).reduce((latest, reading) => !latest || new Date(reading.recordedAtIso) > new Date(latest.recordedAtIso) ? reading : latest, null);
  const readingRows = trailers.map(trailer => { const latest = latestReading(trailer.id); const summary = latest ? `<span class="last-reading"><b>${escapeHtml(latest.pressurePsi)} PSI${latest.temperatureF === null || latest.temperatureF === undefined ? '' : ` · ${escapeHtml(latest.temperatureF)}°F`}</b><small>${escapeHtml(formatDateTime(latest.recordedAtIso))}</small></span>` : '<span class="last-reading muted">—</span>'; return `<div class="cng-reading-row"><b><span class="position">${trailer.position}</span> Trailer ${escapeHtml(trailer.trailerNumber)}</b><label><input name="psi-${trailer.id}" data-cng-psi="${trailer.id}" type="number" min="0" step="1" inputmode="decimal" placeholder="PSI" /></label><label><input name="temp-${trailer.id}" data-cng-temp="${trailer.id}" type="number" step="0.1" inputmode="decimal" placeholder="°F" /></label>${summary}</div>`; }).join('');
  const readings = trailers.length ? `<form id="cng-readings-form"><div class="cng-reading-labels"><span>POSITION / TRAILER</span><span>PSI</span><span>°F</span><span>LAST READING</span></div><div class="cng-reading-list">${readingRows}</div><div class="cng-save-row"><span>Saved readings clear from the entry boxes and appear in Last reading.</span><button class="primary" type="submit">Save readings</button></div></form>` : '<div class="empty">No active trailers. Use Manage trailers to add the location lineup.</div>';
  return `<section class="cng-page"><div class="heading"><div><div class="title-row"><h1>CNG</h1></div><p class="subhead">Quick trailer readings and end-stage gas volume.</p></div></div><div class="cng-layout"><section class="panel cng-readings"><div class="panel-heading"><strong>Location trailer readings</strong><div><span>PSI required · °F optional</span><button class="link-button" data-manage-trailers type="button">Manage trailers</button></div></div>${readings}</section><section class="panel cng-stage"><div class="panel-heading"><strong>End stage</strong><span>MSCF pulled</span></div>${stageControls}<form id="end-stage-form" class="cng-stage-form"><label class="field">MSCF PULLED THIS STAGE<input required name="mscf" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Enter total MSCF" /></label><label class="field">NOTE <span class="optional">Optional</span><textarea name="note" maxlength="280" placeholder="Stage-end note"></textarea></label><button class="cng-end-button" type="submit">Review end stage</button><p class="cng-help">The end time is saved automatically. Volume after this entry rolls into the next stage.</p></form></section></div><section class="panel cng-trend"><div class="panel-heading"><strong>Trailer pressure trend</strong><div class="cng-trend-controls"><span>Stage-end markers</span><div class="range-selector">${[12,24,36,48].map(hours => `<button data-cng-range="${hours}" class="${state.cng.rangeHours === hours ? 'active' : ''}" type="button">${hours}h</button>`).join('')}</div></div></div>${cngPressureChart(well, trailers)}</section><p class="cng-footnote">${completed} of ${well.plannedStages} stages completed for ${escapeHtml(well.name)}.</p></section>`;
}

function cngPressureChart(well, trailers) {
  const cutoff = Date.now() - state.cng.rangeHours * 60 * 60 * 1000;
  const readings = state.cng.readings.filter(reading => reading.wellId === well.id && Number(reading.pressurePsi) >= 0 && new Date(reading.recordedAtIso).getTime() >= cutoff);
  if (!readings.length) return '<div class="empty">Trailer pressure trends will appear after readings are saved for this well.</div>';
  const values = readings.map(reading => Number(reading.pressurePsi));
  const min = Math.min(...values); const max = Math.max(...values); const range = Math.max(50, max - min); const padding = { top:26, right:24, bottom:38, left:54 }; const width = 760; const height = 250; const chartWidth = width - padding.left - padding.right; const chartHeight = height - padding.top - padding.bottom;
  const times = readings.map(reading => new Date(reading.recordedAtIso).getTime()); const start = Math.min(...times); const end = Math.max(...times); const timeRange = Math.max(1, end - start);
  const x = timestamp => padding.left + ((timestamp - start) / timeRange) * chartWidth; const y = value => padding.top + ((max - value) / range) * chartHeight;
  const colors = ['#a91e22', '#205c8d', '#147a5b', '#7c5aa6', '#b87516', '#397a82', '#555555', '#ee2827'];
  const paths = trailers.map((trailer, index) => { const points = readings.filter(reading => reading.trailerId === trailer.id).sort((a, b) => new Date(a.recordedAtIso) - new Date(b.recordedAtIso)); if (!points.length) return ''; return `<polyline points="${points.map(reading => `${x(new Date(reading.recordedAtIso).getTime()).toFixed(1)},${y(Number(reading.pressurePsi)).toFixed(1)}`).join(' ')}" class="cng-chart-line" stroke="${colors[index % colors.length]}"/>`; }).join('');
  const markers = stagesForWell(well.id).filter(stage => new Date(stage.endedAtIso).getTime() >= start && new Date(stage.endedAtIso).getTime() <= end).map(stage => `<g><line x1="${x(new Date(stage.endedAtIso).getTime()).toFixed(1)}" y1="${padding.top}" x2="${x(new Date(stage.endedAtIso).getTime()).toFixed(1)}" y2="${height - padding.bottom}" class="cng-stage-marker"/><text x="${x(new Date(stage.endedAtIso).getTime()).toFixed(1)}" y="17" text-anchor="middle" class="cng-chart-stage-label">End ${stage.stageNumber} · ${stage.mscf} MSCF</text></g>`).join('');
  const grid = [max, (max + min) / 2, min].map(value => `<g><line x1="${padding.left}" y1="${y(value).toFixed(1)}" x2="${width - padding.right}" y2="${y(value).toFixed(1)}" class="cng-chart-grid"/><text x="${padding.left - 9}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end">${Math.round(value).toLocaleString()}</text></g>`).join('');
  const legend = trailers.map((trailer, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(trailer.trailerNumber)}</span>`).join('');
  return `<div class="cng-chart-wrap"><div class="cng-chart-legend">${legend}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Trailer pressure trend for ${escapeHtml(well.name)}"><title>Trailer pressure in PSI</title>${grid}${markers}${paths}<text x="${width / 2}" y="${height - 10}" text-anchor="middle">Last ${state.cng.rangeHours} hours</text><text x="13" y="${height / 2}" transform="rotate(-90 13 ${height / 2})">PSI</text></svg></div>`;
}

function requisitions() {
  const records = state.requisitions || [];
  return `<section><div class="heading"><div><h1>Requisitions</h1><p class="subhead">Create and track supply orders for ${escapeHtml(state.siteName)}.</p></div></div><div class="requisition-layout"><section class="panel form-panel"><div class="panel-heading"><strong>New requisition</strong></div><form id="requisition-form" class="requisition-form"><div class="line-items"><div class="line-items-heading"><strong>Order items</strong><button class="link-button" type="button" data-add-line>+ Add item</button></div><div id="line-items"><div class="order-line"><input required name="item" placeholder="Item or material" aria-label="Item or material" /><input name="quantity" placeholder="Quantity" aria-label="Quantity" /><input name="details" placeholder="Size, spec, or notes" aria-label="Item details" /><button class="remove-line" type="button" aria-label="Remove item">×</button></div></div></div><label class="field">ORDER NOTES<textarea name="notes" placeholder="Delivery instructions, job notes, or approvals needed"></textarea></label><div class="form-footer"><span>Requested by ${escapeHtml(state.userName)}</span><button class="primary" type="submit">Submit requisition</button></div></form></section><section class="panel recent-panel"><div class="panel-heading"><strong>Recent requisitions</strong><span>${records.length} total</span></div>${records.length ? `<div class="requisition-list">${records.slice(0, 6).map(requisitionRow).join('')}</div>` : '<div class="empty">No requisitions submitted for this site yet.</div>'}</section></div></section>`;
}

function requisitionRow(record) { return `<article class="requisition-record"><div><strong>${escapeHtml(record.items[0]?.item || 'Requisition')}</strong><span>${record.items.length} item${record.items.length === 1 ? '' : 's'} · ${escapeHtml(record.requestedBy)}</span></div><div class="requisition-meta"><small>${new Date(record.createdAt).toLocaleDateString()}</small></div></article>`; }

function row(container) { const alert = chemicalAlert(container); const containerCell = `<td data-label="Container" class="container-column"><div class="container-cell">${typeIcon(container.type)}<b>${escapeHtml(container.name)}</b></div></td>`; const actions = `<td data-label="Actions"><div class="container-actions"><button class="action-button action-history" data-history="${container.id}">History</button><button class="action-button action-update" data-update="${container.id}">${container.strap === null ? 'Enter strap' : 'Update'}</button><button class="action-button action-edit" data-edit="${container.id}">Edit</button></div></td>`; if (state.pumping.view) return `<tr>${containerCell}<td data-label="Chemical">${escapeHtml(container.chemical)}</td><td data-label="Strap" class="strap">${formatStrap(container.strap)}</td><td data-label="Set point"><label class="set-point"><input data-setpoint="${container.id}" type="number" min="0" step="0.01" value="${escapeHtml(container.setPointGpt ?? '')}" placeholder="—" /> <span>GPT</span></label></td><td data-label="Target volume" class="target-volume" data-target="${container.id}">${targetGallons(pumpingProgram().pumpedBbl, container.setPointGpt)}</td>${actions}</tr>`; return `<tr>${containerCell}<td data-label="Type"><span class="badge ${container.type === 'ISO tank' ? '' : 'poly'}">${container.type}</span></td><td data-label="Chemical">${escapeHtml(container.chemical)}</td><td data-label="Strap" class="strap">${formatStrap(container.strap)}</td><td data-label="Status"><span class="badge alert-${alert.kind}">${alert.label}</span></td><td data-label="Last updated" class="muted">${container.updatedAt}</td>${actions}</tr>`; }

function modal(html) { return `<section class="modal-backdrop"><div class="modal">${html}</div></section>`; }
function containerModal() { return modal(`<h2>Add container</h2><p>Set up a tank in the currently selected area.</p><form id="container-form"><label class="field">CONTAINER ID<input required name="name" placeholder="Example: ISO #014" /></label><label class="field">TYPE<select name="type"><option>ISO tank</option><option>Poly 330 gal</option></select></label><label class="field">CHEMICAL<input required name="chemical" placeholder="Example: Friction Reducer" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Add container</button></div></form>`); }
function editContainerModal(id) { const container = state.containers.find(item => item.id === id); return modal(`<h2>Edit ${escapeHtml(container.name)}</h2><p>Change its details or move it between work areas.</p><form id="edit-container-form" data-id="${escapeHtml(id)}"><label class="field">CONTAINER ID<input required name="name" value="${escapeHtml(container.name)}" /></label><label class="field">TYPE<select name="type"><option ${container.type === 'ISO tank' ? 'selected' : ''}>ISO tank</option><option ${container.type === 'Poly 330 gal' ? 'selected' : ''}>Poly 330 gal</option></select></label><label class="field">CHEMICAL<input required name="chemical" value="${escapeHtml(container.chemical)}" /></label><label class="field">AREA<select name="area"><option ${container.area === 'Frac' ? 'selected' : ''}>Frac</option><option ${container.area === 'Pump Down' ? 'selected' : ''}>Pump Down</option></select></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save changes</button></div></form>`); }
function historyItem(item) { return `<div class="history-item"><b>${formatStrap(item.strap)}</b><span>${escapeHtml(item.at)} · ${escapeHtml(item.by)}${item.note ? `<em>${escapeHtml(item.note)}</em>` : ''}</span></div>`; }
function strapModal(id) { const container = state.containers.find(item => item.id === id); const history = container.history.slice(0, 4).map(historyItem).join('') || '<div class="muted">No previous strap readings.</div>'; return modal(`<h2>${escapeHtml(container.name)}</h2><p>${escapeHtml(container.chemical)} · ${container.area}</p><form id="strap-form" data-id="${id}"><label class="field">STRAP READING (INCHES)<input required name="strap" type="number" min="0" step="0.1" value="${container.strap ?? ''}" placeholder="56" /></label><label class="field">NOTE <span class="optional">Optional</span><textarea name="note" maxlength="280" placeholder="Example: Transfer just completed; reading verified."></textarea></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save strap</button></div></form><div class="history"><h3>Recent strap history</h3>${history}</div>`); }
function historyChart(container) { const readings = [...(container.history || [])].filter(item => Number.isFinite(Number(item.strap))).reverse(); if (!readings.length) return '<div class="empty history-empty">No strap readings have been entered for this container yet.</div>'; const width = 640; const height = 250; const padding = { top:24, right:22, bottom:42, left:50 }; const chartHeight = height - padding.top - padding.bottom; const chartWidth = width - padding.left - padding.right; const values = readings.map(item => Number(item.strap)); const minimum = Math.min(...values); const maximum = Math.max(...values); const range = Math.max(1, maximum - minimum); const point = (value, index) => ({ x: readings.length === 1 ? padding.left + chartWidth / 2 : padding.left + (index / (readings.length - 1)) * chartWidth, y: padding.top + ((maximum - value) / range) * chartHeight }); const points = values.map(point); const line = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '); const grid = [maximum, (maximum + minimum) / 2, minimum].map(value => { const y = point(value, 0).y; return `<g><line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid"/><text x="${padding.left - 9}" y="${y + 4}" text-anchor="end" class="chart-axis">${Number(value.toFixed(1))}</text></g>`; }).join(''); const labels = readings.map((item, index) => { if (readings.length > 4 && index !== 0 && index !== readings.length - 1) return ''; const { x } = points[index]; return `<text x="${x}" y="${height - 14}" text-anchor="middle" class="chart-axis">${escapeHtml(item.at || `Reading ${index + 1}`)}</text>`; }).join(''); return `<div class="history-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Strap history plot for ${escapeHtml(container.name)}"><title>Strap history plot</title>${grid}<polyline points="${line}" class="chart-line"/>${points.map(({ x, y }, index) => `<g><circle cx="${x}" cy="${y}" r="5" class="chart-point"/><title>${values[index]} inches · ${readings[index].at || 'Recorded reading'}</title></g>`).join('')}${labels}</svg><div class="chart-key"><span><i></i> Strap reading in inches</span><strong>${readings.length} reading${readings.length === 1 ? '' : 's'}</strong></div></div>`; }
function historyModal(id) { const container = state.containers.find(item => item.id === id); const latest = container.history?.[0]; return modal(`<h2>${escapeHtml(container.name)} history</h2><p>${escapeHtml(container.chemical)} · ${container.area}${latest ? ` · Latest ${formatStrap(latest.strap)}` : ''}</p>${historyChart(container)}<div class="history"><h3>Recorded readings</h3>${(container.history || []).slice(0, 8).map(historyItem).join('') || '<div class="muted">No previous strap readings.</div>'}</div><div class="modal-actions"><button type="button" class="primary" data-close>Done</button></div>`); }
function locationModal() { return modal(`<h2>Add location</h2><p>Create a new, separate FieldOps worksite.</p><form id="location-form"><label class="field">LOCATION NAME<input required name="name" placeholder="Example: Anthem" /></label><label class="field">LOCATION ID<input required name="siteId" pattern="[a-z0-9-]+" placeholder="Example: anthem" /><small>Lowercase letters, numbers, and hyphens only.</small></label><label class="field">SITE CODE<input required name="siteCode" autocomplete="off" placeholder="Set a private Site Code" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Create location</button></div></form>`); }
function rotateCodeModal(siteId) { return modal(`<h2>Rotate Site Code</h2><p>Set a new private code for ${escapeHtml(siteId)}. Anyone using the old code will no longer be able to enter.</p><form id="rotate-code-form" data-site-id="${escapeHtml(siteId)}"><label class="field">NEW SITE CODE<input required name="siteCode" autocomplete="off" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save new code</button></div></form>`); }
function removeLocationModal(siteId) { const site = state.sites.find(item => item.id === siteId); return modal(`<h2>Remove ${escapeHtml(site?.name || siteId)}?</h2><p>This permanently removes the location and all of its containers, requisitions, and access history. This cannot be undone.</p><form id="remove-location-form" data-site-id="${escapeHtml(siteId)}"><label class="field">TYPE <b>${escapeHtml(siteId)}</b> TO CONFIRM<input required name="confirmation" autocomplete="off" placeholder="${escapeHtml(siteId)}" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="danger" type="submit">Remove location permanently</button></div></form>`); }
function wellModal(id) { const well = (state.adminWells || []).find(item => item.id === id); const title = well ? `Edit ${well.name}` : 'Add well'; return modal(`<h2>${escapeHtml(title)}</h2><p>Wells are available to CNG users at their assigned location.</p><form id="well-form" data-id="${escapeHtml(well?.id || '')}"><label class="field">LOCATION<select required name="siteId">${state.sites.filter(site => site.active).map(site => `<option value="${escapeHtml(site.id)}" ${well?.siteId === site.id ? 'selected' : ''}>${escapeHtml(site.name)} · ${escapeHtml(site.id)}</option>`).join('')}</select></label><label class="field">WELL NAME<input required name="name" value="${escapeHtml(well?.name || '')}" placeholder="Example: Anthem 14-23H" /></label><label class="field">WELL COLOR<select name="color">${['green','blue','orange','purple','red','teal'].map(color => `<option value="${color}" ${well?.color === color ? 'selected' : ''}>${color[0].toUpperCase() + color.slice(1)}</option>`).join('')}</select></label><label class="field">PLANNED STAGES<input required name="plannedStages" type="number" min="1" step="1" value="${escapeHtml(well?.plannedStages || '')}" placeholder="42" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">${well ? 'Save well' : 'Add well'}</button></div></form>`); }
function trailerModal() { const trailers = state.cng.trailers.sort((a, b) => Number(a.position) - Number(b.position)); return modal(`<h2>Manage trailers</h2><p>Trailers are shared by the whole location. Removing one hides it from live entry and keeps its history.</p><div class="trailer-list">${trailers.length ? trailers.map(trailer => `<div class="trailer-list-item"><div><b>Position ${trailer.position} · Trailer ${escapeHtml(trailer.trailerNumber)}</b><span>${trailer.active ? 'Active' : 'Inactive'}</span></div>${trailer.active ? `<button class="link-button danger-link" data-remove-trailer="${escapeHtml(trailer.id)}">Remove</button>` : ''}</div>`).join('') : '<div class="muted">No trailers have been set up.</div>'}</div><form id="trailer-form"><label class="field">POSITION<input required name="position" type="number" min="1" step="1" value="${Math.max(0, ...trailers.map(trailer => Number(trailer.position) || 0)) + 1}" /></label><label class="field">TRAILER NUMBER<input required name="trailerNumber" placeholder="Example: 200034" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Done</button><button class="primary" type="submit">Add trailer</button></div></form>`); }
function endStageConfirmationModal(data) { return modal(`<h2>End Stage ${data.stageNumber}?</h2><p>Confirm this stage-end record before it is saved.</p><div class="confirmation-list"><div><span>WELL</span><b class="well-confirmation well-status-${escapeHtml(data.well.color)}"><i aria-hidden="true"></i>${escapeHtml(data.well.name)}</b></div><div><span>MSCF PULLED</span><b>${data.mscf}</b></div><div><span>END TIME</span><b>${escapeHtml(formatDateTime(data.endedAtIso))}</b></div></div><form id="confirm-end-stage-form" data-stage="${data.stageNumber}" data-mscf="${data.mscf}" data-note="${escapeHtml(data.note)}" data-ended-at="${data.endedAtIso}"><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Confirm end stage</button></div></form>`); }
function stageHistoryModal() { const well = selectedWell(); const stages = [...stagesForWell(well?.id)].reverse(); return modal(`<h2>${escapeHtml(well?.name || 'Well')} stage history</h2><p>${stages.length} of ${well?.plannedStages || 0} completed</p><div class="stage-history-list">${stages.length ? stages.map(stage => `<div class="stage-history-item"><div><b>Stage ${stage.stageNumber} · ${stage.mscf} MSCF</b><span>${escapeHtml(stage.endedAt)}${stage.note ? ` · ${escapeHtml(stage.note)}` : ''}</span></div><button class="link-button" data-edit-stage="${escapeHtml(stage.id)}">Edit</button></div>`).join('') : '<div class="muted">No stages have been completed for this well.</div>'}</div><div class="modal-actions"><button class="primary" type="button" data-close>Done</button></div>`); }
function editStageModal(id) { const stage = state.cng.stages.find(item => item.id === id); return modal(`<h2>Edit Stage ${stage.stageNumber}</h2><p>Corrections are retained in this stage’s history.</p><form id="edit-stage-form" data-id="${escapeHtml(id)}"><label class="field">STAGE NUMBER<input required name="stageNumber" type="number" min="1" step="1" value="${stage.stageNumber}" /></label><label class="field">MSCF PULLED<input required name="mscf" type="number" min="0" step="0.1" value="${stage.mscf}" /></label><label class="field">NOTE <span class="optional">Optional</span><textarea name="note" maxlength="280">${escapeHtml(stage.note || '')}</textarea></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save correction</button></div></form>`); }

function bind() {
  document.querySelector('#site-gate')?.addEventListener('submit', enterSite);
  document.querySelector('#admin-gate')?.addEventListener('submit', enterAdmin);
  document.querySelector('[data-admin-login]')?.addEventListener('click', () => { state.authMode = 'admin'; render(); });
  document.querySelector('[data-site-login]')?.addEventListener('click', () => { state.authMode = 'site'; render(); });
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.tab; save(); render(); }));
  document.querySelector('[data-cng-well]')?.addEventListener('change', event => { state.cng.selectedWellId = event.currentTarget.value; save(); render(); });
  document.querySelectorAll('[data-cng-range]').forEach(button => button.addEventListener('click', () => { state.cng.rangeHours = Number(button.dataset.cngRange); save(); render(); }));
  document.querySelector('[data-manage-trailers]')?.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', trailerModal()); bindModal(); });
  document.querySelector('[data-stage-history]')?.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', stageHistoryModal()); bindModal(); });
  document.querySelector('#cng-readings-form')?.addEventListener('submit', saveCngReadings);
  document.querySelector('#end-stage-form')?.addEventListener('submit', event => { event.preventDefault(); const well = selectedWell(); const data = new FormData(event.currentTarget); const stageNumber = Number(data.get('stageNumber')); const mscf = Number(data.get('mscf')); if (!well || !Number.isInteger(stageNumber) || stageNumber < 1 || !Number.isFinite(mscf) || mscf < 0) { toast('Enter a valid stage number and MSCF total.'); return; } app.insertAdjacentHTML('beforeend', endStageConfirmationModal({ well, stageNumber, mscf, note:String(data.get('note')).trim(), endedAtIso:new Date().toISOString() })); bindModal(); });
  document.querySelectorAll('[data-station]').forEach(input => input.addEventListener('input', () => { state.rundown.values[input.dataset.station] = input.value; save(); }));
  document.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => { state.rundown.partialStart = state.rundown.partialStart === button.dataset.start ? '' : button.dataset.start; save(); render(); }));
  document.querySelectorAll('[data-rundown-toggle]').forEach(button => button.addEventListener('click', () => { const target = button.dataset.rundownToggle; if (target === 'recipient') state.rundown.recipientOpen = !state.rundown.recipientOpen; if (target === 'preview') state.rundown.previewOpen = !state.rundown.previewOpen; if (target === 'compact') state.rundown.compact = !state.rundown.compact; save(); render(); }));
  document.querySelector('[data-rundown-done]')?.addEventListener('click', () => { state.rundown.phoneNumber = document.querySelector('#engineer-phone').value.trim(); state.rundown.recipientOpen = false; save(); render(); });
  document.querySelector('[data-rundown-clear]')?.addEventListener('click', () => { if (window.confirm('Clear all station values and the Start selection? The engineer phone number will stay saved.')) { state.rundown.values = emptyStations(); state.rundown.partialStart = ''; save(); render(); } });
  document.querySelector('[data-rundown-send]')?.addEventListener('click', () => { const phone = state.rundown.phoneNumber.trim(); if (!phone) { state.rundown.recipientOpen = true; save(); render(); toast('Enter the engineer’s phone number first.'); return; } window.location.href = `sms:${phone}?body=${encodeURIComponent(reportPreview())}`; });
  document.querySelector('[data-sign-out]')?.addEventListener('click', async () => { if (liveMode) await signOut(auth); state.signedIn = false; state.siteId = ''; state.siteName = ''; state.userName = ''; state.isAdmin = false; state.authMode = 'site'; save(); render(); });
  document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => { state.area = button.dataset.area; save(); render(); }));
  document.querySelector('[data-toggle-pumping]')?.addEventListener('click', () => { state.pumping.view = !state.pumping.view; save(); render(); });
  document.querySelector('[data-pumped-bbl]')?.addEventListener('input', event => { pumpingProgram().pumpedBbl = event.currentTarget.value; save(); updatePumpingTargets(); });
  document.querySelector('[data-pumped-bbl]')?.addEventListener('change', savePumpedVolume);
  document.querySelectorAll('[data-setpoint]').forEach(input => { input.addEventListener('input', event => { const container = state.containers.find(item => item.id === event.currentTarget.dataset.setpoint); container.setPointGpt = event.currentTarget.value; save(); updatePumpingTargets(); }); input.addEventListener('change', saveSetPoint); });
  document.querySelector('[data-open="container"]')?.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', containerModal()); bindModal(); });
  document.querySelector('[data-open="location"]')?.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', locationModal()); bindModal(); });
  document.querySelector('[data-open="well"]')?.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', wellModal()); bindModal(); });
  document.querySelectorAll('[data-rotate-site]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', rotateCodeModal(button.dataset.rotateSite)); bindModal(); }));
  document.querySelectorAll('[data-remove-site]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', removeLocationModal(button.dataset.removeSite)); bindModal(); }));
  document.querySelectorAll('[data-toggle-site]').forEach(button => button.addEventListener('click', async () => { try { await updateSite({ siteId: button.dataset.toggleSite, active: button.dataset.siteActive !== 'true' }); await hydrateAdmin(); render(); toast('Location status updated.'); } catch (error) { toast(error.message || 'Unable to update location.'); } }));
  document.querySelectorAll('[data-edit-well]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', wellModal(button.dataset.editWell)); bindModal(); }));
  document.querySelectorAll('[data-toggle-well]').forEach(button => button.addEventListener('click', () => updateWellStatus(button.dataset.toggleWell, button.dataset.wellActive !== 'true')));
  document.querySelectorAll('[data-update]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', strapModal(button.dataset.update)); bindModal(); }));
  document.querySelectorAll('[data-history]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', historyModal(button.dataset.history)); bindModal(); }));
  document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', editContainerModal(button.dataset.edit)); bindModal(); }));
  document.querySelector('[data-add-line]')?.addEventListener('click', () => { document.querySelector('#line-items').insertAdjacentHTML('beforeend', orderLine()); bindRequisitionLines(); });
  document.querySelector('#requisition-form')?.addEventListener('submit', submitRequisition);
  bindRequisitionLines();
}

function orderLine() { return `<div class="order-line"><input required name="item" placeholder="Item or material" aria-label="Item or material" /><input name="quantity" placeholder="Quantity" aria-label="Quantity" /><input name="details" placeholder="Size, spec, or notes" aria-label="Item details" /><button class="remove-line" type="button" aria-label="Remove item">×</button></div>`; }
function bindRequisitionLines() { document.querySelectorAll('.remove-line').forEach(button => { button.onclick = () => { const lines = document.querySelectorAll('.order-line'); if (lines.length > 1) button.closest('.order-line').remove(); }; }); }
async function submitRequisition(event) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const lines = [...form.querySelectorAll('.order-line')].map(line => ({ item:line.querySelector('[name="item"]').value.trim(), quantity:line.querySelector('[name="quantity"]').value.trim(), details:line.querySelector('[name="details"]').value.trim() })).filter(item => item.item); const record = { id:crypto.randomUUID(), notes:String(data.get('notes')).trim(), items:lines, requestedBy:state.userName, createdAt:new Date().toISOString() }; try { if (liveMode) { const { id, ...payload } = record; const created = await addDoc(collection(database, 'sites', state.siteId, 'requisitions'), payload); record.id = created.id; } state.requisitions = [record, ...(state.requisitions || [])]; save(); render(); toast('Requisition submitted.'); } catch (error) { toast(error.message || 'Unable to submit requisition.'); } }
async function savePumpedVolume(event) { const value = event.currentTarget.value.trim(); const pumpedBbl = value === '' ? '' : Number(value); if (value !== '' && (!Number.isFinite(pumpedBbl) || pumpedBbl < 0)) { toast('Enter a valid pumped volume.'); return; } const program = pumpingProgram(); program.pumpedBbl = value === '' ? '' : pumpedBbl; save(); try { if (liveMode) await setDoc(doc(database, 'sites', state.siteId, 'pumpingPrograms', pumpingProgramId()), { area: state.area, pumpedBbl: program.pumpedBbl, updatedAtIso: new Date().toISOString(), updatedBy: state.userName }, { merge: true }); toast('Pumped volume saved.'); } catch (error) { toast(error.message || 'Unable to save pumped volume.'); } }
async function saveSetPoint(event) { const container = state.containers.find(item => item.id === event.currentTarget.dataset.setpoint); const value = event.currentTarget.value.trim(); const setPointGpt = value === '' ? null : Number(value); if (setPointGpt !== null && (!Number.isFinite(setPointGpt) || setPointGpt < 0)) { toast('Enter a valid GPT set point.'); return; } container.setPointGpt = setPointGpt; save(); updatePumpingTargets(); try { if (liveMode) await updateDoc(doc(database, 'sites', state.siteId, 'containers', container.id), { setPointGpt }); toast(`${container.name} set point saved.`); } catch (error) { toast(error.message || 'Unable to save set point.'); } }
async function saveCngReadings(event) { event.preventDefault(); const well = selectedWell(); if (!well) { toast('Select a well before saving readings.'); return; } const batchId = crypto.randomUUID(); const recordedAtIso = new Date().toISOString(); const changed = activeTrailers().map(trailer => { const psiField = event.currentTarget.querySelector(`[data-cng-psi="${trailer.id}"]`); const tempField = event.currentTarget.querySelector(`[data-cng-temp="${trailer.id}"]`); const psi = psiField.value.trim(); const temp = tempField.value.trim(); if (!psi && !temp) return null; const pressurePsi = Number(psi); const temperatureF = temp === '' ? null : Number(temp); if (!psi || !Number.isFinite(pressurePsi) || pressurePsi < 0 || (temp !== '' && (!Number.isFinite(temperatureF)))) throw new Error(`Enter a valid PSI reading for trailer ${trailer.trailerNumber}.`); return { id:crypto.randomUUID(), trailerId:trailer.id, trailerNumber:trailer.trailerNumber, wellId:well.id, pressurePsi, temperatureF, recordedAtIso, recordedAt:'', by:state.userName, batchId }; }).filter(Boolean); try { if (!changed.length) { toast('Enter at least one PSI reading before saving.'); return; } const at = formatDateTime(recordedAtIso); changed.forEach(reading => { reading.recordedAt = at; }); if (liveMode) { const batch = writeBatch(database); changed.forEach(reading => { const { id, ...payload } = reading; batch.set(doc(collection(database, 'sites', state.siteId, 'cngReadings'), id), payload); }); await batch.commit(); } state.cng.readings.push(...changed); save(); render(); toast(`Saved ${changed.length} trailer reading${changed.length === 1 ? '' : 's'}.`); } catch (error) { toast(error.message || 'Unable to save readings.'); } }
async function updateWellStatus(id, active) { const well = (state.adminWells || []).find(item => item.id === id); if (!well) return; try { if (liveMode) await updateDoc(doc(database, 'sites', well.siteId, 'wells', id), { active }); well.active = active; save(); render(); toast(`Well ${active ? 'activated' : 'deactivated'}.`); } catch (error) { toast(error.message || 'Unable to update well.'); } }

function bindModal() {
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.querySelector('.modal-backdrop')?.remove()));
  document.querySelector('#well-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const well = { id:form.dataset.id || crypto.randomUUID(), siteId:String(data.get('siteId')), name:String(data.get('name')).trim(), color:String(data.get('color')), plannedStages:Number(data.get('plannedStages')), active:true }; if (well.name.length < 2 || !Number.isInteger(well.plannedStages) || well.plannedStages < 1) { toast('Enter a well name and planned stage count.'); return; } try { if (liveMode) await setDoc(doc(database, 'sites', well.siteId, 'wells', well.id), { name:well.name, color:well.color, plannedStages:well.plannedStages, active:form.dataset.id ? ((state.adminWells || []).find(item => item.id === well.id)?.active ?? true) : true, updatedAtIso:new Date().toISOString(), updatedBy:state.userName }, { merge:true }); const site = state.sites.find(item => item.id === well.siteId); const record = { ...well, siteName:site?.name || well.siteId }; const index = (state.adminWells || []).findIndex(item => item.id === well.id); if (index >= 0) state.adminWells[index] = { ...state.adminWells[index], ...record }; else state.adminWells = [...(state.adminWells || []), record]; save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`${well.name} is ready for CNG.`); } catch (error) { toast(error.message || 'Unable to save well.'); } });
  document.querySelector('#trailer-form')?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); const position = Number(data.get('position')); const trailerNumber = String(data.get('trailerNumber')).trim(); if (!Number.isInteger(position) || position < 1 || !trailerNumber) { toast('Enter a valid position and trailer number.'); return; } if (state.cng.trailers.some(trailer => trailer.active && (Number(trailer.position) === position || trailer.trailerNumber === trailerNumber))) { toast('Active trailer positions and trailer numbers must be unique.'); return; } const trailer = { id:crypto.randomUUID(), position, trailerNumber, active:true, createdAtIso:new Date().toISOString(), createdBy:state.userName }; try { if (liveMode) { const { id, ...payload } = trailer; await setDoc(doc(database, 'sites', state.siteId, 'cngTrailers', id), payload); } state.cng.trailers.push(trailer); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`Trailer ${trailerNumber} added in position ${position}.`); } catch (error) { toast(error.message || 'Unable to add trailer.'); } });
  document.querySelectorAll('[data-remove-trailer]').forEach(button => button.addEventListener('click', async () => { const trailer = state.cng.trailers.find(item => item.id === button.dataset.removeTrailer); if (!trailer || !window.confirm(`Remove Trailer ${trailer.trailerNumber} from the active lineup? Its history will remain.`)) return; try { if (liveMode) await updateDoc(doc(database, 'sites', state.siteId, 'cngTrailers', trailer.id), { active:false, removedAtIso:new Date().toISOString(), removedBy:state.userName }); trailer.active = false; save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`Trailer ${trailer.trailerNumber} removed from live entry.`); } catch (error) { toast(error.message || 'Unable to remove trailer.'); } }));
  document.querySelector('#confirm-end-stage-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const well = selectedWell(); const stageNumber = Number(form.dataset.stage); const mscf = Number(form.dataset.mscf); const duplicate = stagesForWell(well.id).some(stage => Number(stage.stageNumber) === stageNumber); if (duplicate && !window.confirm(`Stage ${stageNumber} already exists. Save another record anyway?`)) return; const stage = { id:crypto.randomUUID(), wellId:well.id, stageNumber, mscf, note:form.dataset.note || '', endedAtIso:form.dataset.endedAt, endedAt:formatDateTime(form.dataset.endedAt), by:state.userName, revisions:[] }; try { if (liveMode) { const { id, ...payload } = stage; await setDoc(doc(database, 'sites', state.siteId, 'cngStages', id), payload); } state.cng.stages.push(stage); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`Stage ${stageNumber} ended at ${mscf} MSCF.`); } catch (error) { toast(error.message || 'Unable to end stage.'); } });
  document.querySelectorAll('[data-edit-stage]').forEach(button => button.addEventListener('click', () => { document.querySelector('.modal-backdrop')?.remove(); app.insertAdjacentHTML('beforeend', editStageModal(button.dataset.editStage)); bindModal(); }));
  document.querySelector('#edit-stage-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const stage = state.cng.stages.find(item => item.id === form.dataset.id); const data = new FormData(form); const stageNumber = Number(data.get('stageNumber')); const mscf = Number(data.get('mscf')); const note = String(data.get('note')).trim(); if (!Number.isInteger(stageNumber) || stageNumber < 1 || !Number.isFinite(mscf) || mscf < 0) { toast('Enter a valid stage number and MSCF total.'); return; } const revision = { stageNumber:stage.stageNumber, mscf:stage.mscf, note:stage.note || '', changedAtIso:new Date().toISOString(), changedBy:state.userName }; const changes = { stageNumber, mscf, note, revisions:[revision, ...(stage.revisions || [])], updatedAtIso:new Date().toISOString(), updatedBy:state.userName }; try { if (liveMode) await updateDoc(doc(database, 'sites', state.siteId, 'cngStages', stage.id), changes); Object.assign(stage, changes); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`Stage ${stageNumber} correction saved.`); } catch (error) { toast(error.message || 'Unable to save stage correction.'); } });
  document.querySelector('#container-form')?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name')).trim(); const container = { id: crypto.randomUUID(), name, type:String(data.get('type')), area:state.area, chemical:String(data.get('chemical')).trim(), strap:null, updatedAt:'Not entered', updatedAtIso:null, history:[] }; try { if (liveMode) { const { id, ...payload } = container; const created = await addDoc(collection(database, 'sites', state.siteId, 'containers'), payload); container.id = created.id; } state.containers.unshift(container); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`${name} added to ${state.area}.`); } catch (error) { toast(error.message || 'Unable to add container.'); } });
  document.querySelector('#edit-container-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const container = state.containers.find(item => item.id === form.dataset.id); const data = new FormData(form); const changes = { name:String(data.get('name')).trim(), type:String(data.get('type')), chemical:String(data.get('chemical')).trim(), area:String(data.get('area')) }; try { if (liveMode) await updateDoc(doc(database, 'sites', state.siteId, 'containers', container.id), changes); Object.assign(container, changes); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`${container.name} updated.`); } catch (error) { toast(error.message || 'Unable to update container.'); } });
  document.querySelector('#location-form')?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { if (!liveMode || !state.isAdmin) throw new Error('Administrator sign-in is required.'); const result = await createSite({ name: String(data.get('name')).trim(), siteId: String(data.get('siteId')).trim(), siteCode: String(data.get('siteCode')).trim() }); await hydrateAdmin(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`${result.data.site.name} is ready.`); } catch (error) { toast(error.message || 'Unable to create location.'); } });
  document.querySelector('#rotate-code-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; try { await updateSite({ siteId: form.dataset.siteId, siteCode: String(new FormData(form).get('siteCode')).trim() }); document.querySelector('.modal-backdrop')?.remove(); toast('Site Code updated.'); } catch (error) { toast(error.message || 'Unable to update Site Code.'); } });
  document.querySelector('#remove-location-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const siteId = form.dataset.siteId; if (String(new FormData(form).get('confirmation')).trim() !== siteId) { toast(`Type ${siteId} exactly to confirm removal.`); return; } try { const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Removing…'; await deleteSite({ siteId }); await hydrateAdmin(); document.querySelector('.modal-backdrop')?.remove(); render(); toast('Location removed permanently.'); } catch (error) { toast(error.message || 'Unable to remove location.'); } });
  document.querySelector('#strap-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const container = state.containers.find(item => item.id === form.dataset.id); const data = new FormData(form); const strap = Number(data.get('strap')); const note = String(data.get('note')).trim(); const at = new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(new Date()); const updatedAtIso = new Date().toISOString(); const historyItem = { strap, at, atIso: updatedAtIso, by:state.userName, ...(note ? { note } : {}) }; try { if (liveMode) await updateDoc(doc(database, 'sites', state.siteId, 'containers', container.id), { strap, updatedAt: at, updatedAtIso, history: [historyItem, ...container.history] }); container.strap = strap; container.updatedAt = at; container.updatedAtIso = updatedAtIso; container.history.unshift(historyItem); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`Strap saved for ${container.name}.`); } catch (error) { toast(error.message || 'Unable to save strap.'); } });
}

async function enterSite(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const siteCode = String(data.get('siteCode')).trim();
  const operatorName = String(data.get('userName')).trim();
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Checking Site Code…';
  try {
    if (liveMode) {
      const result = await joinSite({ siteCode, operatorName });
      await signInWithCustomToken(auth, result.data.customToken);
      state.siteId = result.data.site.id;
      state.siteName = result.data.site.name;
      state.userName = operatorName;
      state.isAdmin = false;
      await hydrateSite();
    } else {
      state.siteName = siteCode.toUpperCase();
      state.userName = operatorName;
    }
    state.signedIn = true;
    save();
    render();
  } catch (error) {
    submit.disabled = false;
    submit.textContent = 'Enter FieldOps';
    toast(error.message || 'Unable to enter this site.');
  }
}

async function enterAdmin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Signing in…';
  try {
    if (!liveMode) throw new Error('Administrator sign-in is available after Firebase is connected.');
    const credential = await signInWithEmailAndPassword(auth, String(data.get('email')).trim(), String(data.get('password')));
    const admin = await getDoc(doc(database, 'admins', credential.user.uid));
    if (!admin.exists() || admin.data().active !== true) {
      await signOut(auth);
      throw new Error('This account is not authorized as a FieldOps administrator.');
    }
    state.siteId = '';
    state.siteName = 'System Admin';
    state.userName = credential.user.email;
    state.isAdmin = true;
    state.signedIn = true;
    state.containers = [];
    state.requisitions = [];
    await hydrateAdmin();
    save();
    render();
  } catch (error) {
    submit.disabled = false;
    submit.textContent = 'Sign in as administrator';
    toast(error.message || 'Unable to sign in.');
  }
}

async function hydrateSite() {
  const [containers, requisitions, pumpingPrograms, wells, trailers, readings, stages] = await Promise.all([
    getDocs(collection(database, 'sites', state.siteId, 'containers')),
    getDocs(collection(database, 'sites', state.siteId, 'requisitions')),
    getDocs(collection(database, 'sites', state.siteId, 'pumpingPrograms')),
    getDocs(collection(database, 'sites', state.siteId, 'wells')),
    getDocs(collection(database, 'sites', state.siteId, 'cngTrailers')),
    getDocs(collection(database, 'sites', state.siteId, 'cngReadings')),
    getDocs(collection(database, 'sites', state.siteId, 'cngStages')),
  ]);
  state.containers = containers.docs.map(record => ({ id: record.id, ...record.data(), history: record.data().history || [] }));
  state.requisitions = requisitions.docs.map(record => ({ id: record.id, ...record.data() })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const programs = { ...seed.pumping.programs };
  pumpingPrograms.docs.forEach(record => { const area = record.data().area; if (area === 'Frac' || area === 'Pump Down') programs[area] = { ...programs[area], ...record.data() }; });
  state.pumping.programs = programs;
  state.cng.wells = wells.docs.map(record => ({ id:record.id, ...record.data() }));
  state.cng.trailers = trailers.docs.map(record => ({ id:record.id, ...record.data() }));
  state.cng.readings = readings.docs.map(record => ({ id:record.id, ...record.data() }));
  state.cng.stages = stages.docs.map(record => ({ id:record.id, ...record.data(), revisions:record.data().revisions || [] }));
  if (!selectedWell() && cngWells()[0]) state.cng.selectedWellId = cngWells()[0].id;
}

async function hydrateAdmin() {
  const sites = await getDocs(collection(database, 'sites'));
  state.sites = sites.docs.map(record => ({ id: record.id, ...record.data() }));
  const wellLists = await Promise.all(state.sites.map(async site => ({ site, records:await getDocs(collection(database, 'sites', site.id, 'wells')) })));
  state.adminWells = wellLists.flatMap(({ site, records }) => records.docs.map(record => ({ id:record.id, siteId:site.id, siteName:site.name, ...record.data() })));
}

async function restoreLiveSession(user) {
  if (!user) {
    if (state.signedIn) {
      state.signedIn = false;
      state.siteId = '';
      state.siteName = '';
      state.userName = '';
      state.isAdmin = false;
      state.authMode = 'site';
      save();
      render();
    }
    return;
  }

  try {
    const token = await user.getIdTokenResult();
    const claimedSiteId = token.claims.siteId;
    if (token.claims.role === 'field' && typeof claimedSiteId === 'string') {
      const site = await getDoc(doc(database, 'sites', claimedSiteId));
      if (!site.exists() || site.data().active !== true) throw new Error('This location is no longer active.');
      state.siteId = claimedSiteId;
      state.siteName = site.data().name;
      state.userName = state.userName || 'Field operator';
      state.isAdmin = false;
      state.signedIn = true;
      await hydrateSite();
    } else {
      const admin = await getDoc(doc(database, 'admins', user.uid));
      if (!admin.exists() || admin.data().active !== true) throw new Error('This account is not authorized as a FieldOps administrator.');
      state.siteId = '';
      state.siteName = 'System Admin';
      state.userName = user.email || 'Administrator';
      state.isAdmin = true;
      state.signedIn = true;
      await hydrateAdmin();
    }
    save();
    render();
  } catch (error) {
    await signOut(auth);
    state.signedIn = false;
    state.siteId = '';
    state.siteName = '';
    state.userName = '';
    state.isAdmin = false;
    state.authMode = 'site';
    save();
    render();
  }
}

function toast(message) { const node = document.createElement('div'); node.className = 'toast'; node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 2800); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
if (liveMode) {
  setPersistence(auth, browserLocalPersistence)
    .catch(() => {})
    .finally(() => onAuthStateChanged(auth, restoreLiveSession));
}
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {}));
}
