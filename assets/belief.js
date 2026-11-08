/* "How the method thinks": the method's probabilities over {follow the words, each opening, an opening not seen yet} while it drives, in step with the replay,
   next to the scorer's full POMDP at its decision. Data: data/belief/ (built by tools/build_belief.py from the online-belief export of C (CP-C-B) and the
   reference-belief export of B (CP-B-RB)). Probabilities are shown as exported. */
(function () {
'use strict';
const X = window.SLX;
if (!X) return;
const {$, esc} = X;
const z = () => document.documentElement.lang === 'zh-CN';
const T = (zh, en) => z() ? zh : en;
const DOOR = ['#12A594', '#3E63DD', '#D6409F', '#E9A23B', '#46A758', '#AB4ABA', '#0090FF', '#CC4E00'];
const LITC = '#6E56CF', UNC = '#B9B7B0';

/* ---------- loading ---------- */
let IDX = null; window.SL_BELIEF_INDEX = o => { IDX = o; };
const chunks = {}, waits = {};
const onChunk = (k, o) => { chunks[k] = o; (waits[k] || []).forEach(f => f(o)); delete waits[k]; };
window.SL_BELIEF = onChunk; window.SL_BELIEF_REF = onChunk;
const T32 = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t.push(c >>> 0); } return t; })();
const crc32 = str => { const b = new TextEncoder().encode(str); let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T32[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const script = (src, onerr) => new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = () => res(true); s.onerror = () => { onerr && onerr(); res(false); }; document.head.appendChild(s); });
const index = () => IDX ? Promise.resolve() : script('data/belief/index.js');
function chunk(name, path) {
  if (chunks[name]) return Promise.resolve(chunks[name]);
  return new Promise(res => { if (!waits[name]) { waits[name] = []; script(path, () => onChunk(name, {})); } waits[name].push(res); });
}
const dsOf = id => id.split(':')[0];
const isObstacle = id => /:O[134]:(BLOCK|CLEAR)$/.test(id);
const getOnline = (id, arm) => index().then(() => { const ds = dsOf(id), n = IDX && IDX.chunks[`${ds}__${arm}`]; if (!n || isObstacle(id)) return null; const nm = `${ds}__${arm}__${crc32(id) % n}`; return chunk(nm, `data/belief/${nm}.js`).then(o => o[id] || null); });
const getRef = id => index().then(() => { const ds = dsOf(id), n = IDX && IDX.ref_chunks[ds]; if (!n || isObstacle(id)) return null; const nm = `${ds}__${crc32(id) % n}`; return chunk(nm, `data/belief/ref/${nm}.js`).then(o => o[id] || null); });
const armsOf = e => { const ds = dsOf(e.id); return ((IDX && IDX.arms && IDX.arms[ds]) || []).filter(a => X.dev || a === 'method_R13' || (!e.s11 && a === 'method_v6')); };
const armLabel = a => ({method_R13: T('本方法', 'our method'), method_v6: T('上一版 v6.11', 'previous version v6.11'), method_v4: T('更早的 v4', 'earlier v4')})[a] || a;

/* ---------- doors: same letter and colour on the map and in every bar ---------- */
function buildDoors(e, on, rf) {
  /* one mapping candidate_k -> letter, numbered near to far from the start, built from the scorer's candidate catalogue;
     the online hypotheses reach it through C's id_map (MATCHED only); online doors without a match are "unmatched" (no letter) */
  const doors = [], byRef = {}, byOn = {}, s = e.m.s || [0, 0, 0];
  const cat = ((rf && rf.c) || []).slice().sort((p, q) => Math.hypot(p[1] - s[0], p[2] - s[1]) - Math.hypot(q[1] - s[0], q[2] - s[1]));
  cat.forEach((c, i) => { const d = {ref: c[0], on: null, x: c[1], y: c[2], side: c[3], w: c[4], n: String.fromCharCode(65 + i), c: DOOR[i % DOOR.length], name: T('门 ', 'Opening ') + String.fromCharCode(65 + i), show: !!((rf.p && rf.p[c[0]] > 0) || c[5])}; doors.push(d); byRef[c[0]] = d; });
  let u = 0; const un = [];
  if (on) on.h.forEach((h, i) => { if (h[1] === 'literal' || h[1] === 'unseen') return; const k = on.m && on.m[String(i)]; let d = k && byRef[k];
    if (d) { d.on = i; d.show = true; } else { d = {ref: null, on: i, x: h[2], y: h[3], side: h[4], w: 1.0, n: '?', c: DOOR[7], unmatched: true, show: true}; doors.push(d); un.push(d); }
    byOn[i] = d; });
  un.forEach((d, i) => { d.name = T('未对应', 'Unmatched') + (un.length > 1 ? ' ' + (i + 1) : ''); });
  return {doors, byRef, byOn};
}

