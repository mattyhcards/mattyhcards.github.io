/* Matty H Cards · The Collection */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const COLORS = ['o', 'g', 'r', 'k'];

let CARDS = [], VIEW = [], ICONS = {}, TEAMLOGOS = {};
const state = { q: '', tag: '', sport: '', team: '', year: '', set: '', graded: '', sort: 'year-desc' };

/* ---------- boot ---------- */
Promise.all([
  fetch('data/cards.json').then(r => r.json()),
  ...['ssp', 'rc', 'top100'].map(n => fetch(`assets/icons/${n}.svg`).then(r => r.text()).then(t => ICONS[n] = t)),
  fetch('data/team-logos.json').then(r => r.ok ? r.json() : {}).then(j => TEAMLOGOS = j).catch(() => {})
]).then(([data]) => {
  CARDS = data.cards.map((c, i) => ({ ...c, _i: i, _search: [c.player, c.team, c.year, c.set, c.variation, c.cardNo, c.id, ...(c.tags || [])].join(' ').toLowerCase() }));
  const deep = new URLSearchParams(location.hash.slice(1)).get('card');
  readHash(); buildControls(); render(); openFromHash(deep);
}).catch(e => { $('#grid').innerHTML = `<p class="empty">Couldn't load the collection. ${esc(e.message)}</p>`; });

/* ---------- url state ---------- */
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const k of Object.keys(state)) if (p.has(k)) state[k] = p.get(k);
}
function writeHash(card) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v && !(k === 'sort' && v === 'year-desc')) p.set(k, v);
  if (card) p.set('card', card);
  const h = p.toString();
  history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
}
function openFromHash(id) {
  if (!id) return;
  let i = VIEW.findIndex(c => c.id === id);
  if (i < 0 && CARDS.some(c => c.id === id)) {  // card hidden by a filter in the link: clear filters so it can open
    Object.assign(state, { q: '', tag: '', sport: '', team: '', year: '', set: '', graded: '' }); buildControls(); render();
    i = VIEW.findIndex(c => c.id === id);
  }
  if (i >= 0) openLB(i, 0);
}

/* ---------- controls ---------- */
function allTags() {
  const m = new Map();
  CARDS.forEach(c => (c.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function buildControls() {
  const chips = $('#chips');
  const mk = (label, val, n) => `<button class="chip" role="tab" data-tag="${esc(val)}" aria-selected="${state.tag === val}">${esc(label)}<span>${n}</span></button>`;
  chips.innerHTML = mk('All', '', CARDS.length) + (CARDS.some(c => c.top100) ? mk('MHC Top 100', '__top100', CARDS.filter(c => c.top100).length) : '') +
    allTags().map(([t, n]) => mk(t, slug(t), n)).join('');
  chips.onclick = e => { const b = e.target.closest('.chip'); if (!b) return; state.tag = b.dataset.tag; syncChips(); render(); };

  const fill = (id, label, vals) => {
    const el = $(id), key = id.slice(3);
    el.innerHTML = `<option value="">${label}</option>` + vals.map(v => `<option>${esc(v)}</option>`).join('');
    el.value = state[key] || '';
    el.hidden = vals.length < 2;
    el.onchange = () => { state[key] = el.value; render(); };
  };
  const uniq = k => [...new Set(CARDS.map(c => c[k]).filter(Boolean))];
  fill('#f-sport', 'All sports', uniq('sport').sort());
  fill('#f-team', 'All teams', uniq('team').sort());
  fill('#f-year', 'All years', uniq('year').sort((a, b) => b - a));
  fill('#f-set', 'All sets', uniq('set').sort());
  $('#f-graded').value = state.graded; $('#f-graded').onchange = e => { state.graded = e.target.value; render(); };
  $('#f-sort').value = state.sort; $('#f-sort').onchange = e => { state.sort = e.target.value; render(); };
  const q = $('#q'); q.value = state.q;
  let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { state.q = q.value.trim(); render(); }, 120); };
  const reset = () => { Object.assign(state, { q: '', tag: '', sport: '', team: '', year: '', set: '', graded: '', sort: state.sort }); buildControls(); render(); };
  $('#reset').onclick = reset; $('#empty-reset').onclick = reset;
}
function syncChips() { document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tag === state.tag))); }

