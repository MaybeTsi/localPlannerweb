/* v2 skin — loaded by index_v2.html only. Adds, on top of the unchanged app:
   - a top navigation,
   - the home head: headline, a live replay of example cases (data/v2/hero.js: showcase cases our method completed, labelled as such on the page) and one tile per method,
   - ranking rows drawn as lanes (bar on a track, share, count),
   - entrance motion.
   Every number shown is read from the data the page already has (window.SL_RR, the example cases' own score rows); nothing is computed beyond n / K. */
(function () {
'use strict';
const X = window.SLX, root = document.documentElement;
if (!X || !root.classList.contains('v2')) return;
const {$, esc, fmt} = X;
const z = () => root.lang === 'zh-CN';
const T = (zh, en) => z() ? zh : en;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ARMS = ['method_R13', 'literal_if_feasible', 'nearest', 'v16'];
const KN = {'01': '①', '02': '②', '03': '③', '04': '④', '05': '⑤', '06': '⑥', '07': '⑦', '09': '⑨', '14': '⑭', '15': '⑮', '16': '⑯'};
const css = n => getComputedStyle(root).getPropertyValue(n).trim();

/* ---------- top navigation ---------- */
function nav() {
  const top = $('#top'), brand = top && top.querySelector('.tb-brand'); if (!brand) return;
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  const cur = h.startsWith('case/') || h.startsWith('list') ? 'list' : h === 'overview' ? 'overview' : h === 'glossary' ? 'glossary' : h === 'rescore' || h.startsWith('analysis') ? '' : (X.dev ? 'list' : 'home');
  const old = top.querySelector('.v2nav'); if (old && old.dataset.cur === cur && old.dataset.l === root.lang) return; if (old) old.remove();
  const items = [['home', T('总览', 'Summary')], ['list', T('题目', 'Cases')], ['overview', T('详细数据', 'Detailed data')], ['glossary', T('名词解释', 'Glossary')]];
  brand.insertAdjacentHTML('afterend', `<nav class="v2nav" data-cur="${cur}" data-l="${root.lang}">${items.map(([k, l]) => `<a href="#${k}" class="${k === cur ? 'is-on' : ''}">${l}</a>`).join('')}</nav>`);
}

/* ---------- ranking rows as lanes ---------- */
function lanes() {
  document.querySelectorAll('.rkbars .row:not([data-v2]), .homecat .row:not([data-v2])').forEach(r => {
    r.dataset.v2 = 1;
    const sh = r.querySelector('.share'), val = r.querySelector('.val');
    if (sh) { const w = (parseFloat(sh.style.width) || 0) / 100; r.style.setProperty('--w', reduce ? w : 0); if (!reduce) requestAnimationFrame(() => requestAnimationFrame(() => r.style.setProperty('--w', w.toFixed(4)))); }
    if (val && !val.querySelector('.pc')) {
      const b = val.querySelector('b'), txt = val.textContent, m = /·\s*([\d.]+%)/.exec(txt), den = /\/\s*([\d,]+)/.exec(txt);
      val.innerHTML = m ? `<span class="fr"><b>${esc(b ? b.textContent : '')}</b>${den ? ' / ' + esc(den[1]) : ''}</span><span class="pc">${esc(m[1])}</span>`
        : `<span class="fr after">${den ? '/ ' + esc(den[1]) : ''}</span><span class="pc">${esc(b ? b.textContent : txt.trim())}</span>`;
    }
  });
}

/* ---------- example cases for the replay ---------- */
let HERO = null, heroWait = [];
window.SL_V2_HERO = o => { HERO = o; heroWait.forEach(f => f(o)); heroWait = []; };
const heroData = () => HERO ? Promise.resolve(HERO) : new Promise(res => { if (!heroWait.length) { const s = document.createElement('script'); s.src = 'data/v2/hero.js'; s.onerror = () => window.SL_V2_HERO({cases: []}); document.head.appendChild(s); } heroWait.push(res); });
const decoded = new Map();
function prep(c) {
  if (decoded.has(c.id)) return decoded.get(c.id);
  const tr = {}, end = {}; let Tm = 0;
  for (const a of ARMS) { const v = X.trajDecode(c.tr[a]); tr[a] = v; end[a] = v.length ? v[v.length - 1][0] : 0; Tm = Math.max(Tm, end[a]); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of c.w.r) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
  const o = {tr, end, T: Math.max(Tm, .5), b: [x0, y0, x1, y1]}; decoded.set(c.id, o); return o;
}
const poseAt = (tr, tm) => { if (!tr.length) return null; if (tm <= tr[0][0]) return tr[0]; for (let i = 1; i < tr.length; i++) if (tr[i][0] >= tm) { const a = tr[i - 1], b = tr[i], k = (tm - a[0]) / ((b[0] - a[0]) || 1); let dy = b[3] - a[3]; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; return [tm, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + dy * k]; } return tr[tr.length - 1]; };

function drawCase(cv, c, P, tm, col) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const [x0, y0, x1, y1] = P.b, pad = 26, s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad - 8) / (y1 - y0)), ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2 + 2;
  const Xs = x => ox + (x - x0) * s, Ys = y => oy + (y1 - y) * s, wt = 2.2 / s;
  // walls as the outline of the union of the free rectangles, then the floor with a 1 m grid
  g.fillStyle = col.wall; for (const r of c.w.r) g.fillRect(Xs(r[0] - wt), Ys(r[3] + wt), (r[2] - r[0] + 2 * wt) * s, (r[3] - r[1] + 2 * wt) * s);
  g.fillStyle = col.free; for (const r of c.w.r) g.fillRect(Xs(r[0]), Ys(r[3]), (r[2] - r[0]) * s, (r[3] - r[1]) * s);
  g.save(); g.beginPath(); for (const r of c.w.r) g.rect(Xs(r[0]), Ys(r[3]), (r[2] - r[0]) * s, (r[3] - r[1]) * s); g.clip();
  g.strokeStyle = col.grid; g.lineWidth = 1; g.beginPath();
  for (let x = Math.ceil(x0); x <= x1; x++) { const px = Math.round(Xs(x)) + .5; g.moveTo(px, 0); g.lineTo(px, H); }
  for (let y = Math.ceil(y0); y <= y1; y++) { const py = Math.round(Ys(y)) + .5; g.moveTo(0, py); g.lineTo(W, py); }
  g.stroke(); g.restore();
  g.fillStyle = '#8A8D93'; for (const r of c.w.o || []) { const q = Array.isArray(r) ? r : (r.rect || r.bounds); if (q) g.fillRect(Xs(q[0]), Ys(q[3]), (q[2] - q[0]) * s, (q[3] - q[1]) * s); }
  const st = c.w.s || [0, 0, 0];
  // where the words end up, for the kinds that speak a distance
  if (c.u.distance_m != null && ['01', '04', '06'].includes(c.k)) { const cs = Math.cos(st[2]), sn = Math.sin(st[2]), lx = st[0] + c.u.distance_m * cs, ly = st[1] + c.u.distance_m * sn, L = 2.3;
    g.strokeStyle = col.lit; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(Xs(lx + sn * L), Ys(ly - cs * L)); g.lineTo(Xs(lx - sn * L), Ys(ly + cs * L)); g.stroke(); g.setLineDash([]);
    const lb = `${X.t('literal')} ${c.u.distance_m} m`; g.font = '600 11px ' + col.sans; const lw = g.measureText(lb).width, bx = Xs(lx - sn * L) - lw / 2 - 7, by = Ys(ly + cs * L) - 22;
    g.fillStyle = col.free; g.globalAlpha = .92; g.beginPath(); g.roundRect ? g.roundRect(bx, by, lw + 14, 18, 9) : g.rect(bx, by, lw + 14, 18); g.fill(); g.globalAlpha = 1; g.strokeStyle = col.lit; g.lineWidth = 1; g.stroke();
    g.fillStyle = col.lit; g.fillText(lb, bx + 7, by + 13); }
  g.strokeStyle = col.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(Xs(st[0]), Ys(st[1]), 4.5, 0, 7); g.stroke();
  // routes: our method last so it stays on top
  for (const a of ['v16', 'nearest', 'literal_if_feasible', 'method_R13']) {
    const tr = P.tr[a]; if (!tr || !tr.length) continue; const me = a === 'method_R13', q = poseAt(tr, tm);
    g.save(); g.strokeStyle = col.arm[a]; g.lineWidth = me ? 3.6 : 2.4; g.lineJoin = g.lineCap = 'round'; g.globalAlpha = me ? 1 : .92;
    if (me) { g.shadowColor = col.arm[a]; g.shadowBlur = 10; }
    g.beginPath(); let first = true; for (const p of tr) { if (p[0] > tm) break; first ? g.moveTo(Xs(p[1]), Ys(p[2])) : g.lineTo(Xs(p[1]), Ys(p[2])); first = false; }
    if (!first) { g.lineTo(Xs(q[1]), Ys(q[2])); g.stroke(); } g.restore();
    // the vehicle
    const L = Math.max(13, .95 * s), Wd = Math.max(8, .56 * s); g.save(); g.translate(Xs(q[1]), Ys(q[2])); g.rotate(-q[3]);
    g.fillStyle = col.arm[a]; g.strokeStyle = col.free; g.lineWidth = 1.6; g.beginPath(); g.roundRect ? g.roundRect(-L * .35, -Wd / 2, L, Wd, 3) : g.rect(-L * .35, -Wd / 2, L, Wd); g.fill(); g.stroke();
    g.fillStyle = col.free; g.globalAlpha = .9; g.beginPath(); g.moveTo(L * .5, 0); g.lineTo(L * .22, -Wd * .26); g.lineTo(L * .22, Wd * .26); g.closePath(); g.fill(); g.restore();
  }
}

