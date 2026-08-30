import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInWithCustomToken, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, updateDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

const storageKey = 'fieldops-demo-v1';
const firebaseConfig = window.FIELDOPS_FIREBASE_CONFIG;
const liveMode = Boolean(firebaseConfig?.projectId);
let auth;
let database;
let joinSite;
let createSite;
let updateSite;

if (liveMode) {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  database = getFirestore(firebaseApp);
  joinSite = httpsCallable(getFunctions(firebaseApp, 'us-west3'), 'joinSite');
  createSite = httpsCallable(getFunctions(firebaseApp, 'us-west3'), 'createSite');
  updateSite = httpsCallable(getFunctions(firebaseApp, 'us-west3'), 'updateSite');
}

const isoIcon = () => `<span class="tank-icon" aria-label="Blue framed ISO tank"><svg viewBox="0 0 66 44" role="img"><rect x="3" y="4" width="60" height="35" rx="2" fill="#205c8d"/><rect x="7" y="8" width="52" height="27" fill="#d9e1e5"/><ellipse cx="33" cy="21.5" rx="20" ry="12.5" fill="#b8c5cb" stroke="#6e8089"/><path d="M8 8h50v27H8zM8 12h50M8 31h50M15 6v31m36-31v31" fill="none" stroke="#164b76" stroke-width="2.5"/></svg></span>`;
const polyIcon = () => `<span class="tank-icon" aria-label="White caged poly tote"><svg viewBox="0 0 66 44" role="img"><rect x="10" y="5" width="46" height="31" rx="4" fill="#f3f5f1" stroke="#a6adb0"/><path d="M11 13h44M11 21h44M11 29h44M20 6v29m12-29v29m12-29v29" stroke="#8c9699" stroke-width="1.5"/><path d="M8 37h50v4H8z" fill="#252d33"/><rect x="28" y="2" width="11" height="4" rx="1" fill="#262d31"/><path d="M47 29h8v4h-8z" fill="#1c252a"/></svg></span>`;

const seed = {
  siteId: '', siteName: '', userName: '', signedIn: false, isAdmin: false, authMode: 'site', area: 'Frac', tab: 'chemicals', requisitions: [], sites: [],
  containers: [
    { id:'iso-014', name:'ISO #014', type:'ISO tank', area:'Frac', chemical:'Friction Reducer', strap:56, updatedAt:'Today, 9:42 AM', updatedAtIso:new Date().toISOString(), history:[{strap:56, by:'Demo operator', at:'Today, 9:42 AM'}] },
    { id:'poly-05', name:'Poly #05', type:'Poly 330 gal', area:'Frac', chemical:'Scale Inhibitor', strap:31, updatedAt:'Aug 27', updatedAtIso:'2026-08-27T12:00:00.000Z', history:[{strap:31, by:'Demo operator', at:'Aug 27'}] },
    { id:'iso-021', name:'ISO #021', type:'ISO tank', area:'Pump Down', chemical:'Biocide', strap:48.5, updatedAt:'Yesterday', updatedAtIso:'2026-08-28T12:00:00.000Z', history:[{strap:48.5, by:'Demo operator', at:'Yesterday'}] },
    { id:'poly-08', name:'Poly #08', type:'Poly 330 gal', area:'Pump Down', chemical:'Corrosion Inhibitor', strap:null, updatedAt:'Not entered', updatedAtIso:null, history:[] },
  ],
};

const load = () => ({ ...seed, ...JSON.parse(localStorage.getItem(storageKey) || '{}') });
let state = load();
if (liveMode) {
  state.signedIn = false;
  state.siteId = '';
}
const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
const app = document.querySelector('#app');

function formatStrap(value) { return value === null || value === '' ? '—' : `${value} in`; }
function typeIcon(type) { return type === 'ISO tank' ? isoIcon() : polyIcon(); }
function areaContainers() { return state.containers.filter(container => container.area === state.area); }
function render() {
  app.innerHTML = `${state.signedIn ? shell() : gate()}${state.signedIn ? content() : ''}`;
  bind();
}

