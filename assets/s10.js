/* S10 views (main method v6): leaderboards per subset, confusion table, stratified scores, per-subset differences, per-case page.
   Data: window.SL_S10 (data/s10/meta.js, B's own tables copied), data/s10/cases/<key>.js (per-slot public fields),
   data/s10/traj/<key>__<n>.js (sampled trajectories). Nothing is computed here except display formatting;
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

/* ---------- S10 front page (#s10) ---------- */
function renderS10(sub) {
  X.topbar(`<a href="#s10">S10</a>`);
  const subs = SUB.map(s => ({key: s[0], ds: s[1], label: T(s[2], s[3]), n: s[4]}));
  const cur = subs.find(x => x.key === sub) || null;
  const mainR = rate('S10_MAIN_SYNTH', 'method_v6'), litR = rate('S10_MAIN_SYNTH', 'literal_if_feasible');
  const chips = `<nav class="atoc s10nav"><a class="${!cur ? 'on' : ''}" href="#s10">${T('全部子集', 'All subsets')}</a>${subs.map(x => `<a class="${cur && cur.key === x.key ? 'on' : ''}" href="#s10/${x.key}">${esc(x.label)} <span class="n">${fmt(x.n)}</span></a>`).join('')}</nav>`;
  const boards = (cur ? [cur] : subs).map(x => {
    if (x.key === 'real') return board('S10_REAL', T('真实地图（合计）', 'Real maps (all)')) + REAL_SPLIT.map(([sc, zh, en]) => board(sc, T('真实地图 · ' + zh, 'Real maps · ' + en))).join('');
    return board(x.ds, x.label);
  }).join('');
  $('#page').innerHTML = `<section class="shead"><div class="sh-l"><div class="eyebrow"><span class="dot"></span>S10 · ${T('主实验', 'Main experiment')} · B ${esc(S.b.slice(0, 9))}</div>
    <h1 class="h">S10${cur ? `<span class="hsub">${esc(cur.label)}</span>` : ''}</h1>
    <p class="lede">${T('每条指令都有真实意图：照字面、进某个结构，或这个结构根本不存在。主方法 v6 在字面和各结构之间按期望得分选一个，只在没有可执行动作也没有安全观测时才报告。', 'Every instruction has a true intent: the literal reading, a structure, or none exists. The main method v6 picks among the literal reading and the structures by expected score, and reports only when there is neither an executable action nor a safe observation.')}</p>
    <div class="stats"><span><b>${fmt(S.generated_inputs)}</b>${T('题', 'cases')}</span><span><b>${fmt(S.scored_slots)}</b>${T('槽（题 × 方法）已评分', 'scored slots')}</span><span class="chip ink">${T('已评分', 'scored')}</span></div>
    ${chips}</div></section>
   <div class="agrid s10grid" style="margin-top:20px">${!cur ? `<article class="card s10hero"><div class="card-h"><h3>${T('主集上的主比较', 'Primary comparison on the main set')}</h3></div>
      <div class="big2"><div><b>${f3(mainR.mean_geometry_equal_score)}</b><span>v6 ${T('平均得分', 'mean score')}</span></div><div><b>${f3(litR.mean_geometry_equal_score)}</b><span>${T('字面可行就照字面', 'literal if feasible')}</span></div>
      <div><b>${pct(mainR.intent_completion_all_generated)}</b><span>v6 ${T('完成率', 'completion')}</span></div><div><b>${pct(mainR.strict_rate_identifiable)}</b><span>v6 ${T('与参考一致', 'reference match')}</span></div></div>
      <p class="note">${T('每题分数：完成真实意图 +1，安全报告 +0.3，没有完成 0，严重错误 −1。差值见概览页。', 'Per-case score: true intent completed +1, safe report +0.3, not completed 0, severe error −1. Differences are on the Overview page.')}</p>
      <div class="note src">${esc(S.sources.rates)}</div></article>` : ''}${boards}</div>
   <p class="afootnote">${T('全部是仿真（CPU 闭环），不是实车；指令和回答由程序生成，不是真人。真实意图、候选、参考的三种做法期望得分是 B 的私有字段，尚未导出，页面上显示“未导出”。', 'All simulation (CPU closed loop), not a physical robot; instructions and answers are program-generated, not human. True intent, candidates and the reference expected scores are B-private fields that are not exported yet, so the page shows “not exported”.')}</p>`;
  // case list for the chosen subset
  if (cur) listCases(cur);
}