let heroIdx = 0;
function replay(box, H) {
  const cv = box.querySelector('canvas'), say = box.querySelector('.v2say'), sayB = say.querySelector('b'), kind = box.querySelector('.v2kind'), cnt = box.querySelector('.v2cnt'), out = box.querySelector('.v2out'), dots = box.querySelector('.v2dots'), open = box.querySelector('.v2r-f a'), hudT = box.querySelector('.v2hud.tr'), bar = box.querySelector('.v2bar');
  const cases = H.cases; if (!cases.length) { box.remove(); return; }
  const col = {wall: css('--map-wall'), free: css('--map-free'), grid: css('--map-grid'), lit: css('--map-lit'), ink: css('--ink3'), sans: css('--sans') || 'sans-serif', arm: X.ARMC};
  let c, P, text, t0 = performance.now(), pausedAt = 0, hover = false, vis = true, shown = {};
  dots.innerHTML = cases.map((q, i) => `<button data-i="${i}" aria-label="${i + 1}"></button>`).join('');
  const INTRO = .9, HOLD = 3.2, dur = () => Math.min(9, Math.max(4.2, P.T * .42));
  function set(i) {
    heroIdx = (i + cases.length) % cases.length; c = cases[heroIdx]; P = prep(c); text = X.s10Text(c); shown = {}; t0 = performance.now(); pausedAt = 0;
    kind.textContent = `${KN[c.k] || ''} ${(X.t('kname') || {})[c.k] || ''}`; cnt.textContent = `${heroIdx + 1} / ${cases.length}`; open.href = '#case/' + c.id;
    dots.querySelectorAll('button').forEach((b, k) => b.classList.toggle('is-on', k === heroIdx));
    out.innerHTML = ARMS.map(a => `<div class="v2o is-run" data-a="${a}" style="--c:${col.arm[a]}"><i></i><span class="v2n">${esc(X.armName(a))}</span><span class="v2st">${T('行驶中', 'driving')}</span></div>`).join('');
    if (reduce) frame(performance.now());
  }
  function outcome(a) {
    const q = c.a[a], o = X.s11.outcome(q, false), bd = X.s11.badge(q), el = out.querySelector(`[data-a="${a}"]`); if (!el) return;
    el.className = `v2o is-done o-${o[0]}`; el.querySelector('.v2st').innerHTML = `${esc(z() ? o[1] : o[2])}<em>${esc(bd.t)}</em>`;
  }
  function frame(now) {
    if (!cv.isConnected) return;
    const stop = (hover || !vis) && !reduce;
    if (stop) { if (!pausedAt) pausedAt = now; } else if (pausedAt) { t0 += now - pausedAt; pausedAt = 0; }
    box.classList.toggle('is-paused', stop);
    const e = reduce ? 1e3 : ((pausedAt || now) - t0) / 1000, D = dur();
    const k = Math.min(1, Math.max(0, (e - INTRO) / D)), tm = k * P.T;
    const n = Math.min(text.length, Math.ceil(text.length * Math.min(1, e / (INTRO * .8))));
    const speaking = n < text.length; if (sayB.dataset.n !== n + '|' + c.id) { sayB.dataset.n = n + '|' + c.id; sayB.innerHTML = esc(text.slice(0, n)) + (speaking ? '<span class="v2caret"></span>' : ''); say.classList.toggle('is-speaking', speaking); }
    drawCase(cv, c, P, tm, col);
    hudT.textContent = `t ${tm.toFixed(1)} s`; bar.style.width = (k * 100).toFixed(1) + '%';
    for (const a of ARMS) if (!shown[a] && e > INTRO && (tm >= P.end[a] - 1e-6 || k >= 1)) { shown[a] = 1; outcome(a); }
    if (!reduce) { if (e > INTRO + D + HOLD) set(heroIdx + 1); requestAnimationFrame(frame); }
  }
  box.onmouseenter = () => { hover = true; }; box.onmouseleave = () => { hover = false; };
  box.querySelector('.prev').onclick = () => set(heroIdx - 1); box.querySelector('.next').onclick = () => set(heroIdx + 1);
  dots.onclick = ev => { const b = ev.target.closest('button'); if (b) set(+b.dataset.i); };
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(box);
  document.addEventListener('visibilitychange', () => { if (cv.isConnected) vis = !document.hidden; });
  set(heroIdx); if (!reduce) requestAnimationFrame(frame);
}