function gate() {
  if (state.authMode === 'admin') return `<section class="overlay"><form class="gate" id="admin-gate"><div class="gate-mark">FO</div><h2>Administrator sign in</h2><p>Use your FieldOps administrator email and password to manage worksite access.</p><label class="field">EMAIL<input required name="email" type="email" autocomplete="email" /></label><label class="field">PASSWORD<input required name="password" type="password" autocomplete="current-password" /></label><button class="primary" type="submit">Sign in as administrator</button><button class="link-button auth-switch" type="button" data-site-login>← Back to Site Code</button></form></section>`;
  return `<section class="overlay"><form class="gate" id="site-gate"><div class="gate-mark">FO</div><h2>Welcome to FieldOps</h2><p>Enter the Site Code for this work location. You will only see data assigned to that site.</p><label class="field">SITE CODE<input required name="siteCode" autocomplete="off" placeholder="Enter site code" /></label><label class="field">YOUR NAME <input required name="userName" autocomplete="name" placeholder="Used on strap history" /></label><button class="primary" type="submit">Enter FieldOps</button><button class="link-button auth-switch" type="button" data-admin-login>Administrator sign in</button><div class="gate-note">${liveMode ? 'Your Site Code is checked securely before FieldOps opens.' : 'Demo mode accepts any Site Code.'}</div></form></section>`;
}

function shell() { return `<header class="topbar"><div class="brand">FieldOps <small>Worksite Operations</small></div>${state.isAdmin ? '<div class="admin-label">Administrator console</div>' : `<nav class="tabs" aria-label="FieldOps sections"><button data-tab="rundown" class="${state.tab === 'rundown' ? 'active' : ''}">T-Belt RunDown</button><button data-tab="chemicals" class="${state.tab === 'chemicals' ? 'active' : ''}">Chemicals</button><button data-tab="requisitions" class="${state.tab === 'requisitions' ? 'active' : ''}">Requisitions</button></nav>`}<div class="site-actions"><span class="site-chip">${escapeHtml(state.siteName)}</span><button class="sign-out" data-sign-out type="button">Sign out</button></div></header>`; }