/* ---------- filter + render grid ---------- */
function apply() {
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  let v = CARDS.filter(c =>
    words.every(w => c._search.includes(w)) &&
    (!state.tag || (state.tag === '__top100' ? c.top100 : (c.tags || []).some(t => slug(t) === state.tag))) &&
    (!state.sport || c.sport === state.sport) && (!state.team || c.team === state.team) &&
    (!state.year || c.year === state.year) && (!state.set || c.set === state.set) &&
    (!state.graded || (state.graded === 'graded') === !!c.grade));
  const by = {
    'year-desc': (a, b) => (b.year || 0) - (a.year || 0) || a.player.localeCompare(b.player),
    'year-asc': (a, b) => (a.year || 0) - (b.year || 0) || a.player.localeCompare(b.player),
    'player': (a, b) => a.player.localeCompare(b.player) || (b.year || 0) - (a.year || 0),
    'top': (a, b) => (a.top100 || 999) - (b.top100 || 999) || (b.year || 0) - (a.year || 0)
  }[state.sort] || (() => 0);
  return v.sort(by);
}
function render() {
  VIEW = apply();
  syncChips();
  const active = state.q || state.tag || state.sport || state.team || state.year || state.set || state.graded;
  $('#reset').hidden = !active;
  $('#count').textContent = `${VIEW.length} of ${CARDS.length} cards`;
  $('#empty').hidden = VIEW.length > 0;
  $('#grid').innerHTML = VIEW.map((c, i) => `
    <button class="tile" data-i="${i}" aria-label="${esc(c.player)}, ${esc(c.year)} ${esc(c.set)} ${esc(c.variation)}">
      <div class="ph">${photoHTML(c, true)}<div class="ticons">${iconList(c).map(k => iconHTML(k, c, 30)).join('')}</div></div>
      <div class="meta"><b>${esc(c.player)}</b><span>${esc(c.year)} ${esc(c.set)}</span><span>${esc(c.variation)}${c.grade ? ` · ${esc(c.grade.grader)} ${esc(c.grade.value)}` : ''}</span></div>
    </button>`).join('');
  writeHash();
}
$('#grid').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) openLB(+t.dataset.i, 0); });

function photoHTML(c, thumb) {
  const src = c.photos && (thumb ? (c.photos.frontThumb || c.photos.front) : c.photos.front);
  if (src) return `<img class="photo" src="${esc(src)}" alt="${esc(c.player)} ${esc(c.year)} ${esc(c.set)}" loading="lazy" decoding="async">`;
  return `<div class="ph-empty"><div class="slab"></div><small>Photo coming soon</small></div>`;
}

/* ---------- icons ---------- */
function iconList(c) { const l = []; if (c.top100) l.push('top100'); if (c.rc) l.push('rc'); if (c.ssp) l.push('ssp'); return l; }
const ICON_NAMES = { top100: 'MHC Top 100', rc: 'Rookie Card', ssp: 'Super Short Print' };
function iconHTML(k, c, size) {
  const rank = k === 'top100' ? `<span class="rank">#${c.top100}</span>` : '';
  const title = k === 'top100' ? `MHC Top 100 · #${c.top100}` : ICON_NAMES[k];
  return `<span class="ic" style="width:${size}px;height:${size}px;--s:${size}px" title="${title}" role="img" aria-label="${title}">${ICONS[k] || ''}${rank}</span>`;
}