/* ---------- bars ---------- */
const f2 = v => v == null ? '—' : v.toFixed(2);
const bar = (c, name, v, cls, label) => `<div class="bb ${cls || ''}" style="--c:${c}"><span class="nm">${esc(name)}</span><span class="btrk"><i style="width:${Math.max(0, Math.min(1, v)) * 80}%"></i><b>${label != null ? label : f2(v)}</b></span></div>`;

function leftRows(on, DS, pt) {
  const rows = [];
  const idxLit = on.h.findIndex(h => h[1] === 'literal'), idxUn = on.h.findIndex(h => h[1] === 'unseen');
  const mk = (i, name, c, kind) => { const p = pt[2][i]; if (p == null) return; const a = pt[3][i]; rows.push({i, name, c, kind, p, na: a === 0}); };
  if (idxLit >= 0) mk(idxLit, T('照字面', 'Follow the words'), LITC, 'lit');
  DS.doors.filter(d => d.on != null).forEach(d => mk(d.on, d.name, d.c, 'door'));
  if (idxUn >= 0) mk(idxUn, T('还没看到的门', 'Opening not seen yet'), UNC, 'un');
  return rows;
}

/* ---------- one-sentence reason ---------- */
function why(on, DS, name) {
  const d = on.d; if (!d) return T('这一题里本方法在运行中没有做出标准的决定（原日志没有记录），所以这里不给解释。', 'In this case the method made no standard decision while running (the original log has none), so no explanation is given.');
  let pt = on.t[0]; for (const q of on.t) if (q[0] <= d[0] + 1e-6) pt = q;
  const iLit = on.h.findIndex(h => h[1] === 'literal'), p = i => pt[2][i];
  const exec = DS.doors.filter(x => x.on != null && p(x.on) != null && pt[3][x.on] !== 0).sort((a, b) => p(b.on) - p(a.on));
  const litNo = iLit >= 0 && pt[3][iLit] === 0, litP = iLit >= 0 ? p(iLit) : null;
  const e2 = v => v == null ? '—' : v.toFixed(2);
  if (d[2] === 'COMMIT') {
    const x = DS.byOn[d[3]]; if (!x) return T('本方法选了一扇门，但这扇门在公开材料里没有对上编号。', 'The method chose an opening that could not be matched to a public number.');
    const pre = litNo ? T('照字面在这里执行不了；', 'Following the words cannot be carried out here; ') : '';
    if (exec.length > 1 && exec[0] === x) return pre + T(`能执行的门里${x.name} 概率最高（${e2(p(x.on))} 对 ${e2(p(exec[1].on))}），所以进${x.name}。`, `among the openings that can be used, ${x.name} has the highest probability (${e2(p(x.on))} against ${e2(p(exec[1].on))}), so it enters ${x.name}.`.replace(/^./, c => pre ? c : c.toUpperCase()));
    if (exec.length <= 1) return pre + T(`能执行的门里只有${x.name}（概率 ${e2(p(x.on))}），所以进${x.name}。`, `among the openings that can be used only ${x.name} remains (probability ${e2(p(x.on))}), so it enters ${x.name}.`.replace(/^./, c => pre ? c : c.toUpperCase()));
    return pre + T(`${x.name} 的概率（${e2(p(x.on))}）不是最高的，但把“能执行的程度”和期望得分一起算，它最划算（期望得分 ${e2(pt[4][x.on])}），所以进${x.name}。`, `${x.name} is not the most probable (${e2(p(x.on))}), but weighing how executable it is and its expected score (${e2(pt[4][x.on])}) it is the best choice, so it enters ${x.name}.`);
  }
  if (d[2] === 'KEEP_LITERAL') {
    const best = exec[0];
    return best ? T(`照字面的概率是 ${e2(litP)}，门里最高的${best.name} 只有 ${e2(p(best.on))}，照字面又能执行，所以照字面走。`, `Following the words has probability ${e2(litP)} against ${e2(p(best.on))} for the best opening (${best.name}) and it can be carried out, so it follows the words.`)
      : T(`照字面的概率是 ${e2(litP)}，没有能执行的门，所以照字面走。`, `Following the words has probability ${e2(litP)} and no opening can be used, so it follows the words.`);
  }
  return T('能执行的做法里没有比停下报告更值得的，所以停下报告。', 'None of the actions that can be carried out is worth more than stopping to report, so it stops and reports.');
}