function content() { return `<main class="page">${state.isAdmin ? adminDashboard() : state.tab === 'chemicals' ? chemicals() : state.tab === 'requisitions' ? requisitions() : rundown()}</main>`; }
function adminDashboard() { const activeCount = state.sites.filter(site => site.active).length; return `<section><div class="heading"><div><h1>Administrator console</h1><p class="subhead">Manage FieldOps locations and access.</p></div><button class="primary" data-open="location">+ Add location</button></div><section class="panel"><div class="panel-heading"><strong>Locations</strong><span>${activeCount} active</span></div>${state.sites.length ? `<table><thead><tr><th>Location</th><th>Status</th><th>Location ID</th><th></th></tr></thead><tbody>${state.sites.map(site => `<tr><td><b>${escapeHtml(site.name)}</b></td><td><span class="badge">${site.active ? 'Active' : 'Inactive'}</span></td><td class="muted">${escapeHtml(site.id)}</td><td><button class="link-button" data-rotate-site="${escapeHtml(site.id)}">Rotate code</button><button class="link-button" data-toggle-site="${escapeHtml(site.id)}" data-site-active="${site.active}">${site.active ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No locations are available.</div>'}</section></section>`; }
function rundown() { return `<section class="rundown"><div><h2>T-Belt RunDown</h2><p>This remains its own FieldOps work area. Its existing workflow can be moved here once the current T-Belt RunDown source is available.</p></div></section>`; }

function chemicalAlert(container) { if (container.strap === null || container.strap === undefined) return { label:'Strap needed', kind:'missing' }; if (container.updatedAtIso && Date.now() - new Date(container.updatedAtIso).getTime() > 36 * 60 * 60 * 1000) return { label:'Review strap', kind:'review' }; return { label:'Current', kind:'current' }; }
function chemicals() {
  const containers = areaContainers();
  const isoCount = containers.filter(item => item.type === 'ISO tank').length;
  const polyCount = containers.length - isoCount;
  const missingCount = containers.filter(item => chemicalAlert(item).kind === 'missing').length;
  const reviewCount = containers.filter(item => chemicalAlert(item).kind === 'review').length;
  return `<section><div class="heading"><div><div class="title-row"><h1>Chemicals</h1><div class="segment" aria-label="Chemical area"><button data-area="Frac" class="${state.area === 'Frac' ? 'active' : ''}">Frac</button><button data-area="Pump Down" class="${state.area === 'Pump Down' ? 'active' : ''}">Pump Down</button></div></div><p class="subhead">${state.area} chemical containers and latest strap measurements.</p></div><button class="primary" data-open="container">+ Add container</button></div><section class="metrics"><div class="metric"><small>Containers assigned to ${state.area}</small><strong>${containers.length}</strong></div><div class="metric"><small>ISO tanks</small><strong>${isoCount}</strong></div><div class="metric"><small>Strap needed</small><strong>${missingCount}</strong></div><div class="metric"><small>Review readings</small><strong>${reviewCount}</strong></div></section><section class="panel"><div class="panel-heading"><strong>${state.area} container inventory</strong><span>Latest strap entries</span></div>${containers.length ? `<table><thead><tr><th>Container</th><th>Type</th><th>Chemical</th><th>Strap</th><th>Status</th><th>Last updated</th><th></th></tr></thead><tbody>${containers.map(row).join('')}</tbody></table>` : '<div class="empty">No containers have been added to this area.</div>'}</section></section>`;
}

function requisitions() {
  const records = state.requisitions || [];
  return `<section><div class="heading"><div><h1>Requisitions</h1><p class="subhead">Create and track supply orders for ${escapeHtml(state.siteName)}.</p></div></div><div class="requisition-layout"><section class="panel form-panel"><div class="panel-heading"><strong>New requisition</strong></div><form id="requisition-form" class="requisition-form"><div class="line-items"><div class="line-items-heading"><strong>Order items</strong><button class="link-button" type="button" data-add-line>+ Add item</button></div><div id="line-items"><div class="order-line"><input required name="item" placeholder="Item or material" aria-label="Item or material" /><input name="quantity" placeholder="Quantity" aria-label="Quantity" /><input name="details" placeholder="Size, spec, or notes" aria-label="Item details" /><button class="remove-line" type="button" aria-label="Remove item">×</button></div></div></div><label class="field">ORDER NOTES<textarea name="notes" placeholder="Delivery instructions, job notes, or approvals needed"></textarea></label><div class="form-footer"><span>Requested by ${escapeHtml(state.userName)}</span><button class="primary" type="submit">Submit requisition</button></div></form></section><section class="panel recent-panel"><div class="panel-heading"><strong>Recent requisitions</strong><span>${records.length} total</span></div>${records.length ? `<div class="requisition-list">${records.slice(0, 6).map(requisitionRow).join('')}</div>` : '<div class="empty">No requisitions submitted for this site yet.</div>'}</section></div></section>`;
}

function requisitionRow(record) { return `<article class="requisition-record"><div><strong>${escapeHtml(record.items[0]?.item || 'Requisition')}</strong><span>${record.items.length} item${record.items.length === 1 ? '' : 's'} · ${escapeHtml(record.requestedBy)}</span></div><div class="requisition-meta"><small>${new Date(record.createdAt).toLocaleDateString()}</small></div></article>`; }

function row(container) { const alert = chemicalAlert(container); return `<tr><td><div class="container-cell">${typeIcon(container.type)}<b>${escapeHtml(container.name)}</b></div></td><td><span class="badge ${container.type === 'ISO tank' ? '' : 'poly'}">${container.type}</span></td><td>${escapeHtml(container.chemical)}</td><td class="strap">${formatStrap(container.strap)}</td><td><span class="badge alert-${alert.kind}">${alert.label}</span></td><td class="muted">${container.updatedAt}</td><td><button class="link-button" data-update="${container.id}">${container.strap === null ? 'Enter strap' : 'Update'}</button><button class="link-button" data-edit="${container.id}">Edit</button></td></tr>`; }

function modal(html) { return `<section class="modal-backdrop"><div class="modal">${html}</div></section>`; }
function containerModal() { return modal(`<h2>Add container</h2><p>Set up a tank in the currently selected area.</p><form id="container-form"><label class="field">CONTAINER ID<input required name="name" placeholder="Example: ISO #014" /></label><label class="field">TYPE<select name="type"><option>ISO tank</option><option>Poly 330 gal</option></select></label><label class="field">CHEMICAL<input required name="chemical" placeholder="Example: Friction Reducer" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Add container</button></div></form>`); }
function editContainerModal(id) { const container = state.containers.find(item => item.id === id); return modal(`<h2>Edit ${escapeHtml(container.name)}</h2><p>Change its details or move it between work areas.</p><form id="edit-container-form" data-id="${escapeHtml(id)}"><label class="field">CONTAINER ID<input required name="name" value="${escapeHtml(container.name)}" /></label><label class="field">TYPE<select name="type"><option ${container.type === 'ISO tank' ? 'selected' : ''}>ISO tank</option><option ${container.type === 'Poly 330 gal' ? 'selected' : ''}>Poly 330 gal</option></select></label><label class="field">CHEMICAL<input required name="chemical" value="${escapeHtml(container.chemical)}" /></label><label class="field">AREA<select name="area"><option ${container.area === 'Frac' ? 'selected' : ''}>Frac</option><option ${container.area === 'Pump Down' ? 'selected' : ''}>Pump Down</option></select></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save changes</button></div></form>`); }
function strapModal(id) { const container = state.containers.find(item => item.id === id); const history = container.history.slice(0, 4).map(item => `<div class="history-item"><b>${formatStrap(item.strap)}</b><span>${escapeHtml(item.at)} · ${escapeHtml(item.by)}</span></div>`).join('') || '<div class="muted">No previous strap readings.</div>'; return modal(`<h2>${escapeHtml(container.name)}</h2><p>${escapeHtml(container.chemical)} · ${container.area}</p><form id="strap-form" data-id="${id}"><label class="field">STRAP READING (INCHES)<input required name="strap" type="number" min="0" step="0.1" value="${container.strap ?? ''}" placeholder="56" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save strap</button></div></form><div class="history"><h3>Recent strap history</h3>${history}</div>`); }
function locationModal() { return modal(`<h2>Add location</h2><p>Create a new, separate FieldOps worksite.</p><form id="location-form"><label class="field">LOCATION NAME<input required name="name" placeholder="Example: Anthem" /></label><label class="field">LOCATION ID<input required name="siteId" pattern="[a-z0-9-]+" placeholder="Example: anthem" /><small>Lowercase letters, numbers, and hyphens only.</small></label><label class="field">SITE CODE<input required name="siteCode" autocomplete="off" placeholder="Set a private Site Code" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Create location</button></div></form>`); }
function rotateCodeModal(siteId) { return modal(`<h2>Rotate Site Code</h2><p>Set a new private code for ${escapeHtml(siteId)}. Anyone using the old code will no longer be able to enter.</p><form id="rotate-code-form" data-site-id="${escapeHtml(siteId)}"><label class="field">NEW SITE CODE<input required name="siteCode" autocomplete="off" /></label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save new code</button></div></form>`); }

function bind() {
  document.querySelector('#site-gate')?.addEventListener('submit', enterSite);
  document.querySelector('#admin-gate')?.addEventListener('submit', enterAdmin);
  document.querySelector('[data-admin-login]')?.addEventListener('click', () => { state.authMode = 'admin'; render(); });
  document.querySelector('[data-site-login]')?.addEventListener('click', () => { state.authMode = 'site'; render(); });
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.tab; save(); render(); }));
  document.querySelector('[data-sign-out]')?.addEventListener('click', async () => { if (liveMode) await signOut(auth); state.signedIn = false; state.siteId = ''; state.siteName = ''; state.userName = ''; state.isAdmin = false; state.authMode = 'site'; save(); render(); });
  document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => { state.area = button.dataset.area; save(); render(); }));
  document.querySelector('[data-open="container"]')?.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', containerModal()); bindModal(); });
  document.querySelector('[data-open="location"]')?.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', locationModal()); bindModal(); });
  document.querySelectorAll('[data-rotate-site]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', rotateCodeModal(button.dataset.rotateSite)); bindModal(); }));
  document.querySelectorAll('[data-toggle-site]').forEach(button => button.addEventListener('click', async () => { try { await updateSite({ siteId: button.dataset.toggleSite, active: button.dataset.siteActive !== 'true' }); await hydrateAdmin(); render(); toast('Location status updated.'); } catch (error) { toast(error.message || 'Unable to update location.'); } }));
  document.querySelectorAll('[data-update]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', strapModal(button.dataset.update)); bindModal(); }));
  document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => { app.insertAdjacentHTML('beforeend', editContainerModal(button.dataset.edit)); bindModal(); }));
  document.querySelector('[data-add-line]')?.addEventListener('click', () => { document.querySelector('#line-items').insertAdjacentHTML('beforeend', orderLine()); bindRequisitionLines(); });
  document.querySelector('#requisition-form')?.addEventListener('submit', submitRequisition);
  bindRequisitionLines();
}