/* ---------- home head ---------- */
const DESC = {
  method_R13: ['在“照指令字面走”和“进某个门”之间选一个；路被箱子挡住时会换道绕过去，绕不过去才停下报告。', 'Chooses between following the words and entering an opening; when a box blocks the way it changes lane around it, and stops to report only if it cannot get around.'],
  literal_if_feasible: ['指令字面能执行就照字面走，不能才转向某个门。', 'Follows the words if they can be carried out, otherwise turns to an opening.'],
  nearest: ['直接去离字面落点最近的门。', 'Goes to the opening closest to where the words end up.'],
  v16: ['项目原有的系统，只按字面执行。', 'The project’s original system, which only follows the words.']};
const rr = (scope, a) => { const R = window.SL_RR, v = R && R.rows[scope] && R.rows[scope][a]; return v && v.t[1] ? {n: v.t[0], K: v.t[1], p: v.t[0] / v.t[1]} : null; };
function tiles() {
  return `<section class="v2tiles">${ARMS.map((a, i) => { const m = rr('S11_MAIN_SYNTH', a), r = rr('S11_REAL', a);
    return `<article class="v2t v2in ${i ? '' : 'is-me'}" style="--c:${X.ARMC[a]};--i:${i + 4}"><div class="v2who"><i></i>${esc(X.armName(a))}${i ? '' : `<span class="v2tag">${T('我们的方法', 'OURS')}</span>`}</div><p>${T(DESC[a][0], DESC[a][1])}</p>
      ${m ? `<div class="v2num"><b data-to="${(m.p * 100).toFixed(1)}">${(m.p * 100).toFixed(1)}<small>%</small></b><span>${fmt(m.n)} / ${fmt(m.K)}</span></div><div class="v2meter" style="--w:${reduce ? m.p.toFixed(4) : 0}" data-w="${m.p.toFixed(4)}"><u></u></div><div class="v2lab">${T('合成主集 · 总做对率', 'Main synthetic set · overall right rate')}</div>` : ''}
      ${r ? `<div class="v2sub">${T('真实地图', 'Real maps')}<b>${(r.p * 100).toFixed(1)}%</b><span>${fmt(r.n)} / ${fmt(r.K)}</span></div>` : ''}</article>`; }).join('')}</section>
    <p class="v2tnote">${T('总做对率 =（可完成的题里完成了指令的 + 该停的题里正确停下的）÷ 结局已知的题。真实地图上所有方法都不高，详见下方各测试集。', 'Overall right rate = (completable cases completed + should-stop cases correctly stopped) ÷ cases with a known outcome. On the real maps every method is low; see the test sets below.')}</p>`;
}
function countUp(host) {
  host.querySelectorAll('.v2meter[data-w]').forEach(m => requestAnimationFrame(() => requestAnimationFrame(() => m.style.setProperty('--w', m.dataset.w))));
  if (reduce) return;
  host.querySelectorAll('.v2num b[data-to]').forEach(b => { const to = +b.dataset.to, t0 = performance.now(), D = 1100, sm = '<small>%</small>';
    const step = now => { if (!b.isConnected) return; const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 4); b.innerHTML = (to * e).toFixed(1) + sm; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
}
function home() {
  const box = $('#homebox'), page = $('#page'); if (!box || !page || page.querySelector('.v2hero')) return;
  const old = page.querySelector('.shead'), R = window.SL_RR, total = R && R.partition ? R.partition.total : null;
  const eyebrow = old && old.querySelector('.eyebrow') ? old.querySelector('.eyebrow').innerHTML : '';
  const html = `<section class="v2hero"><div class="v2h-l">
      <div class="eyebrow v2in" style="--i:0">${eyebrow}</div>
      <h1 class="v2in" style="--i:1">${T('小车<em>听指令</em>行驶<br>仿真测试结果', 'A small car <em>following instructions</em>:<br>simulation test results')}</h1>
      <p class="lede v2in" style="--i:2">${T('在走廊和真实建筑里，把本方法和三种对照方法放在同样的题上比较。指令能完成的题，要完成；指令指的门不存在或走廊堵死的题，要安全地停下并报告。下面是各方法做对了多少道题。', 'In corridors and real buildings, our method and three other methods are run on the same cases. Where the instruction can be carried out it has to be completed; where the opening named does not exist or the corridor is blocked, the method has to stop safely and report. Below: how many cases each method got right.')}</p>
      <div class="v2cta v2in" style="--i:3"><a class="btn ink" href="#list">${T('看全部题目', 'Browse the cases')} →</a><a class="btn" href="#overview">${T('详细数据', 'Detailed data')}</a><a class="btn ghost" href="#glossary">${T('名词解释', 'Glossary')}</a></div>
      <dl class="v2facts v2in" style="--i:4">${total ? `<div><dt>${fmt(total)}</dt><dd>${T('道测试题', 'test cases')}</dd></div>` : ''}<div><dt id="v2kinds">—</dt><dd>${T('类口头指令', 'instruction kinds')}</dd></div><div><dt>${ARMS.length}</dt><dd>${T('种方法', 'methods')}</dd></div></dl>
    </div>
    <div class="v2replay v2in" style="--i:2" id="v2replay">
      <div class="v2r-h"><span class="v2live"><i></i>${T('例题回放', 'Replay')}</span><span class="v2kind"></span><span class="v2sp"></span><span class="v2cnt"></span>
        <button class="prev" aria-label="${T('上一题', 'previous')}"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg></button>
        <button class="next" aria-label="${T('下一题', 'next')}"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5 8 6 4.5 9.5"/></svg></button></div>
      <div class="v2say"><span class="v2mic"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5.5" y="1.5" width="5" height="8" rx="2.5"/><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2"/></svg></span><b></b></div>
      <div class="v2map"><canvas></canvas><span class="v2hud tl">${T('合成主集', 'main synthetic set')}</span><span class="v2hud tr"></span><span class="v2bar"></span></div>
      <div class="v2out"></div>
      <div class="v2r-f"><span class="v2dots"></span><span class="v2rule">${T('例题选的是本方法完成的题（每类指令题号最小的一题），不代表整体成绩；整体成绩见下方。', 'Showcase: cases our method completed (the lowest-numbered one of each instruction kind), not a representative sample; overall results are below.')}</span><a href="#list">${T('打开这道题', 'Open this case')} →</a></div>
    </div></section>${tiles()}`;
  if (old) old.outerHTML = html; else box.insertAdjacentHTML('beforebegin', html);
  countUp(page);
  heroData().then(H => { const rp = $('#v2replay'), kn = $('#v2kinds'); if (kn) kn.textContent = H.cases.length || '—'; if (rp && !rp.dataset.on) { rp.dataset.on = 1; replay(rp, H); } });
}

/* ---------- entrance motion: once per route, not on every re-render inside a page ---------- */
let lastRoute = null;
function enter() {
  const r = location.hash + '|' + root.lang, page = $('#page'); if (!page || r === lastRoute) return; lastRoute = r;
  let i = 0; page.querySelectorAll(':scope > .shead > *, :scope .card, :scope .cc, :scope .gi').forEach(el => { if (i > 16 || el.closest('.v2hero')) return; if (!el.classList.contains('v2in')) { el.classList.add('v2in'); el.style.setProperty('--i', i++); } });
  page.classList.add('v2-enter'); setTimeout(() => page.classList.remove('v2-enter'), 1600);
}

let queued = false;
const run = () => { queued = false; nav(); home(); lanes(); enter(); };
const kick = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
new MutationObserver(rs => { if (rs.some(r => { const el = r.target.nodeType === 1 ? r.target : r.target.parentElement; return !(el && el.closest('.v2replay, .v2tiles')); })) kick(); }).observe(document.getElementById('app'), {childList: true, subtree: true});
window.addEventListener('hashchange', kick);
kick();
})();