/* ---------- chart: probabilities against distance driven ---------- */
function chart(on, DS, names) {
  const W = 360, H = 150, Lm = 30, Rm = 92, Tm = 8, Bm = 24, pw = W - Lm - Rm, ph = H - Tm - Bm;
  const maxP = Math.max(1, ...on.t.map(r => r[1]), on.d ? on.d[1] : 0) * 1.03, x = p => Lm + p / maxP * pw, y = v => Tm + (1 - v) * ph;
  const lines = on.h.map((h, i) => ({i, pts: on.t.filter(r => r[2][i] != null).map(r => [x(r[1]), y(r[2][i])])})).filter(l => l.pts.length && names[l.i]);
  const labs = lines.map(l => ({i: l.i, y: l.pts[l.pts.length - 1][1]})).sort((a, b) => a.y - b.y);
  for (let k = 1; k < labs.length; k++) if (labs[k].y - labs[k - 1].y < 12) labs[k].y = labs[k - 1].y + 12;
  const ly = Object.fromEntries(labs.map(l => [l.i, l.y]));
  const grid = [0, .5, 1].map(v => `<line x1="${Lm}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${Lm - 4}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="var(--ink3)">${(v * 100).toFixed(0)}%</text>`).join('');
  const xt = []; for (let p = 0; p <= maxP; p += 2) xt.push(p);
  return `<svg viewBox="0 0 ${W} ${H}" class="bchart" role="img">${grid}${xt.map(p => `<text x="${x(p)}" y="${Tm + ph + 12}" text-anchor="middle" font-size="9" fill="var(--ink3)">${p}</text>`).join('')}
    <text x="${Lm + pw / 2}" y="${H - 3}" text-anchor="middle" font-size="9" fill="var(--ink3)">${T('前进距离（m）', 'distance driven (m)')}</text>
    ${on.d ? `<line x1="${x(on.d[1])}" x2="${x(on.d[1])}" y1="${Tm}" y2="${Tm + ph}" stroke="var(--ink2)" stroke-dasharray="3 3"/><text x="${x(on.d[1]) + 3}" y="${Tm + 8}" font-size="9" fill="var(--ink2)">${T('做决定', 'decision')}</text>` : ''}
    ${lines.map(l => `<polyline fill="none" stroke="${names[l.i][1]}" stroke-width="2" stroke-linejoin="round" points="${l.pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/><text x="${W - Rm + 5}" y="${(ly[l.i] + 3).toFixed(1)}" font-size="10" font-weight="600" fill="${names[l.i][1]}">${esc(names[l.i][0])}</text>`).join('')}
    <line id="bnow" x1="${x(0)}" x2="${x(0)}" y1="${Tm}" y2="${Tm + ph}" stroke="var(--accent)" stroke-width="1.5"/></svg>`;
}

/* ---------- reference panel ---------- */
function refHTML(e, rf, DS) {
  const head = `<h4>${T('评分器里的完整 POMDP', 'The scorer’s full POMDP')}</h4>`;
  if (isObstacle(e.id)) return head + `<p class="note">${T('参考模型不处理箱子，所以有箱子 / 没箱子的题没有参考的概率。', 'The reference model does not handle boxes, so with-box / no-box cases have no reference probabilities.')}</p>`;
  if (!rf || !rf.p) return head + `<p class="note">${T('这一题的参考未定。', 'The reference is undecided for this case.')}</p>`;
  const av = new Set(rf.av || []), dec = rf.d, rows = [];
  const dn = id => DS.byRef[id] || null;
  if (rf.p.z0 != null) rows.push({k: 'LITERAL', name: T('照字面', 'Follow the words'), c: LITC, p: rf.p.z0, na: !av.has('LITERAL'), sel: dec === 'LITERAL'});
  const cands = (rf.c || []).map(c => c[0]).filter(id => rf.p[id] != null);
  cands.map(id => ({id, d: dn(id)})).sort((a, b) => (a.d && b.d ? a.d.n.localeCompare(b.d.n) : 0)).forEach(({id, d}) => { if (rf.p[id] > 0 || id === dec) rows.push({k: id, name: d ? d.name : id, c: d ? d.c : DOOR[7], p: rf.p[id], na: !av.has(id), sel: dec === id}); });
  if (rf.p.z_empty != null) rows.push({k: 'ABSENT', name: T('门不存在', 'No such opening'), c: UNC, p: rf.p.z_empty, na: false, sel: false, un: true});
  const pbars = rows.map(r => bar(r.c, r.name, r.p, `${r.na ? 'na' : ''} ${r.sel ? 'sel' : ''} ${dec && !r.sel ? 'dim' : ''} ${r.un ? 'un' : ''}`)).join('');
  const es = rf.es, er = [];
  if (es) { if (es.l != null) er.push({name: T('照字面', 'Follow the words'), c: LITC, v: es.l, na: !av.has('LITERAL'), sel: dec === 'LITERAL'});
    Object.keys(es.s || {}).filter(id => av.has(id) || id === dec || rf.p[id] > 0).forEach(id => { const d = dn(id); er.push({name: d ? d.name : id, c: d ? d.c : DOOR[7], v: es.s[id], na: !av.has(id), sel: dec === id}); });
    if (es.r != null) er.push({name: T('停下报告', 'Stop and report'), c: UNC, v: es.r, na: false, sel: dec === 'REPORT'}); }
  const sc = er.length ? `<h4 style="margin-top:12px">${T('决定时三类做法的期望得分', 'Expected score of the three kinds of action at the decision')}</h4><div class="bb-list">${er.map(r => bar(r.c, r.name, (r.v + 1) / 2, `${r.na ? 'na' : ''} ${r.sel ? 'sel' : ''} ${!r.sel ? 'dim' : ''}`, r.v.toFixed(2))).join('')}</div><p class="bcap">${T('条长 = 期望得分（−1 到 +1）；斜线 = 在这个位置执行不了。', 'Bar length = expected score (−1 to +1); hatched = cannot be carried out at this position.')}</p>` : '';
  return head + `<div class="bb-list">${pbars}</div><p class="bcap">${T('这是评分器里完整 POMDP 在决定时的概率：它知道整张地图和出题时各种意思的比例，但不知道这一题的答案；它一开始就知道整张地图，所以概率在路上通常不变，这里只画决定时的一张。', 'The scorer’s full POMDP at its decision: it knows the whole map and how often each kind of meaning occurs in the test set, but not the answer to this case; it knows the whole map from the start, so its probabilities rarely change on the way, and only the one at the decision is drawn.')}</p>${sc}
    <p class="note" style="margin-top:8px">${T('参考选的是：', 'The reference chooses: ')}<b>${esc(dec === 'LITERAL' ? T('照字面', 'follow the words') : dec === 'REPORT' ? T('停下报告', 'stop and report') : (dn(dec) ? dn(dec).name : dec))}</b>${T('（它知道整张地图，结论不一定和本方法相同）。', ' (it knows the whole map, so its choice need not equal the method’s).')}</p>`;
}

/* ---------- mount ---------- */
function mount(e, hooks) {
  const stage = document.querySelector('.stagecard'); if (!stage || $('#beliefcard')) return;
  const tip = T('概率是怎么来的：本方法的先验只看指令的说法——纯距离指令“照字面”0.3，带“第 N 个 / 这个”的指令 0.05；每走一步，按口述距离离哪扇门近、看到了哪些门来更新；到最后做决定时，比较“能执行的程度 × 期望得分”。这些不是固定数值：出题时各种意思的比例只有评分器知道，评分器里的完整 POMDP 知道整张地图和这些比例。', 'Where the probabilities come from: the method’s prior only looks at how the instruction is worded — a pure distance instruction gets 0.3 for “follow the words”, one with “the N-th / this” gets 0.05; at every step the probabilities are updated by which opening is closest to the spoken distance and by which openings have been seen; at the final decision it compares “how executable × expected score”. They are not fixed numbers: how often each kind of meaning occurs in the test set is known only to the scorer, whose full POMDP knows the whole map and these frequencies.');
  stage.insertAdjacentHTML('afterend', `<section class="card beliefcard" id="beliefcard"><div class="card-h"><span class="tile">≈</span><h3 title="${esc(tip)}">${T('方法怎么想', 'How the method thinks')} <span class="tipu">?</span></h3><span class="more" id="barms"></span></div><div id="bbody"><p class="note" style="padding:6px 16px 14px">…</p></div></section>`);
  let arm = e.s11 ? 'method_R13' : 'method_v6';
  const render = () => {
    const body = $('#bbody'); if (!body) return;
    Promise.all([getOnline(e.id, arm), getRef(e.id)]).then(([on, rf]) => { if (!$('#bbody')) return;
      const DS = buildDoors(e, on && on.t && on.t.length ? on : null, rf);
      const armsHTML = X.dev && armsOf(e).length > 1 ? armsOf(e).map(a => `<a class="${a === arm ? 'on' : ''}" data-arm="${a}">${armLabel(a)}</a>`).join('') : '';
      $('#barms').innerHTML = armsHTML ? `<nav class="atoc s10nav" style="margin:0">${armsHTML}</nav>` : (e.s11 ? T('本方法', 'our method') : armLabel(arm));
      document.querySelectorAll('#barms [data-arm]').forEach(a => a.onclick = () => { arm = a.dataset.arm; render(); });
      // doors on the map
      e.m._overs = e.m._overs || {};
      e.m._overs.belief = (g, F) => { g.save(); DS.doors.forEach(d => { if (d.x == null || !d.show) return; const c = d.c, dep = 1.6 * (d.side === 'left' || d.side === 1 ? 1 : -1), w = d.w || 1, x0 = F.X(d.x - w / 2), x1 = F.X(d.x + w / 2), y0 = F.Y(d.y), y1 = F.Y(d.y + dep);
        g.fillStyle = c + '38'; g.strokeStyle = c; g.lineWidth = 2; g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); g.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        g.fillStyle = c; g.font = '700 12px ui-monospace,Menlo,monospace'; g.fillText(d.unmatched ? '?' : d.n, (x0 + x1) / 2 - 4, (y0 + y1) / 2 + 4); }); g.restore(); };
      hooks.paint();
      const right = `<div class="bcol" id="bref">${refHTML(e, rf, DS)}</div>`;
      if (isObstacle(e.id)) { body.innerHTML = `<div class="bgrid"><div class="bcol"><h4>${T('本方法（边走边算）', 'Our method (updated while driving)')}</h4><p class="note">${T('绕障题的概率还没有导出（导出只含五个基础测试集）。', 'Probabilities of the detour cases are not exported (the export covers the five base test sets only).')}</p></div>${right}</div>`; e._bu = null; return; }
      if (!on) { body.innerHTML = `<div class="bgrid"><div class="bcol"><h4>${T('本方法（边走边算）', 'Our method (updated while driving)')}</h4><p class="note">${T('这一题没有导出概率。', 'No probabilities were exported for this case.')}</p></div>${right}</div>`; e._bu = null; return; }
      if (!on.t.length) { body.innerHTML = `<div class="bgrid"><div class="bcol"><h4>${T('本方法', 'Our method')}</h4><p class="note">${T('这类指令直接照字面执行，没有概率。', 'This kind of instruction is carried out literally, so there are no probabilities.')}</p></div>${right}</div>`; e._bu = null; return; }
      const names = {}; on.h.forEach((h, i) => { names[i] = h[1] === 'literal' ? [T('照字面', 'Follow the words'), LITC] : h[1] === 'unseen' ? [T('还没看到的门', 'Not seen yet'), UNC] : (DS.byOn[i] ? [DS.byOn[i].name, DS.byOn[i].c] : [T('未对应', 'Unmatched'), DOOR[7]]); });
      const noScore = arm === 'method_v4';
      const unnorm = on.t.some(r => { const s = r[2].reduce((a, v) => a + (v || 0), 0); return Math.abs(s - 1) > 0.02; });
      body.innerHTML = `<div class="bgrid"><div class="bcol"><h4>${T('本方法边走边算的', 'What the method computes while driving')}</h4><div class="bb-list" id="bbars"></div>
        <p class="bcap">${T('每一行是一种可能：条长 = 这一刻本方法认为它的概率，随轨迹播放更新；暂停时是当前时刻，播到最后是决定那一刻；斜线 = 在这里执行不了。', 'Each row is one possibility: bar length = the probability the method gives it at this moment, updated with the replay (the current moment when paused, the moment of decision at the end); hatched = cannot be carried out here.')}</p>
        ${unnorm ? `<p class="note">${T('原始权重未归一，如实显示。', 'The original weights are not normalised; shown as they are.')}</p>` : ''}
        ${chart(on, DS, names)}<p class="bcap">${T('折线 = 各种可能的概率随前进距离的变化（只有记录到变化的位置才有点）；竖线 = 做决定的位置，橙色线 = 现在播放到的位置。', 'Lines = the probabilities against distance driven (points only where a change was logged); dashed vertical = where it decided, orange line = the current replay position.')}</p>
        <div id="bscores"></div></div>${right}</div><p class="bwhy" id="bwhy"></p>`;
      const d = on.d, iLit = on.h.findIndex(h => h[1] === 'literal');
      // expected scores at the decision
      const sc = $('#bscores');
      if (d && !noScore) { let pt = on.t[0]; for (const q of on.t) if (q[0] <= d[0] + 1e-6) pt = q;
        const rows = on.h.map((h, i) => ({i, h})).filter(o => o.h[1] !== 'unseen' && pt[2][o.i] != null && pt[4][o.i] != null).map(o => ({n: names[o.i][0], c: names[o.i][1], v: pt[4][o.i], na: pt[3][o.i] === 0, sel: d[3] === o.i}));
        sc.innerHTML = `<h4 style="margin-top:12px">${T('决定时各做法的期望得分', 'Expected score of each action at the decision')}</h4><div class="bb-list">${rows.map(r => bar(r.c, r.n, r.v == null ? 0 : (r.v + 1) / 2, `${r.na ? 'na' : ''} ${r.sel ? 'sel' : ''} ${r.sel ? '' : 'dim'}`, r.v == null ? T('无', 'n/a') : r.v.toFixed(2))).join('')}</div><p class="bcap">${T('条长 = 期望得分（−1 到 +1）；只列出当时打了分的做法（执行不了的做法没有分）；实色 = 选中的做法。', 'Bar length = expected score (−1 to +1); only actions that were scored then are listed (actions that cannot be carried out get no score); solid = the chosen action.')}</p>`; }
      else if (noScore) sc.innerHTML = `<p class="note">${T('原诊断未记录这个方法的执行程度和期望得分。', 'The original diagnostics did not record executability and expected scores for this method.')}</p>`;
      $('#bwhy').textContent = noScore || !d ? (d ? '' : why(on, DS, names)) : why(on, DS, names);
      if (noScore && d) $('#bwhy').textContent = T('原诊断没有记录这个方法比较期望得分的过程，所以不生成解释。', 'The original diagnostics do not record how this method compared expected scores, so no explanation is generated.');
      // live update
      const bars = $('#bbars'), hasChosen = d && d[3] != null;
      e._bu = t => { const tt = d ? Math.min(t, d[0]) : t; let k = 0; for (let i = 0; i < on.t.length; i++) if (on.t[i][0] <= tt + 1e-6) k = i; const pt = on.t[k];
        const rows = leftRows(on, DS, pt), atD = d && t >= d[0] - 1e-6;
        bars.innerHTML = rows.map(r => bar(r.c, r.name, r.p, `${r.na ? 'na' : ''} ${r.kind === 'un' ? 'un' : ''} ${atD && r.i === d[3] ? 'sel' : ''} ${atD && r.i !== d[3] ? 'dim' : ''}`)).join('');
        const nowEl = $('#bnow'); if (nowEl) { const maxP = Math.max(1, ...on.t.map(r => r[1]), d ? d[1] : 0) * 1.03; const xx = 30 + pt[1] / maxP * (360 - 30 - 92); nowEl.setAttribute('x1', xx); nowEl.setAttribute('x2', xx); } };
      e._bu(hooks.getT());
    });
  };
  index().then(render);
}
window.SLX.belief = {mount, onAnswer: () => {}};
})();
