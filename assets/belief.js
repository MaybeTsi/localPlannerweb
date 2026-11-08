/* "How the method thinks": the method's probabilities over {follow the words, each opening, not seen yet} while it drives, in step with the replay,
   its expected scores at the decision, and the scorer's full POMDP next to it. Data: data/belief/<case>__<arm>.js (built by tools/build_belief.py from the
   per-cycle diagnostic logs; the designated exports CP-C-B / CP-B-RB are not delivered yet, the page says "to be exported" where data are missing). */
(function () {
'use strict';
const X = window.SLX;
if (!X) return;
const {$, esc} = X;
const z = () => document.documentElement.lang === 'zh-CN';
const T = (zh, en) => z() ? zh : en;
const UNRES = 'UNRESOLVED_BEYOND_OBSERVED_MAP', LIT = 'Z0_LITERAL';
const DOOR = ['#12A594', '#3E63DD', '#D6409F', '#E9A23B', '#46A758', '#AB4ABA', '#0090FF', '#CC4E00'];
const COL = {lit: '#6E56CF', un: '#8D8D86'};

let BIDX = null; window.SL_BELIEF_INDEX = o => { BIDX = o; };
const chunks = {}, waits = {};
window.SL_BELIEF = (k, o) => { chunks[k] = o; (waits[k] || []).forEach(f => f(o)); delete waits[k]; };
const loadScript = src => new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
const armOf = e => e.s11 ? 'method_R13' : 'method_v6';
const keyOf = e => e.id.replace(/:/g, '_') + '__' + armOf(e);
function get(e) {
  const run = () => BIDX && (BIDX[e.id] || []).includes(armOf(e)) ? (chunks[keyOf(e)] ? Promise.resolve(chunks[keyOf(e)]) : new Promise(res => { if (!waits[keyOf(e)]) { waits[keyOf(e)] = []; loadScript(`data/belief/${keyOf(e)}.js`).then(ok => { if (!ok) res(null); }); } waits[keyOf(e)].push(res); })) : Promise.resolve(null);
  return BIDX ? run() : loadScript('data/belief/index.js').then(run);
}

/* ---------- names and colours ---------- */
function names(b) {
  const out = {}; let d = 0;
  for (const h of b.h) { if (h === LIT) out[h] = [T('照字面', 'Follow the words'), COL.lit]; else if (h === UNRES) out[h] = [T('还没看到', 'Not seen yet'), COL.un]; else { out[h] = [T('门 ', 'Opening ') + String.fromCharCode(65 + d), DOOR[d % DOOR.length]]; d++; } }
  return out;
}
const pct = v => (100 * v).toFixed(0) + '%';
const EXN = ['不能', '能', ''];

/* ---------- explanation of the decision ---------- */
function why(b, nm) {
  const d = b.d; if (!d) return T('这一题里本方法一直没有做出决定。', 'The method never made a decision in this case.');
  const lit = d.sc[LIT], litAvail = d.av[LIT] != null, openings = Object.keys(d.av).filter(k => k !== LIT);
  const best = openings.slice().sort((p, q) => d.av[q] - d.av[p])[0];
  const f = v => v.toFixed(2);
  if (d.a === 'COMMIT') {
    const n = (nm[d.id] || [d.id])[0];
    return litAvail ? T(`照字面的期望得分是 ${f(lit)}，${n} 的是 ${f(d.av[d.id])}，${n} 更高，所以进 ${n}。`, `Following the words scores ${f(lit)} and ${n} scores ${f(d.av[d.id])}, which is higher, so it enters ${n}.`)
      : T(`照字面在这里执行不了；能执行的门里，${n} 的期望得分最高（${f(d.av[d.id])}），所以进 ${n}。`, `Following the words cannot be carried out here; among the openings that can be, ${n} has the highest expected score (${f(d.av[d.id])}), so it enters ${n}.`);
  }
  if (d.a === 'KEEP_LITERAL') return best != null ? T(`照字面的期望得分是 ${f(d.av[LIT] != null ? d.av[LIT] : lit)}，不低于任何一扇能执行的门（最高 ${f(d.av[best])}），所以照字面走。`, `Following the words scores ${f(d.av[LIT] != null ? d.av[LIT] : lit)}, not lower than any opening that can be used (best ${f(d.av[best])}), so it follows the words.`)
    : T(`没有能执行的门，照字面的期望得分是 ${f(lit)}，所以照字面走。`, `No opening can be used and following the words scores ${f(lit)}, so it follows the words.`);
  return T('能执行的做法都不如停下报告，所以停下报告。', 'None of the actions that can be carried out beats stopping to report, so it stops and reports.');
}

/* ---------- chart ---------- */
function chartSVG(b, nm) {
  const W = 360, H = 168, L = 30, R = 74, Tm = 10, Bm = 34, pw = W - L - R, ph = H - Tm - Bm;
  const maxP = Math.max(1, ...b.c.map(r => r[1]), b.d ? b.d.p : 0) * 1.02;
  const x = p => L + p / maxP * pw, y = v => Tm + (1 - v) * ph;
  const lines = b.h.map((h, i) => ({h, pts: b.c.map(r => [x(r[1]), y(r[2][i])]), end: b.c.length ? b.c[b.c.length - 1][2][i] : 0})).filter(l => l.pts.length);
  // end labels, pushed apart
  const labs = lines.map(l => ({h: l.h, y: l.pts[l.pts.length - 1][1]})).sort((p, q) => p.y - q.y);
  for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
  const ly = Object.fromEntries(labs.map(l => [l.h, l.y]));
  const grid = [0, .5, 1].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="var(--ink3)">${pct(v)}</text>`).join('');
  const ticks = []; for (let p = 0; p <= maxP; p += 2) ticks.push(p);
  const xt = ticks.map(p => `<text x="${x(p)}" y="${Tm + ph + 12}" text-anchor="middle" font-size="9" fill="var(--ink3)">${p}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="bchart" role="img" aria-label="${esc(T('概率随前进距离的变化', 'Probabilities against distance driven'))}">${grid}${xt}<text x="${L + pw / 2}" y="${H - 3}" text-anchor="middle" font-size="9" fill="var(--ink3)">${T('前进距离（m）', 'distance driven (m)')}</text>
    ${b.d ? `<line x1="${x(b.d.p)}" x2="${x(b.d.p)}" y1="${Tm}" y2="${Tm + ph}" stroke="var(--ink2)" stroke-dasharray="3 3"/><text x="${x(b.d.p) + 3}" y="${Tm + 8}" font-size="9" fill="var(--ink2)">${T('做决定', 'decision')} ${b.d.p.toFixed(1)} m</text>` : ''}
    ${lines.map(l => `<polyline fill="none" stroke="${nm[l.h][1]}" stroke-width="${l.h === LIT ? 2.4 : 2}" stroke-linejoin="round" points="${l.pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/><text x="${W - R + 5}" y="${(ly[l.h] + 3).toFixed(1)}" font-size="10.5" font-weight="600" fill="${nm[l.h][1]}">${esc(nm[l.h][0])}</text>`).join('')}
    <line id="bnow" x1="${x(0)}" x2="${x(0)}" y1="${Tm}" y2="${Tm + ph}" stroke="var(--accent)" stroke-width="1.5"/></svg>`;
}

/* ---------- reference (scorer's full POMDP) ---------- */
function refHTML(rec) {
  const head = `<h4>${T('评分器里的完整 POMDP', 'The scorer’s full POMDP')}</h4><p class="note" style="margin:0 0 6px">${T('它知道整张地图和出题时各种意思的比例，但不知道这一题的答案。', 'It knows the whole map and how often each kind of meaning occurs in the test set, but not the answer to this case.')}</p>`;
  if (rec === undefined) return head + `<p class="note">${T('打开“显示真实意思”，这里会显示参考在决定时的期望得分。', 'Switch on “Show the intended meaning” to see the reference’s expected scores at its decision here.')}</p>`;
  const r = rec && rec.r;
  if (!r || r.d === 'UNKNOWN') return head + `<p class="note">${T('这一题的参考未定（参考模型不处理箱子，或这类题的出题比例没登记）。', 'The reference is undecided for this case (it does not handle boxes, or the generation likelihood of this kind of case is not registered).')}</p><p class="note"><span class="nexp">${T('概率：待导出（评分方的参考概率）', 'probabilities: to be exported')}</span></p>`;
  const sc = r.sc || {}, rows = [];
  if (sc.literal != null && sc.literal !== 'UNKNOWN') rows.push([T('照字面', 'Follow the words'), sc.literal, r.d === 'LITERAL', COL.lit]);
  let k = 0; if (sc.structures && sc.structures !== 'UNKNOWN') for (const id in sc.structures) rows.push([T('候选门 ', 'Candidate ') + (++k), sc.structures[id], r.d === id, DOOR[(k - 1) % DOOR.length]]);
  if (sc.report != null && sc.report !== 'UNKNOWN') rows.push([T('停下报告', 'Stop and report'), sc.report, r.d === 'REPORT', COL.un]);
  const lo = Math.min(-1, ...rows.map(x => x[1])), hi = Math.max(1, ...rows.map(x => x[1]));
  return head + `<div class="bb-list">${rows.map(([l, v, best, c]) => `<div class="bb ${best ? 'best' : ''}" style="--c:${c}"><span class="sw"></span><span class="nm">${esc(l)}</span><span class="bar"><i style="width:${Math.max(2, (v - lo) / (hi - lo) * 100)}%"></i></span><b>${v.toFixed(2)}</b></div>`).join('')}</div>
    <p class="note">${T('参考选的是：', 'The reference chooses: ')}<b>${esc(r.d === 'LITERAL' ? T('照字面', 'follow the words') : r.d === 'REPORT' ? T('停下报告', 'stop and report') : T('进候选门 ', 'enter candidate ') + (Object.keys(sc.structures || {}).indexOf(r.d) + 1))}</b>${T('（期望得分最高）。', ' (the highest expected score).')}</p>
    <p class="note">${T('这里的候选门编号和左边的门 A、B 不是一一对应的，等评分方导出参考概率后再对齐。', 'The candidate numbers here do not map one-to-one onto openings A, B on the left; they will be aligned once the scoring team exports the reference probabilities.')}</p><p class="note"><span class="nexp">${T('概率：待导出（评分方的参考概率）', 'probabilities: to be exported')}</span></p>`;
}

/* ---------- mount ---------- */
function mount(e, hooks) {
  const stage = document.querySelector('.stagecard'); if (!stage || $('#beliefcard')) return;
  const tip = T('概率怎么来的：本方法先验只看指令说法——纯距离指令“照字面”0.3，带“第 N 个 / 这个”的指令 0.05；每走一步，根据口述距离离哪扇门近、激光看到了什么来更新；到最后做决定时，比较“能执行的程度 × 期望得分”。这些不是固定数值：出题时各种意思的比例只有评分器知道。', 'Where the probabilities come from: the method’s prior only looks at how the instruction is worded — a pure distance instruction gets 0.3 for “follow the words”, one with “the N-th / this” gets 0.05; at every step the probabilities are updated by which opening is closest to the spoken distance and by what the laser sees; at the moment of decision it compares “how executable × expected score”. They are not fixed numbers: how often each kind of meaning occurs in the test set is known only to the scorer.');
  stage.insertAdjacentHTML('afterend', `<section class="card beliefcard" id="beliefcard"><div class="card-h"><span class="tile">≈</span><h3 title="${esc(tip)}">${T('方法怎么想', 'How the method thinks')} <span class="tipu">?</span></h3><span class="more" id="bmeta"></span></div><div id="bbody"><p class="note" style="padding:6px 16px 14px">…</p></div></section>`);
  get(e).then(b => {
    const body = $('#bbody'); if (!body) return;
    if (!b) { body.innerHTML = `<p class="note" style="padding:6px 16px 14px"><span class="nexp">${T('待导出', 'to be exported')}</span> ${T('这一题的在线概率还没有导出（本方法的在线概率由运行方导出，参考概率由评分方导出）。', 'The online probabilities of this case are not exported yet (the run team exports the method’s online probabilities, the scoring team the reference probabilities).')}</p>`; return; }
    const nm = names(b);
    $('#bmeta').textContent = e.s11 ? T('本方法', 'our method') : T('上一版 v6.11', 'previous version v6.11');
    body.innerHTML = `<div class="bgrid"><div class="bcol"><h4>${e.s11 ? T('本方法（边走边算）', 'Our method (updated while driving)') : T('这个方法（边走边算）', 'This method (updated while driving)')}</h4><div class="bb-list" id="bbars"></div>${chartSVG(b, nm)}<div id="bscores"></div><p class="note" id="bwhy"></p></div>
      <div class="bcol" id="bref">${refHTML(undefined)}</div></div>
      <p class="note" style="padding:0 16px 12px">${T('小方块：能 = 这个做法在这里可以执行；不能 = 执行不了，条变灰。', 'Marker: can = this action can be carried out here; cannot = it cannot, and the bar turns grey.')}</p>`;
    // overlay: doors on the map, same colours
    const ops = b.h.filter(h => h !== LIT && h !== UNRES);
    e.m._overs = e.m._overs || {};
    e.m._overs.belief = (g, F) => { g.save(); ops.forEach((id, i) => { const q = b.geo[id]; if (!q) return; const [gx, gy, side, w] = q, c = nm[id][1], dep = 1.6 * (side || -1);
      g.fillStyle = c + '38'; g.strokeStyle = c; g.lineWidth = 2; const x0 = F.X(gx - w / 2), x1 = F.X(gx + w / 2), y0 = F.Y(gy), y1 = F.Y(gy + dep); g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); g.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      g.fillStyle = c; g.font = '700 12px ui-monospace,Menlo,monospace'; g.fillText(nm[id][0].replace(/^.* /, ''), (x0 + x1) / 2 - 4, (y0 + y1) / 2 + 4); }); g.restore(); };
    hooks.paint();
    // the decision
    const d = b.d, sc = $('#bscores');
    if (d) { const rows = b.h.filter(h => h !== UNRES).map(h => { const has = d.sc[h] != null, av = d.av[h] != null; return {h, v: d.sc[h], av, has, best: h === d.id}; });
      sc.innerHTML = `<h4 style="margin-top:12px">${T('决定时各做法的期望得分', 'Expected score of each action at the decision')} <span class="u">${T('（前进 ', '(at ')}${d.p.toFixed(1)} m${T('）', ')')}</span></h4><div class="bb-list">${rows.map(r => `<div class="bb ${r.best ? 'best' : ''} ${r.av ? '' : 'off'}" style="--c:${nm[r.h][1]}"><span class="sw"></span><span class="nm">${esc(nm[r.h][0])}</span><span class="v">${r.has ? r.v.toFixed(2) : '—'}</span><span class="ex">${r.av ? (r.best ? '✓ ' + T('选中', 'chosen') : '') : T('不能执行', 'cannot be done')}</span></div>`).join('')}</div>`; }
    $('#bwhy').textContent = why(b, nm);
    const bars = $('#bbars');
    bars.innerHTML = b.h.map((h, i) => `<div class="bb" data-i="${i}" style="--c:${nm[h][1]}"><span class="sw"></span><span class="nm">${esc(nm[h][0])}</span><span class="bar"><i></i></span><b></b><span class="ex"></span></div>`).join('');
    const rowsEl = [...bars.children];
    e._bu = t => { let k = 0; for (let i = 0; i < b.c.length; i++) if (b.c[i][0] <= t + 1e-6) k = i; const row = b.c[k], x = $('#bnow');
      rowsEl.forEach((el, i) => { const p = row[2][i], f = row[3][i]; el.querySelector('i').style.width = (p * 100).toFixed(1) + '%'; el.querySelector('b').textContent = pct(p); const ex = el.querySelector('.ex'); ex.textContent = b.h[i] === UNRES ? '' : EXN[f] === undefined ? '' : (f === 2 ? '' : T(EXN[f], f ? 'can' : 'cannot')); el.classList.toggle('off', f === 0); });
      if (x) { const maxP = Math.max(1, ...b.c.map(r => r[1]), b.d ? b.d.p : 0) * 1.02; const xx = 30 + row[1] / maxP * (360 - 30 - 74); x.setAttribute('x1', xx); x.setAttribute('x2', xx); }
      const wy = $('#bwhy'); if (wy) wy.style.opacity = d && t < d.t ? .45 : 1; };
    e._bu(hooks.getT());
  });
}
function onAnswer(e, rec) { const r = $('#bref'); if (r) r.innerHTML = refHTML(rec === null ? undefined : rec); }
window.SLX.belief = {mount, onAnswer};
})();