/* ---------- info frame ---------- */
function frameColor(c) { return COLORS[(parseInt(c.id.replace(/\D/g, ''), 10) || c._i) % COLORS.length]; }
function infoFrame(c) {
  const name = c.player.length > 22 ? 'xlong' : c.player.length > 16 ? 'long' : '';
  const icons = iconList(c);
  const logo = c.team && TEAMLOGOS[c.team] ? `<img class="tlogo" src="${esc(TEAMLOGOS[c.team])}" alt="">` : '';
  let hero = '';
  const numbered = c.printRun && c.printRun <= 150;
  if (!c.grade && !c.printRun && icons.length) {
    hero = `<div class="icons big">${icons.map(k => iconHTML(k, c, 66)).join('')}</div><div class="cap">${icons.map(k => ICON_NAMES[k]).join(' · ')}</div>`;
  } else {
    if (icons.length) hero += `<div class="icons">${icons.map(k => iconHTML(k, c, 58)).join('')}</div>`;
    if (c.printRun) {
      hero += c.serial ? `<div class="serial"><b>${c.serial}</b><i>/${c.printRun}</i></div>` : `<div class="serial"><i>/</i><b>${c.printRun}</b></div>`;
      if (numbered) {
        const cols = c.printRun <= 50 ? 10 : 15;
        hero += `<div class="dots" style="grid-template-columns:repeat(${cols},7px)">${Array.from({ length: c.printRun }, (_, i) => `<i${i + 1 === c.serial ? ' class="me"' : ''}></i>`).join('')}</div>`;
      }
    }
    if (c.grade) {
      const psa = c.grade.grader === 'PSA';
      hero += `<div class="grade${psa ? ' psa' : ''}"><div class="g">${esc(c.grade.value)}</div><div class="t"><b>${esc(c.grade.grader)} ${esc(c.grade.label || c.grade.value)}</b><span>${c.cert ? 'CERT ' + esc(c.cert) : 'GRADED BY ' + esc(c.grade.grader)}</span></div></div>`;
    }
  }
  return `<div class="frame-fit"><div class="frame ${frameColor(c)}">
    <div class="ftop"><div class="tags">${(c.tags || []).map(t => `<button class="tag" data-tag="${esc(slug(t))}">${esc(t)}</button>`).join('')}</div><div class="no">NO. ${esc(c.id)}</div></div>
    <div class="fbody">${logo}<div class="name ${name}">${esc(c.player)}</div>${c.team ? `<div class="team">${esc(c.team)}</div>` : ''}<div class="rule"></div>
      <div class="yr">${esc(c.year)}</div><div class="set">${esc(c.set)}</div>${c.variation ? `<div class="var">${esc(c.variation)}</div>` : ''}
      ${c.cardNo ? `<div class="num">#${esc(c.cardNo)}</div>` : '<div class="num"></div>'}
      ${c.acquired ? `<div class="acq"><span>Acquired ${fmtDate(c.acquired)}</span><b>${held(c.acquired)}</b></div>` : ''}
      <div class="hero">${hero}</div></div>
    <div class="ffoot"><img src="assets/brand/mhc-logo.png" alt=""><span>MATTY H CARDS</span></div>
  </div></div>`;
}
function fmtDate(iso) { const [y, m, d] = iso.split('-'); return `${m}-${d}-${y}`; }
function held(iso) {
  const [y, m, d] = iso.split('-').map(Number), a = new Date(y, m - 1, d), now = new Date();
  const days = Math.floor((now - a) / 864e5);
  if (days < 0) return 'Just added';
  if (days < 31) return days <= 1 ? 'New this week' : (days < 7 ? 'New this week' : `${Math.floor(days / 7)} wk in the collection`);
  let mo = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1)); if (now.getDate() < d) mo--;
  const yr = Math.floor(mo / 12); mo %= 12;
  return (yr ? `${yr} yr${mo ? ' ' + mo + ' mo' : ''}` : `${mo} mo`) + ' in the collection';
}
function fitFrame() {
  const fit = document.querySelector('.lb-slide .frame-fit'); if (!fit) return;
  const s = fit.clientWidth / 540; fit.querySelector('.frame').style.transform = `scale(${s})`;
}
window.addEventListener('resize', fitFrame);

/* ---------- lightbox ---------- */
const lb = { i: 0, s: 0 };
function slidesFor(c) {
  const s = [];
  s.push({ k: 'front', label: 'Front' });
  if (c.photos && c.photos.back) s.push({ k: 'back', label: 'Back' });
  s.push({ k: 'info', label: 'Info' });
  return s;
}
function openLB(i, s, dir) {
  lb.i = (i + VIEW.length) % VIEW.length; const c = VIEW[lb.i]; const sl = slidesFor(c);
  lb.s = s < 0 ? sl.length - 1 : Math.min(s, sl.length - 1);
  const cur = sl[lb.s], el = $('#lb-slide');
  el.style.setProperty('--dir', dir === -1 ? '-14px' : '14px');
  if (cur.k === 'info') el.innerHTML = `<div class="anim" style="position:absolute;inset:0">${infoFrame(c)}</div>`;
  else if (cur.k === 'back') el.innerHTML = `<img class="anim" src="${esc(c.photos.back)}" alt="Back of ${esc(c.player)} card">`;
  else el.innerHTML = `<div class="anim" style="position:absolute;inset:0">${photoHTML(c, false)}</div>`;
  $('#lb-dots').innerHTML = sl.map((x, j) => `<button data-s="${j}" aria-current="${j === lb.s}">${x.label}</button>`).join('');
  $('#lb-title').textContent = `${c.player} · ${c.year} ${c.set}${c.variation ? ' · ' + c.variation : ''}`;
  $('#lb-pos').textContent = `${lb.i + 1} / ${VIEW.length}`;
  $('#lb').hidden = false; document.body.style.overflow = 'hidden';
  fitFrame(); writeHash(c.id);
  // preload neighbor photo
  const n = VIEW[(lb.i + 1) % VIEW.length]; if (n && n.photos && n.photos.front) new Image().src = n.photos.front;
}
function step(d) {
  const sl = slidesFor(VIEW[lb.i]);
  const ns = lb.s + d;
  if (ns >= sl.length) openLB(lb.i + 1, 0, 1);
  else if (ns < 0) openLB(lb.i - 1, -1, -1);
  else openLB(lb.i, ns, d);
}
function closeLB() { $('#lb').hidden = true; document.body.style.overflow = ''; writeHash(); }
$('#lb-next').onclick = () => step(1); $('#lb-prev').onclick = () => step(-1);
$('#lb-ncard').onclick = () => openLB(lb.i + 1, 0, 1); $('#lb-pcard').onclick = () => openLB(lb.i - 1, 0, -1);
$('#lb').addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return closeLB();
  const d = e.target.closest('.lb-dots button'); if (d) return openLB(lb.i, +d.dataset.s, +d.dataset.s > lb.s ? 1 : -1);
  const t = e.target.closest('.frame .tag'); if (t) { state.tag = t.dataset.tag; closeLB(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});
document.addEventListener('keydown', e => {
  if ($('#lb').hidden) return;
  if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Escape') closeLB();
});
let tx = null;
$('#lb-slide').addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
$('#lb-slide').addEventListener('touchend', e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); tx = null; });
})();