function orderLine() { return `<div class="order-line"><input required name="item" placeholder="Item or material" aria-label="Item or material" /><input name="quantity" placeholder="Quantity" aria-label="Quantity" /><input name="details" placeholder="Size, spec, or notes" aria-label="Item details" /><button class="remove-line" type="button" aria-label="Remove item">×</button></div>`; }
function bindRequisitionLines() { document.querySelectorAll('.remove-line').forEach(button => { button.onclick = () => { const lines = document.querySelectorAll('.order-line'); if (lines.length > 1) button.closest('.order-line').remove(); }; }); }
async function submitRequisition(event) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const lines = [...form.querySelectorAll('.order-line')].map(line => ({ item:line.querySelector('[name="item"]').value.trim(), quantity:line.querySelector('[name="quantity"]').value.trim(), details:line.querySelector('[name="details"]').value.trim() })).filter(item => item.item); const record = { id:crypto.randomUUID(), notes:String(data.get('notes')).trim(), items:lines, requestedBy:state.userName, createdAt:new Date().toISOString() }; try { if (liveMode) { const { id, ...payload } = record; const created = await addDoc(collection(database, 'sites', state.siteId, 'requisitions'), payload); record.id = created.id; } state.requisitions = [record, ...(state.requisitions || [])]; save(); render(); toast('Requisition submitted.'); } catch (error) { toast(error.message || 'Unable to submit requisition.'); } }

