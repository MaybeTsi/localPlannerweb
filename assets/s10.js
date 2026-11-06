/* S10 views (main method v6): leaderboards per subset, confusion table, stratified scores, per-subset differences, per-case page.
   Data: window.SL_S10 (data/s10/meta.js, B's own tables copied), data/s10/cases/<key>.js (per-slot public fields),
   data/s10/traj/<key>__<n>.js (trajectories of every case and arm). Nothing is computed here except display formatting;
   every number comes from B's files named in SL_S10.sources. Loaded after app.js, which exposes window.SLX. */
(function () {
'use strict';
const X = window.SLX, S = window.SL_S10;
if (!X || !S) return;
const {$, esc, fmt, t, store, ARMC, drawMap} = X;

/* ---------- display names ---------- */
const SUB = [ // key, B dataset, zh, en, note
  ['main', 'S10_MAIN_SYNTH', '主集', 'Main set', 3000],
  ['shiftK', 'S10_SHIFT_K', '偏移：候选数', 'Shift: number of candidates', 600],
  ['shiftR', 'S10_SHIFT_ROUND', '偏移：取整', 'Shift: rounding', 600],
  ['shiftP', 'S10_SHIFT_PRIOR', '偏移：意图先验', 'Shift: intent prior', 600],
  ['clutter', 'S10_CLUTTER', '杂物走廊', 'Clutter', 600],
  ['hall', 'S10_DIVERSITY_F1', '大厅', 'Hall', 400],
  ['corner', 'S10_DIVERSITY_F2', '拐角', 'Corner', 400],
  ['real', 'S10_REAL', '真实地图', 'Real maps', 2715]];
const REAL_SPLIT = [['S10_REAL/hospital', '医院', 'Hospital'], ['S10_REAL/office', '办公室', 'Office']];
const ARMS7 = S.arms;
const ORDER = ['method_v6', 'literal_if_feasible', 'method_v4', 'nearest', 'v16', 'v6_pi0_zero', 'v6_no_speed'];
const BEHAV = {L: {zh: '照字面完成', en: 'Literal completed'}, S: {zh: '进入结构', en: 'Entered a structure'}, R: {zh: '报告', en: 'Reported'}, I: {zh: '未完成', en: 'Incomplete'},
  C: {zh: '碰撞', en: 'Collision'}, '?': {zh: '未知', en: 'Unknown'}, M: {zh: '未知（多个结构）', en: 'Unknown (several structures)'}};
const BEH_LONG = {LITERAL_COMPLETED: 'L', STRUCTURE: 'S', STOP_REPORT: 'R', INCOMPLETE: 'I', COLLISION: 'C', UNKNOWN: '?', UNKNOWN_MULTIPLE_STRUCTURES: 'M'};
const INTENT = {literal: {zh: '字面', en: 'Literal'}, structure: {zh: '结构', en: 'Structure'}, none: {zh: '不存在', en: 'None exists'}};
const STRATA = {CLEAR: {zh: '意图明确', en: 'Clear intent'}, LITERAL_STRUCTURE_AMBIGUITY: {zh: '字面与结构歧义', en: 'Literal vs structure ambiguous'},
  STRUCTURE_STRUCTURE_AMBIGUITY: {zh: '结构之间歧义', en: 'Between structures ambiguous'}, REFERENCE_UNKNOWN: {zh: '参考未知', en: 'Reference unknown'}};
const KN = {'01': '①', '02': '②', '03': '③', '04': '④', '05': '⑤', '06': '⑥', '09': '⑨', '14': '⑭', '15': '⑮', '16': '⑯'};
const L10 = () => document.documentElement.lang === 'zh-CN';
const z = () => L10();
const T = (zh, en) => z() ? zh : en;
const pct = (v, d = 1) => v == null ? '—' : (100 * v).toFixed(d) + '%';
const f3 = v => v == null ? '—' : v.toFixed(3);
const ci = c => c ? `[${f3(c[0])}, ${f3(c[1])}]` : '';
const armName = a => (X.armName ? X.armName(a) : a);
const utilColor = u10 => u10 == null ? 'var(--sand7)' : u10 >= 10 ? '#12A594' : u10 >= 3 ? '#F5AE73' : u10 === 0 ? 'var(--sand7)' : '#E5484D';
const utilText = u10 => u10 == null ? '?' : u10 >= 10 ? '+1' : u10 === 3 ? '+0.3' : u10 === 0 ? '0' : u10 <= -10 ? '−1' : (u10 / 10).toFixed(1);
const rate = (scope, arm) => S.rates.find(r => r.scope === scope && r.arm === arm);
const datasetOf = key => (SUB.find(s => s[0] === key) || [])[1];
const keyOfDs = ds => (SUB.find(s => s[1] === ds) || [])[0];

/* ---------- data loading ---------- */
const caseSets = {}, caseWait = {};
window.SL_S10_CASES = (k, o) => { caseSets[k] = o; (caseWait[k] || []).forEach(f => f(o)); delete caseWait[k]; };
function loadCases(k) { if (caseSets[k]) return Promise.resolve(caseSets[k]);
  return new Promise(res => { if (!caseWait[k]) { caseWait[k] = []; const sc = document.createElement('script'); sc.src = `data/s10/cases/${k}.js`; document.head.appendChild(sc); } caseWait[k].push(res); }); }
const trChunks = {}, trWait = {};
window.SL_S10_TRAJ = (k, o) => { trChunks[k] = o; (trWait[k] || []).forEach(f => f(o)); delete trWait[k]; };
function loadTraj(name) { if (trChunks[name]) return Promise.resolve(trChunks[name]);
  return new Promise(res => { if (!trWait[name]) { trWait[name] = []; const sc = document.createElement('script'); sc.src = `data/s10/traj/${name}.js`; sc.onerror = () => res({}); document.head.appendChild(sc); } trWait[name].push(res); }); }

/* ---------- leaderboard (one per subset) ---------- */
function board(scope, title, src) {
  const rows = ORDER.map(a => rate(scope, a)).filter(Boolean);
  if (!rows.length) return '';
  const best = Math.max(...rows.map(r => r.mean_geometry_equal_score));
  return `<article class="card s10b"><div class="card-h"><h3>${esc(title)}</h3><span class="more">${esc(scope)} · ${fmt(rows[0].generated)} ${T('题', 'cases')}</span></div>
   <div class="tbl"><table class="t s10t"><thead><tr><th>${T('方法', 'Method')}</th><th>${T('平均得分', 'Mean score')}</th><th>${T('完成率', 'Completion')}</th><th>${T('参考一致率', 'Reference match')}</th><th>${T('严重错误率', 'Severe error')}</th></tr></thead><tbody>
   ${rows.map(r => `<tr class="${r.arm === 'method_v6' ? 'me' : ''}"><td class="nm"><span class="sw" style="background:${ARMC[r.arm] || 'var(--sand8)'}"></span>${esc(armName(r.arm))}</td>
     <td class="c"><b>${f3(r.mean_geometry_equal_score)}</b><span class="u">${esc(ci(r.ci95))}</span><span class="bar"><i style="width:${Math.max(0, r.mean_geometry_equal_score) / Math.max(best, 1e-9) * 100}%"></i></span></td>
     <td class="c">${pct(r.intent_completion_all_generated)}<span class="u">${fmt(r.intent_completed_plus1)} / ${fmt(r.generated)}</span></td>
     <td class="c">${pct(r.strict_rate_identifiable)}<span class="u">${fmt(r.strict_matches)} / ${fmt(r.identifiable_reference_comparisons)}</span></td>
     <td class="c">${pct(r.severe_rate_known)}<span class="u">${fmt(r.severe_errors)} / ${fmt(r.severe_known)}</span></td></tr>`).join('')}
   </tbody></table></div><div class="note src">${esc(src || S.sources.rates)}</div></article>`;
}


/* ---------- the four categories (same layout as the earlier version), taken from the main experiment ---------- */
const SETDEF = {X1: ['main'], X2: ['real'], X3: ['clutter', 'hall', 'corner'], X4: ['shiftK', 'shiftR', 'shiftP']};
const toMap = c => { const w = c.w; return {b: w.b, r: w.r, o: w.o, s: w.s, c: [], img: w.scene || null}; };
const OUTCH = u => u == null ? '?' : u >= 10 ? '1' : u >= 3 ? 'r' : u === 0 ? 'z' : 'n';
const loaded = {}, loading = {};
const setOfKey = key => Object.keys(SETDEF).find(k => SETDEF[k].includes(key));
const setOfId = id => { const key = keyOfDs(id.split(':')[0]); return key && setOfKey(key); };
function load(setId) {
  if (loaded[setId]) return Promise.resolve();
  if (loading[setId]) return loading[setId];
  return loading[setId] = Promise.all(SETDEF[setId].map(key => loadCases(key).then(C => [key, C]))).then(all => {
    const ARMS = X.ARMS;
    for (const [key, C] of all) for (const id in C) {
      const c = C[id];
      if (X.byId.has(id)) continue;
      const g = setId === 'X2' ? (c.w.scene || '') : setId === 'X1' ? '' : key;
      const e = {id, d: setId, g, bd: setId === 'X2' ? g : undefined, k: c.k, tx: X.s10Text(c), u: c.u, m: toMap(c), o: ARMS.map(a => { const q = c.a[a]; return q ? OUTCH(q[1]) : ' '; }).join(''),
        sh: 'S10_' + key, ans: false, t: c.t ? 1 : 0, s10: 1, _c: c};
      X.IDX.push(e); X.byId.set(id, e);
    }
    loaded[setId] = 1; X.resetArms && X.resetArms();
  });
}
/* score / behaviour -> the shapes the case viewer already understands */
function det(e) {
  if (e._det && (!e.m.img || X.rasterReady(e.m.img))) return Promise.resolve(e._det);
  const c = e._c;
  return Promise.all([c.t && c.ch ? loadTraj(c.ch) : {}, e.m.img ? X.raster(e.m.img) : null]).then(([chunk]) => {
    const tr = chunk[e.id] || {}, arms = {};
    for (const a in c.a) { const q = c.a[a]; if (!q) continue;
      arms[a] = {i: q[1] == null ? null : q[1] > 0, l: null, c: null, na: false, rs: q[0], fs: '', t: null, t0: c.t0 && c.t0[a] != null ? c.t0[a] : null, tr: tr[a] || null, s10: q}; }
    return e._det = {answers: {}, cand: null, arms, _tr: 1};
  });
}

/* ---------- data section (Overview page): one leaderboard per subset ---------- */
let dataSub = null;
function dataHTML() {
  const subs = SUB.map(s => ({key: s[0], ds: s[1], label: T(s[2], s[3]), n: s[4]}));
  const cur = subs.find(x => x.key === dataSub) || null;
  const mainR = rate('S10_MAIN_SYNTH', 'method_v6'), litR = rate('S10_MAIN_SYNTH', 'literal_if_feasible');
  const chips = `<nav class="atoc s10nav" id="s10chips"><a class="${!cur ? 'on' : ''}" data-s="">${T('全部子集', 'All subsets')}</a>${subs.map(x => `<a class="${cur && cur.key === x.key ? 'on' : ''}" data-s="${x.key}">${esc(x.label)} <span class="n">${fmt(x.n)}</span></a>`).join('')}</nav>`;
  const boards = (cur ? [cur] : subs).map(x => {
    if (x.key === 'real') return board('S10_REAL', T('真实地图（合计）', 'Real maps (all)')) + REAL_SPLIT.map(([sc, zh, en]) => board(sc, T('真实地图 · ' + zh, 'Real maps · ' + en))).join('');
    return board(x.ds, x.label);
  }).join('');
  return `<section class="s10data" id="s10data"><div class="eyebrow" style="margin-top:34px"><span class="dot"></span>${T('每个子集的成绩', 'Scores per subset')} · B ${esc(S.b.slice(0, 9))}</div>
    <p class="lede" style="margin:6px 0 12px">${T('每条指令都有真实意图：照字面、进某个结构，或这个结构根本不存在。主方法 v6 在字面和各结构之间按期望得分选一个，只在没有可执行动作也没有安全观测时才报告。', 'Every instruction has a true intent: the literal reading, a structure, or none exists. The main method v6 picks among the literal reading and the structures by expected score, and reports only when there is neither an executable action nor a safe observation.')}</p>
    ${chips}
    <div class="agrid s10grid" style="margin-top:14px">${!cur ? `<article class="card s10hero"><div class="card-h"><h3>${T('主集上的主比较', 'Primary comparison on the main set')}</h3></div>
      <div class="big2"><div><b>${f3(mainR.mean_geometry_equal_score)}</b><span>v6 ${T('平均得分', 'mean score')}</span></div><div><b>${f3(litR.mean_geometry_equal_score)}</b><span>${T('字面可行就照字面', 'literal if feasible')}</span></div>
      <div><b>${pct(mainR.intent_completion_all_generated)}</b><span>v6 ${T('完成率', 'completion')}</span></div><div><b>${pct(mainR.strict_rate_identifiable)}</b><span>v6 ${T('与参考一致', 'reference match')}</span></div></div>
      <p class="note">${T('每题分数：完成真实意图 +1，安全报告 +0.3，没有完成 0，严重错误 −1。', 'Per-case score: true intent completed +1, safe report +0.3, not completed 0, severe error −1.')}</p>
      <div class="note src">${esc(S.sources.rates)}</div></article>` : ''}${boards}</div></section>`;
}
function bindData(root) {
  const nav = root.querySelector('#s10chips'); if (!nav) return;
  nav.querySelectorAll('a').forEach(a => a.onclick = () => { dataSub = a.dataset.s || null; const host = root.querySelector('#s10data'); const tmp = document.createElement('div'); tmp.innerHTML = dataHTML(); host.replaceWith(tmp.firstElementChild); bindData(root); });
}

/* ---------- side panel of the case viewer ---------- */
const decName = d => d == null ? '—' : d === 'LITERAL' ? T('照字面', 'literal') : d === 'REPORT' ? T('报告', 'report') : T('结构 ', 'structure ') + d;
const NOEXP = () => `<span class="nexp">${T('未导出', 'not exported')}</span>`;
function side(e, d, presets, ARMS_ORDER) {
  const c = e._c;
  const lit = c.lit ? c.lit[0] : null;
  const refd = (c.a.method_v6 && c.a.method_v6[6]) || (c.a.literal_if_feasible && c.a.literal_if_feasible[6]) || null;
  const refLabel = refd == null ? T('参考未知', 'reference unknown') : refd === 'LITERAL' ? T('照字面', 'follow the literal reading') : refd === 'REPORT' ? T('报告', 'report') : T('进入结构 ', 'enter structure ') + refd;
  const litCat = {EXACT: T('有见证（原参数）', 'witness exists (exact parameters)'), WITHIN_1M: T('有见证（纵向偏移 ≤1 m）', 'witness exists (≤1 m longitudinal offset)'), INFEASIBLE: T('该运动族内无见证', 'no witness in the motion family'), UNDEFINED: T('未定义', 'undefined')};
  return `<section class="card"><div class="card-h"><span class="tile">≡</span><h3>${T('这一题', 'This case')}</h3></div><dl class="kv">
    <dt>${T('字面可行性（有限运动族的静态见证）', 'Literal feasibility (static witness in a finite motion family)')}</dt><dd>${lit ? `${esc(litCat[lit] || lit)}${c.lit[1] !== c.lit[0] ? ` <span class="u">(${T('规划车体：', 'planning body: ')}${esc(litCat[c.lit[1]] || c.lit[1])})</span>` : ''}` : NOEXP()}</dd>
    <dt>${T('参考的决策', 'Reference decision')}</dt><dd>${esc(refLabel)}</dd>
    <dt>${T('三种做法的期望得分', 'Expected score of the three options')}</dt><dd>${NOEXP()}</dd>
    <dt>${T('候选结构', 'Candidates')}</dt><dd>${NOEXP()}</dd>
    <dt>${T('真实意图', 'True intent')}</dt><dd id="s10true">${NOEXP()}</dd></dl>
    <div class="note src">${esc(S.sources.cases)}</div></section>
  <section class="card"><div class="card-h"><span class="tile">≡</span><h3>${T('各方法做了什么', 'What each method did')}</h3><span class="more">${T('点一行显示 / 隐藏轨迹', 'click a row to show / hide')}</span></div>
    <div class="presets"><span class="flab" style="align-self:center">${T('预设', 'Presets')}</span>${presets.filter(p => p[1].every(a => d.arms[a])).map((p, i) => `<button data-pre="${i}">${p[0]}</button>`).join('')}</div>
    ${ORDER.map(a => { const q = c.a[a]; if (!q) return ''; const on = X.state.on[a];
      return `<button class="armrow s10row ${on ? '' : 'off'}" data-a="${a}" style="--c:${ARMC[a] || '#888'}"><span class="sq"></span><span class="nm">${esc(armName(a))}<code>${esc((BEHAV[q[0]] || {})[z() ? 'zh' : 'en'] || q[0])}${q[3] && q[3].length ? ' · ' + T('进入 ', 'entered ') + esc(q[3].join(', ')) : ''}${q[5] ? ' · ' + T('决策：', 'decided: ') + esc(decName(q[5])) : ''}</code></span>
        <span class="sc" style="background:${utilColor(q[1])};color:${q[1] != null && q[1] !== 0 ? '#fff' : 'var(--ink2)'}">${utilText(q[1])}</span>${q[2] ? `<span class="sev" title="${T('严重错误', 'severe error')}">!</span>` : '<span></span>'}</button>`; }).join('')}
    <div class="note">${T('颜色：', 'Colour: ')}<span class="lg1" style="background:#12A594"></span>+1 <span class="lg1" style="background:#F5AE73"></span>+0.3 <span class="lg1" style="background:var(--sand7)"></span>0 <span class="lg1" style="background:#E5484D"></span>−1</div></section>`;
}
/* "show true intent": B has not exported it, so the switch says so instead of guessing */
function showTrue(on) { const el = document.getElementById('s10true'); if (!el) return;
  el.innerHTML = on ? `${NOEXP()} <span class="u">${T('B 的私有字段；导出后这里显示字面 / 结构 / 不存在', 'B-private field; once exported this shows literal / structure / none')}</span>` : NOEXP(); }
const badge = q => { const u = q && q[1]; return {c: utilColor(u), t: utilText(u), fg: u != null && u !== 0 ? '#fff' : 'var(--ink2)'}; };
const behLabel = q => q ? ((BEHAV[q[0]] || {})[z() ? 'zh' : 'en'] || q[0]) : '';


/* ---------- confusion / strata / differences (used by the Overview page) ---------- */
function confusionTable() {
  const arms = ['method_v6', 'literal_if_feasible', 'method_v4'];
  const trues = ['literal', 'structure', 'none']; const behs = ['LITERAL_COMPLETED', 'STRUCTURE', 'STOP_REPORT', 'INCOMPLETE', 'COLLISION', 'UNKNOWN', 'UNKNOWN_MULTIPLE_STRUCTURES'];
  const get = (arm, tr, b) => S.confusion.filter(r => r.ds === 'S10_MAIN_SYNTH' && r.arm === arm && r.true === tr && r.beh === b).reduce((s, r) => s + r.n, 0);
  const head = `<tr><th rowspan="2">${T('真实意图', 'True intent')}</th>${arms.map(a => `<th colspan="${behs.length}" class="grp">${esc(armName(a))}</th>`).join('')}</tr><tr>${arms.map(() => behs.map(b => `<th>${esc(BEHAV[BEH_LONG[b]][z() ? 'zh' : 'en'])}</th>`).join('')).join('')}</tr>`;
  const body = trues.map(tr => `<tr><td class="nm">${esc(INTENT[tr][z() ? 'zh' : 'en'])}<span class="u">${fmt(arms.map(a => behs.reduce((s, b) => s + get(a, tr, b), 0))[0])}</span></td>${arms.map(a => {
    const tot = behs.reduce((s, b) => s + get(a, tr, b), 0);
    return behs.map(b => { const n = get(a, tr, b); const good = (tr === 'literal' && b === 'LITERAL_COMPLETED') || (tr === 'structure' && b === 'STRUCTURE') || (tr === 'none' && b === 'STOP_REPORT'); const bad = b === 'COLLISION' || (tr === 'none' && b === 'STRUCTURE') || (tr === 'literal' && b === 'STRUCTURE') || (tr === 'structure' && b === 'LITERAL_COMPLETED');
      return `<td class="c cf ${good ? 'good' : bad ? 'bad' : ''}" style="--p:${tot ? n / tot : 0}">${n ? fmt(n) : '·'}${n && tot ? `<span class="u">${(100 * n / tot).toFixed(0)}%</span>` : ''}</td>`; }).join(''); }).join('')}</tr>`).join('');
  return `<div class="tbl"><table class="t cft"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
function strataTable() {
  const arms = ['method_v6', 'literal_if_feasible', 'method_v4'];
  const sts = ['CLEAR', 'LITERAL_STRUCTURE_AMBIGUITY', 'STRUCTURE_STRUCTURE_AMBIGUITY'];
  const get = (st, a) => S.strata.find(r => r.stratum === st && r.scope === 'S10_MAIN_SYNTH' && r.arm === a);
  return `<div class="tbl"><table class="t"><thead><tr><th>${T('歧义分层', 'Ambiguity stratum')}</th><th>${T('题数', 'Cases')}</th>${arms.map(a => `<th>${esc(armName(a))}</th>`).join('')}</tr></thead><tbody>
   ${sts.map(st => { const r0 = get(st, 'method_v6'); return `<tr><td class="nm">${esc(STRATA[st][z() ? 'zh' : 'en'])}</td><td class="c">${fmt(r0 && r0.generated)}</td>${arms.map(a => { const r = get(st, a); return `<td class="c ${a === 'method_v6' ? 'me' : ''}"><b>${f3(r && r.mean_geometry_equal_score)}</b><span class="u">${r ? esc(ci(r.ci95)) : ''}</span></td>`; }).join('')}</tr>`; }).join('')}
   </tbody></table></div><div class="note src">${esc(S.sources.strata)}</div>`;
}
function diffTable() {
  const scopes = [['S10_MAIN_SYNTH', T('主集', 'Main set')], ['S10_SHIFT_K', T('偏移：候选数', 'Shift: candidates')], ['S10_SHIFT_ROUND', T('偏移：取整', 'Shift: rounding')], ['S10_SHIFT_PRIOR', T('偏移：意图先验', 'Shift: prior')],
    ['S10_CLUTTER', T('杂物走廊', 'Clutter')], ['S10_DIVERSITY_F1', T('大厅', 'Hall')], ['S10_DIVERSITY_F2', T('拐角', 'Corner')], ['S10_REAL', T('真实地图', 'Real maps')], ['S10_REAL/hospital', T('真实地图 · 医院', 'Real · hospital')], ['S10_REAL/office', T('真实地图 · 办公室', 'Real · office')]];
  const all = scopes.map(([sc, lab]) => { const d = S.diffs.find(x => x.scope === sc && x.left === 'method_v6' && x.right === 'literal_if_feasible'); return d && {sc, lab, d}; }).filter(Boolean);
  const lo = Math.min(...all.map(x => x.d.known_ci95[0]), 0) - .02, hi = Math.max(...all.map(x => x.d.known_ci95[1])) + .02;
  const X0 = v => (v - lo) / (hi - lo) * 100;
  return `<div class="tbl"><table class="t dft"><thead><tr><th>${T('子集', 'Subset')}</th><th>${T('v6 − 字面可行就照字面（平均得分差）', 'v6 − literal if feasible (mean-score difference)')}</th><th>${T('差值 [95% 区间]', 'Difference [95% CI]')}</th><th>${T('已知 / 全部配对', 'Known / all pairs')}</th></tr></thead><tbody>
  ${all.map(({sc, lab, d}) => `<tr class="${d.primary ? 'me' : ''}"><td class="nm">${esc(lab)}${d.primary ? `<span class="chip acc">${T('主比较', 'primary')}</span>` : ''}</td>
    <td class="plot"><div class="dplot"><i class="z" style="left:${X0(0)}%"></i><i class="ci" style="left:${X0(d.known_ci95[0])}%;width:${X0(d.known_ci95[1]) - X0(d.known_ci95[0])}%"></i><i class="pt" style="left:${X0(d.known_geometry_equal_difference)}%"></i></div></td>
    <td class="c"><b>${d.known_geometry_equal_difference >= 0 ? '+' : ''}${f3(d.known_geometry_equal_difference)}</b><span class="u">${esc(ci(d.known_ci95))}</span></td><td class="c">${fmt(d.known_pairs)} / ${fmt(d.generated_pairs)}</td></tr>`).join('')}
  </tbody></table></div><div class="note src">${esc(S.sources.diffs)}</div>`;
}

window.SLX.s10 = {load, loaded: id => !!loaded[id], setOfId, det, side, showTrue, dataHTML, bindData, confusionTable, strataTable, diffTable, board, badge, utilColor, behLabel, SETDEF, sets: Object.keys(SETDEF)};
if (window.SLX.rerender && !window.SLX._s10ready) { window.SLX._s10ready = 1; window.SLX.rerender(); }
})();