/* ---------- case cards of one subset ---------- */
let sFilter = {kind: 'all', arm: 'method_v6', out: 'all'};
function listCases(cur) {
  const host = document.createElement('section'); host.className = 's10cases'; $('#page').insertBefore(host, $('.afootnote'));
  loadCases(cur.key).then(C => {
    const ids = Object.keys(C); const kinds = [...new Set(ids.map(i => C[i].k))].sort();
    const draw = () => {
      const list = ids.filter(i => (sFilter.kind === 'all' || C[i].k === sFilter.kind) && (sFilter.out === 'all' || (() => { const a = C[i].a[sFilter.arm]; const u = a && a[1]; return sFilter.out === 'pos' ? u != null && u > 0 : sFilter.out === 'zero' ? u === 0 : sFilter.out === 'neg' ? u != null && u < 0 : u == null; })()));
      const shown = list.slice(0, state48.n);
      host.innerHTML = `<div class="fbar s10f"><div class="frow"><span class="flab">${T('类型', 'Kind')}</span><div class="kchips">${['all', ...kinds].map(k => `<button class="kc ${sFilter.kind === k ? 'on' : ''}" data-k="${k}">${k === 'all' ? T('全部', 'All') : `<span class="k">${KN[k] || k}</span>${k}`}</button>`).join('')}</div></div>
        <div class="frow"><span class="flab">${T('方法', 'Method')}</span><select class="pick" id="s10arm">${ORDER.map(a => `<option value="${a}" ${a === sFilter.arm ? 'selected' : ''}>${esc(armName(a))}</option>`).join('')}</select>
        <select class="pick" id="s10out"><option value="all">${T('全部得分', 'All scores')}</option><option value="pos" ${sFilter.out === 'pos' ? 'selected' : ''}>+1 / +0.3</option><option value="zero" ${sFilter.out === 'zero' ? 'selected' : ''}>0</option><option value="neg" ${sFilter.out === 'neg' ? 'selected' : ''}>−1</option><option value="unk" ${sFilter.out === 'unk' ? 'selected' : ''}>${T('未知', 'Unknown')}</option></select>
        <span class="fmeta">${T('显示', 'Showing')} <b>${shown.length}</b> / ${fmt(list.length)}</span></div></div>
        <div class="grid s10cards">${shown.map(id => s10Card(id, C[id])).join('')}</div>
        ${list.length > shown.length ? `<div class="more-row"><button class="btn" id="s10more">${T('再加载', 'Load more')} · ${Math.min(48, list.length - shown.length)}</button></div>` : ''}`;
      host.querySelectorAll('.kc').forEach(b => b.onclick = () => { sFilter.kind = b.dataset.k; state48.n = 48; draw(); });
      const sa = host.querySelector('#s10arm'); sa.onchange = () => { sFilter.arm = sa.value; draw(); };
      const so = host.querySelector('#s10out'); so.onchange = () => { sFilter.out = so.value; state48.n = 48; draw(); };
      const mb = host.querySelector('#s10more'); if (mb) mb.onclick = () => { state48.n += 48; draw(); };
      host.querySelectorAll('canvas[data-id]').forEach(cv => paintCard(cv, C[cv.dataset.id]));
    };
    draw();
  });
}
const state48 = {n: 48};
function s10Card(id, c) {
  const a = c.a[sFilter.arm]; const u = a && a[1];
  const instr = X.s10Text(c);
  return `<a class="card cc s10c" href="#s10case/${encodeURIComponent(id)}"><div class="hd"><span class="tile">${KN[c.k] || c.k}</span><span class="kn">${esc(id.split(':').slice(1).join(' · '))}</span>
    <span class="chips"><span class="ob" style="background:${utilColor(u)};color:${u != null && u !== 0 ? '#fff' : 'var(--ink2)'}">${utilText(u)}</span></span></div>
    <h4>${esc(instr)}</h4><div class="media"><canvas data-id="${esc(id)}"></canvas></div>
    <div class="ft"><span class="id">${a ? esc((BEHAV[a[0]] || {})[z() ? 'zh' : 'en'] || a[0]) : '—'}</span><span class="strip">${ORDER.map(k => { const q = c.a[k]; return `<span style="--c:${ARMC[k] || '#888'};${q && q[1] != null ? `background:${utilColor(q[1])};border-color:${utilColor(q[1])}` : ''}" title="${esc(armName(k))}: ${q ? utilText(q[1]) : '—'}"></span>`; }).join('')}</span></div></a>`;
}
function paintCard(cv, c) { drawMap(cv, {m: toMap(c), k: c.k, u: c.u}, null, {small: true, pad: .45, arms: []}); }
function toMap(c) { const w = c.w; return {b: w.b, r: w.r, o: w.o, s: w.s, c: [], img: w.scene || null}; }

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