function bindModal() {
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.querySelector('.modal-backdrop')?.remove()));
  document.querySelector('#container-form')?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name')).trim(); const container = { id: crypto.randomUUID(), name, type:String(data.get('type')), area:state.area, chemical:String(data.get('chemical')).trim(), strap:null, updatedAt:'Not entered', updatedAtIso:null, history:[] }; try { if (liveMode) { const { id, ...payload } = container; const created = await addDoc(collection(database, 'sites', state.siteId, 'containers'), payload); container.id = created.id; } state.containers.unshift(container); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`${name} added to ${state.area}.`); } catch (error) { toast(error.message || 'Unable to add container.'); } });
  document.querySelector('#edit-container-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const container = state.containers.find(item => item.id === form.dataset.id); const data = new FormData(form); const changes = { name:String(data.get('name')).trim(), type:String(data.get('type')), chemical:String(data.get('chemical')).trim(), area:String(data.get('area')) }; try { if (liveMode) await updateDoc(doc(database, 'sites', state.siteId, 'containers', container.id), changes); Object.assign(container, changes); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`${container.name} updated.`); } catch (error) { toast(error.message || 'Unable to update container.'); } });
  document.querySelector('#location-form')?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { if (!liveMode || !state.isAdmin) throw new Error('Administrator sign-in is required.'); const result = await createSite({ name: String(data.get('name')).trim(), siteId: String(data.get('siteId')).trim(), siteCode: String(data.get('siteCode')).trim() }); await hydrateAdmin(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`${result.data.site.name} is ready.`); } catch (error) { toast(error.message || 'Unable to create location.'); } });
  document.querySelector('#rotate-code-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; try { await updateSite({ siteId: form.dataset.siteId, siteCode: String(new FormData(form).get('siteCode')).trim() }); document.querySelector('.modal-backdrop')?.remove(); toast('Site Code updated.'); } catch (error) { toast(error.message || 'Unable to update Site Code.'); } });
  document.querySelector('#strap-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const container = state.containers.find(item => item.id === form.dataset.id); const strap = Number(new FormData(form).get('strap')); const at = new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(new Date()); const updatedAtIso = new Date().toISOString(); const historyItem = { strap, at, by:state.userName }; try { if (liveMode) await updateDoc(doc(database, 'sites', state.siteId, 'containers', container.id), { strap, updatedAt: at, updatedAtIso, history: [historyItem, ...container.history] }); container.strap = strap; container.updatedAt = at; container.updatedAtIso = updatedAtIso; container.history.unshift(historyItem); save(); document.querySelector('.modal-backdrop')?.remove(); render(); toast(`Strap saved for ${container.name}.`); } catch (error) { toast(error.message || 'Unable to save strap.'); } });
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
  const [containers, requisitions] = await Promise.all([
    getDocs(collection(database, 'sites', state.siteId, 'containers')),
    getDocs(collection(database, 'sites', state.siteId, 'requisitions')),
  ]);
  state.containers = containers.docs.map(record => ({ id: record.id, ...record.data(), history: record.data().history || [] }));
  state.requisitions = requisitions.docs.map(record => ({ id: record.id, ...record.data() })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function hydrateAdmin() {
  const sites = await getDocs(collection(database, 'sites'));
  state.sites = sites.docs.map(record => ({ id: record.id, ...record.data() }));
}

function toast(message) { const node = document.createElement('div'); node.className = 'toast'; node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 2800); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