/* ---------- per-case page (#s10case/<id>) ---------- */
const PICK = 'sl.s10pick';
function readPicks() { try { return JSON.parse(localStorage.getItem(PICK) || '{}'); } catch (e) { return {}; } }
function writePick(id, v) { try { const p = readPicks(); p[id] = v; localStorage.setItem(PICK, JSON.stringify(p)); } catch (e) { /* storage unavailable: pick lives in memory only */ } }
const memPick = {};
const decName = d => d == null ? '—' : d === 'LITERAL' ? T('照字面', 'literal') : d === 'REPORT' ? T('报告', 'report') : T('结构 ', 'structure ') + d;
const NOEXP = () => `<span class="nexp">${T('未导出', 'not exported')}</span>`;
function renderS10Case(id) {
  X.topbar(`<a href="#s10">S10</a><i>/</i><b>${esc(id.split(':').slice(0, 1))}</b>`);
  const ds = id.split(':')[0]; const key = keyOfDs(ds);
  if (!key) { location.hash = 's10'; return; }
  $('#page').innerHTML = `<p class="note">…</p>`;
  loadCases(key).then(async C => {
    const c = C[id]; if (!c) { location.hash = 's10'; return; }
    let tr = {};
    if (c.t && c.ch) { const chunks = await loadTraj(c.ch); tr = chunks[id] || {}; }
    mount(id, c, tr);
  });
}
function mount(id, c, tr) {
  state48.show = false;
  const instr = X.s10Text(c);
  const lit = c.lit ? `${c.lit[0]}` : null;
  const refd = (c.a.method_v6 && c.a.method_v6[6]) || (c.a.literal_if_feasible && c.a.literal_if_feasible[6]) || null;
  const refLabel = refd == null ? T('参考未知', 'reference unknown') : refd === 'LITERAL' ? T('照字面', 'follow the literal reading') : refd === 'REPORT' ? T('报告', 'report') : T('进入结构 ', 'enter structure ') + refd;
  const litCat = {EXACT: T('有见证（原参数）', 'witness exists (exact parameters)'), WITHIN_1M: T('有见证（纵向偏移 ≤1 m）', 'witness exists (≤1 m longitudinal offset)'), INFEASIBLE: T('该运动族内无见证', 'no witness in the motion family'), UNDEFINED: T('未定义', 'undefined')};
  const picks = readPicks(); const mine = picks[id] || memPick[id] || null;
  const choose = [['literal', T('照字面', 'Follow the literal'), '#6E56CF'], ['structure', T('进入某个结构', 'Enter a structure'), '#12A594'], ['report', T('报告 / 停下', 'Report / stop'), '#CC4E00']];
  $('#page').innerHTML = `<div class="dhead"><a class="btn" href="#s10/${keyOfDs(id.split(':')[0])}" style="justify-self:start;height:32px;font-size:12.5px">← ${T('返回', 'Back')}</a>
    <div class="eyebrow"><span class="dot"></span>${KN[c.k] || c.k} · ${esc(id)}</div>
    <div class="dict"><span class="mic idle"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="2.5" width="6" height="10" rx="3"/><path d="M4 10a6 6 0 0 0 12 0M10 16v2"/></svg></span><h1>${esc(instr)}</h1></div></div>
    <div class="dgrid"><div style="min-width:0"><section class="card stagecard"><div class="stools"><button class="sw2 ${state48.show ? 'on' : ''}" id="s10show"><i></i>${T('显示真实意图', 'Show true intent')}</button>
      ${Object.keys(tr).length ? ORDER.filter(a => tr[a]).map(a => `<button class="sw2 on s10tog" data-a="${a}"><i></i>${esc(armName(a))}</button>`).join('') : `<span class="note" style="padding:0">${T('这一题没有收录轨迹（只抽样收录）', 'No trajectory for this case (sampled)')}</span>`}</div>
      <div class="stage"><canvas id="s10cv" style="height:${Math.round(Math.min(520, Math.max(300, innerWidth * .4)))}px"></canvas></div></section>
      <section class="card" style="margin-top:14px"><div class="card-h"><span class="tile">?</span><h3>${T('你认为该怎么做？', 'What do you think it should do?')}</h3><span class="more">${T('只存在你的浏览器里', 'stored only in your browser')}</span></div>
        <div class="picks">${choose.map(([k, l, col]) => `<button class="pk ${mine === k ? 'on' : ''}" data-k="${k}" style="--c:${col}">${esc(l)}</button>`).join('')}</div><div id="s10reveal" class="note"></div></section></div>
      <aside class="side"><section class="card"><div class="card-h"><span class="tile">≡</span><h3>${T('这一题', 'This case')}</h3></div><dl class="kv">
        <dt>${T('字面可行性（有限运动族的静态见证）', 'Literal feasibility (static witness in a finite motion family)')}</dt><dd>${lit ? `${esc(litCat[lit] || lit)}${c.lit[1] !== c.lit[0] ? ` <span class="u">(${T('规划车体：', 'planning body: ')}${esc(litCat[c.lit[1]] || c.lit[1])})</span>` : ''}` : NOEXP()}</dd>
        <dt>${T('参考的决策', 'Reference decision')}</dt><dd>${esc(refLabel)}</dd>
        <dt>${T('三种做法的期望得分', 'Expected score of the three options')}</dt><dd>${NOEXP()}</dd>
        <dt>${T('候选结构', 'Candidates')}</dt><dd>${NOEXP()}</dd>
        <dt>${T('真实意图', 'True intent')}</dt><dd id="s10true">${NOEXP()}</dd></dl>
        <div class="note src">${esc(S.sources.cases)}</div></section>
      <section class="card"><div class="card-h"><span class="tile">≡</span><h3>${T('各方法做了什么', 'What each method did')}</h3><span class="more">B · SCORES_V3</span></div>
        ${ORDER.map(a => { const q = c.a[a]; if (!q) return ''; return `<div class="armrow s10row" style="--c:${ARMC[a] || '#888'}"><span class="sq"></span><span class="nm">${esc(armName(a))}<code>${esc((BEHAV[q[0]] || {})[z() ? 'zh' : 'en'] || q[0])}${q[3] && q[3].length ? ' · ' + T('进入 ', 'entered ') + esc(q[3].join(', ')) : ''}${q[5] ? ' · ' + T('决策：', 'decided: ') + esc(decName(q[5])) : ''}</code></span>
          <span class="sc" style="background:${utilColor(q[1])};color:${q[1] != null && q[1] !== 0 ? '#fff' : 'var(--ink2)'}">${utilText(q[1])}</span>${q[2] ? `<span class="sev" title="${T('严重错误', 'severe error')}">!</span>` : ''}</div>`; }).join('')}
        <div class="note">${T('颜色：', 'Colour: ')}<span class="lg1" style="background:#12A594"></span>+1 <span class="lg1" style="background:#F5AE73"></span>+0.3 <span class="lg1" style="background:var(--sand7)"></span>0 <span class="lg1" style="background:#E5484D"></span>−1</div></section></aside></div>`;
  // map with trajectories
  const cv = $('#s10cv'); const on = {}; ORDER.forEach(a => on[a] = a === 'method_v6' || a === 'literal_if_feasible');
  const decoded = {}; for (const a in tr) decoded[a] = X.trajDecode(tr[a]);
  const paint = () => { const det = {arms: {}}; for (const a in decoded) if (on[a]) det.arms[a] = {tr: tr[a]}; drawMap(cv, {m: toMap(c), k: c.k, u: c.u}, det, {arms: Object.keys(det.arms), pad: .25, cand: false}); };
  paint();
  $('#page').querySelectorAll('.s10tog').forEach(b => b.onclick = () => { on[b.dataset.a] = !on[b.dataset.a]; b.classList.toggle('on', on[b.dataset.a]); paint(); });
  // "show true intent": B has not exported it; the switch says so instead of guessing
  $('#s10show').onclick = () => { state48.show = !state48.show; $('#s10show').classList.toggle('on', state48.show);
    $('#s10true').innerHTML = state48.show ? `${NOEXP()} <span class="u">${T('B 的私有字段；导出后这里显示字面 / 结构 / 不存在', 'B-private field; once exported this shows literal / structure / none')}</span>` : NOEXP(); };
  // "what do you think": the choice is stored locally; the reveal shows the public reference decision only
  const reveal = () => { const m = readPicks()[id] || memPick[id]; const el = $('#s10reveal'); if (!m) { el.textContent = ''; return; }
    const refk = refd == null ? null : refd === 'LITERAL' ? 'literal' : refd === 'REPORT' ? 'report' : 'structure';
    el.innerHTML = `${T('你选的：', 'You chose: ')}<b>${esc((choose.find(x => x[0] === m) || [])[1])}</b> · ${T('参考的决策：', 'reference decision: ')}<b>${esc(refLabel)}</b>${refk ? (refk === m ? ` · ${T('一致', 'same')}` : ` · ${T('不同', 'different')}`) : ''}
      <br><span class="u">${T('真实意图未导出，所以这里只和参考的决策比较，不判对错。', 'The true intent is not exported, so this only compares with the reference decision and does not grade you.')}</span>`; };
  $('#page').querySelectorAll('.pk').forEach(b => b.onclick = () => { memPick[id] = b.dataset.k; writePick(id, b.dataset.k); $('#page').querySelectorAll('.pk').forEach(x => x.classList.toggle('on', x === b)); reveal(); });
  reveal();
}

window.SLX.s10 = {renderS10, renderS10Case, confusionTable, strataTable, diffTable, board};
if (/^#s10/.test(location.hash)) window.SLX.rerender();
})();
