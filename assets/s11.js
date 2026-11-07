/* S11 views (main method R13): categories built from the S11 cases, obstacle ("绕障") pairs, leaderboards, funnels, registered tests.
   Data: window.SL_S11 (data/s11/meta.js: B's summary tables copied), data/s11/cases/<key>.js (public inputs + per-slot scores of every case and arm),
   data/s11/traj/<chunk>.js (trajectories). Nothing is computed here except display formatting, one per-subset average of B's per-slot utility
   (named as such), and picking the home-page examples by the stated rule. Loaded after app.js, which exposes window.SLX. */
(function () {
'use strict';
const X = window.SLX, S = window.SL_S11;
if (!X || !S) return;
const {$, esc, fmt, ARMC} = X;
const z = () => document.documentElement.lang === 'zh-CN';
const T = (zh, en) => z() ? zh : en;
const pct = (v, d = 1) => v == null ? '—' : (100 * v).toFixed(d) + '%';
const pp = (v, d = 2) => v == null ? '—' : (v >= 0 ? '+' : '') + (100 * v).toFixed(d);
const f3 = v => v == null ? '—' : v.toFixed(3);
const armName = a => (X.armName ? X.armName(a) : a);
const ARMS = S.arms;
const rate = (scope, arm) => S.rates.find(r => r.scope === scope && r.arm === arm);
const utilColor = u10 => u10 == null ? 'var(--sand7)' : u10 >= 10 ? '#12A594' : u10 >= 3 ? '#F5AE73' : u10 === 0 ? 'var(--sand7)' : '#E5484D';
const utilText = u10 => u10 == null ? '?' : u10 >= 10 ? '+1' : u10 === 3 ? '+0.3' : u10 === 0 ? '0' : u10 <= -10 ? '−1' : (u10 / 10).toFixed(1);


/* ---------- loading ---------- */
const caseSets = {}, caseWait = {};
window.SL_S11_CASES = (k, o) => { caseSets[k] = o; (caseWait[k] || []).forEach(f => f(o)); delete caseWait[k]; };
function loadCases(k) { if (caseSets[k]) return Promise.resolve(caseSets[k]);
  return new Promise(res => { if (!caseWait[k]) { caseWait[k] = []; const sc = document.createElement('script'); sc.src = `data/s11/cases/${k}.js`; document.head.appendChild(sc); } caseWait[k].push(res); }); }
const trChunks = {}, trWait = {};
window.SL_S11_TRAJ = (k, o) => { trChunks[k] = o; (trWait[k] || []).forEach(f => f(o)); delete trWait[k]; };
function loadTraj(name) { if (trChunks[name]) return Promise.resolve(trChunks[name]);
  return new Promise(res => { if (!trWait[name]) { trWait[name] = []; const sc = document.createElement('script'); sc.src = `data/s11/traj/${name}.js`; sc.onerror = () => res({}); document.head.appendChild(sc); } trWait[name].push(res); }); }

/* ---------- the four categories ---------- */
const SETDEF = {Y1: ['main'], Y2: ['real'], Y3: ['clutter', 'hall', 'corner'], Y4: ['o1b', 'o1c', 'o3b', 'o3c', 'o4b', 'o4c']};
const SUBKEY = {clutter: 'smallObs', hall: 'hall', corner: 'corner'};
const toMap = c => { const w = c.w; return {b: w.b, r: w.r, o: w.o, s: w.s, c: [], img: w.scene || null}; };
const OUTCH = u => u == null ? '?' : u >= 10 ? '1' : u >= 3 ? 'r' : u === 0 ? 'z' : 'n';
const setOfId = id => /:O[134]:(BLOCK|CLEAR)$/.test(id) ? 'Y4' : /^S11_MAIN_SYNTH:/.test(id) ? 'Y1' : /^S11_REAL:/.test(id) ? 'Y2' : /^S11_(CLUTTER|DIVERSITY_F[12]):/.test(id) ? 'Y3' : null;
const loaded = {}, loading = {};
const oStr = c => X.ARMS.map(a => { const q = c.a[a]; return q ? OUTCH(q[1]) : ' '; }).join('');
function mkEntry(id, c, setId, g) {
  return {id, d: setId, g, bd: setId === 'Y2' ? g : undefined, k: c.k, tx: X.s10Text(c), u: c.u, m: toMap(c), o: oStr(c), sh: 'S11', ans: false, t: c.t ? 1 : 0, s10: 1, s11: 1, _c: c};
}
function load(setId) {
  if (loaded[setId]) return Promise.resolve();
  if (loading[setId]) return loading[setId];
  return loading[setId] = Promise.all(SETDEF[setId].map(key => loadCases(key).then(C => [key, C]))).then(all => {
    const byKey = Object.fromEntries(all);
    if (setId === 'Y4') {
      for (const bk of ['o1b', 'o3b', 'o4b']) {
        const ck = bk.replace('b', 'c');
        for (const id in byKey[bk]) {
          const c = byKey[bk][id], cid = id.replace(/:BLOCK$/, ':CLEAR'), cc = byKey[ck][cid];
          if (X.byId.has(id)) continue;
          const e = mkEntry(id, c, 'Y4', bk.slice(0, 2).toUpperCase());
          if (cc) { e._pair = mkEntry(cid, cc, 'Y4', e.g); e._pair.pairOf = e; X.byId.set(cid, e); }
          X.IDX.push(e); X.byId.set(id, e);
        }
      }
    } else for (const [key, C] of all) for (const id in C) {
      if (X.byId.has(id)) continue;
      const c = C[id];
      const e = mkEntry(id, c, setId, setId === 'Y2' ? (c.w.scene || '') : setId === 'Y3' ? SUBKEY[key] : '');
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
    const ent = chunk[c.tk || e.id] || {}, tr = ent.tr || {}, t0 = ent.t0 || {}, arms = {};
    for (const a in c.a) { const q = c.a[a]; if (!q) continue;
      arms[a] = {i: q[1] == null ? null : q[1] >= 10, l: null, c: null, na: false, rs: q[0], fs: q[6] || '', t: q[7], t0: t0[a] != null ? t0[a] : null, tr: tr[a] || null, s11: q}; }
    return e._det = {answers: {}, cand: null, arms, _tr: 1};
  });
}
/* outcome in plain words: [class, zh, en] */
function outcome(q, block) {
  if (!q) return ['no', '', ''];
  const w = S.why[q[4]] || '';
  if (q[1] == null) return ['un', '结局判不出', 'Outcome undecided'];
  if (q[1] >= 10) return ['ok', block ? '绕过并完成' : '完成', block ? 'Went around and completed' : 'Completed'];
  if (w === 'safe_report' || w === 'correct_report_absent_intent') return ['rep', '停下报告', 'Stopped and reported'];
  if (w === 'entered_wrong_structure') return ['bad', '进错门', 'Entered the wrong opening'];
  if (w === 'collision') return ['bad', '碰撞', 'Collision'];
  return ['no', '未完成', 'Not completed'];
}
const behLabel = q => { const o = outcome(q, false); return z() ? o[1] : o[2]; };
const badge = q => { const u = q && q[1]; return {c: utilColor(u), t: utilText(u), fg: u != null && u !== 0 ? '#fff' : 'var(--ink2)'}; };
const FAM = {O1: ['一个箱子（直走廊，必须换道绕过去）', 'One box (straight corridor; the vehicle has to change lane around it)'], O3: ['两个箱子错开（连续换两次道）', 'Two staggered boxes (two lane changes in a row)'],
  O4: ['走廊堵死（箱子占满通道，仿真车辆过不去）', 'Corridor blocked (the boxes fill the corridor; the simulated vehicle cannot pass)']};
const famOf = e => (e.g || /:O([134]):/.exec(e.id) && 'O' + /:O([134]):/.exec(e.id)[1] || '');

/* ---------- side panel of the case viewer ---------- */
function side(e, d, presets) {
  const c = e._c, p = e._pair, fam = famOf(e);
  const isPair = !!p || /:O[134]:/.test(e.id);
  const note = !isPair ? '' : fam === 'O4' ? T('本题设定：箱子占满通道（按本站的仿真车辆尺寸过不去），期望的做法是停下并报告。', 'Test design: the boxes fill the corridor (the simulated vehicle of this site cannot pass); the expected behaviour is to stop and report.')
    : T('有箱子的版本里路被挡住，需要换道绕过去；没有箱子的版本是同一题去掉箱子。“没箱子”的轨迹多数不是单独运行的，而是借用基础集里同一场景的记录。', 'With the box the way is blocked and the vehicle has to change lane around it; the no-box version is the same case without the box. Most “no box” trajectories were not run separately; they are the base-set record of the same scene.');
  const fl = f => f === '1' ? '✓' : f === '0' ? '✗' : '?';
  return `<div id="anspanel"></div>${isPair ? `<section class="card"><div class="card-h"><span class="tile">≡</span><h3>${T('这一题', 'This case')}</h3></div><dl class="kv">
    ${isPair ? `<dt>${T('类别', 'Kind')}</dt><dd>${esc(fam)} · ${esc(FAM[fam] ? FAM[fam][z() ? 0 : 1] : '')}</dd>` : ''}
    </dl>
    ${note ? `<p class="note" style="padding:0 16px 8px">${esc(note)}</p>` : ''}
    <div class="note src">${esc(S.sources.cases)}</div></section>` : ''}
  <section class="card"><div class="card-h"><span class="tile">≡</span><h3>${T('各方法做了什么', 'What each method did')}</h3><span class="more">${T('点一行显示 / 隐藏轨迹', 'click a row to show / hide')}</span></div>
    ${isPair ? `<div class="s10hd"><span></span><span></span><span>${T('有箱子', 'Box')}</span><span>${T('没箱子', 'No box')}</span></div>` : ''}
    <div class="presets"><span class="flab" style="align-self:center">${T('预设', 'Presets')}</span>${presets.filter(q => q[1].every(a => d.arms[a])).map((q, i) => `<button data-pre="${i}">${q[0]}</button>`).join('')}</div>
    ${ARMS.map(a => { const q = c.a[a]; if (!q) return ''; const on = X.state.on[a]; const o = outcome(q, isPair); const q2 = p && p._c.a[a]; const o2 = q2 ? outcome(q2, false) : null;
      const fun = isPair && /[01]/.test(q[5]) ? ` · ${T('到达箱子', 'reached')}${fl(q[5][0])} ${T('绕过', 'passed')}${fl(q[5][1])} ${T('回到原路线', 'rejoined')}${fl(q[5][2])}` : '';
      return `<button class="armrow s10row ${isPair ? 'pr' : ''} ${on ? '' : 'off'}" data-a="${a}" style="--c:${ARMC[a] || '#888'}"><span class="sq"></span><span class="nm">${esc(armName(a))}<code>${esc(z() ? o[1] : o[2])}${esc(fun)}</code></span>
        <span class="sc" style="background:${utilColor(q[1])};color:${q[1] != null && q[1] !== 0 ? '#fff' : 'var(--ink2)'}" title="${esc(z() ? o[1] : o[2])}">${utilText(q[1])}</span>${q2 ? `<span class="sc" style="background:${utilColor(q2[1])};color:${q2[1] != null && q2[1] !== 0 ? '#fff' : 'var(--ink2)'}" title="${esc(z() ? o2[1] : o2[2])}">${utilText(q2[1])}</span>` : (q[2] ? `<span class="sev" title="${T('严重错误', 'severe error')}">!</span>` : '<span></span>')}</button>`; }).join('')}
    <div class="note">${T('颜色：', 'Colour: ')}<span class="lg1" style="background:#12A594"></span>+1 ${T('完成', 'completed')} <span class="lg1" style="background:#F5AE73"></span>+0.3 ${T('安全地停下并报告', 'stopped safely and reported')} <span class="lg1" style="background:var(--sand7)"></span>0 ${T('没完成', 'not completed')} <span class="lg1" style="background:#E5484D"></span>−1 ${T('严重错误', 'severe error')}</div></section>`;
}

/* ---------- home page: three examples by a stated rule ---------- */
let featCache = null;
function featured() {
  if (featCache) return featCache;
  return featCache = load('Y4').then(() => {
    const ok = X.IDX.filter(e => e.s11 && e.d === 'Y4' && (e.g === 'O1' || e.g === 'O3') && e._c.t);
    ok.sort((p, q) => p.id < q.id ? -1 : p.id > q.id ? 1 : 0);
    return ok.slice(0, 3);
  });
}

/* ---------- leaderboards (overview) ---------- */
const SUB = [['S11_MAIN_SYNTH', '主集', 'Main set', 3000], ['S11_CLUTTER', '小障碍走廊', 'Small-obstacle corridors', 600], ['S11_DIVERSITY_F1', '大厅', 'Hall', 400], ['S11_DIVERSITY_F2', '拐角', 'Corner', 400],
  ['S11_REAL', '真实地图', 'Real maps', 2556], ['S11_OBS_O1_BLOCK', '绕障：一个箱子（O1，有箱子）', 'Detour: one box (O1, with box)', 549], ['S11_OBS_O3_BLOCK', '绕障：两个箱子错开（O3，有箱子）', 'Detour: two staggered boxes (O3, with box)', 474],
  ['S11_OBS_O4_BLOCK', '绕障：走廊堵死（O4，有箱子）', 'Detour: corridor blocked (O4, with box)', 2064]];
function board(scope, title) {
  const rows = ARMS.map(a => rate(scope, a)).filter(Boolean);
  if (!rows.length) return '';
  const o4 = /O4_BLOCK/.test(scope);
  const src = S.sources.rates;
  return `<article class="card s10b"><div class="card-h"><h3>${esc(title)}</h3><span class="more">${esc(scope)} · ${fmt(rows[0].n)} ${T('题', 'cases')}</span></div>
   <div class="tbl"><table class="t s10t"><thead><tr><th>${T('方法', 'Method')}</th><th>${T('完成率', 'Completion')}<span class="u">${T('分母：全部题', 'of all cases')}</span></th><th>${T('平均得分', 'Mean score')}<span class="u">${T('分母：判得出的题', 'of decided cases')}</span></th><th>${T('严重错误率', 'Severe error')}<span class="u">${T('分母：判得出的题', 'of decided cases')}</span></th><th>${o4 ? T('正确停下报告（越高越好）', 'Correctly stopped and reported (higher is better)') : T('该做却停下报告（越低越好）', 'Stopped to report although it could act (lower is better)')}</th></tr></thead><tbody>
   ${rows.map(r => `<tr class="${r.arm === 'method_R13' ? 'me' : ''}"><td class="nm"><span class="sw" style="background:${ARMC[r.arm] || 'var(--sand8)'}"></span>${esc(armName(r.arm))}</td>
     <td class="c"><b>${pct(r.confirmed_completed / r.n)}</b><span class="u">${fmt(r.confirmed_completed)} / ${fmt(r.n)}${r.completion_UNKNOWN ? ' · ' + T('判不出', 'undecided') + ' ' + fmt(r.completion_UNKNOWN) : ''}</span></td>
     <td class="c"><b>${f3(r.mean_utility)}</b><span class="u">${T('判得出', 'decided')} ${fmt(r.mean_utility_n)}</span></td>
     <td class="c"><b>${pct(r.severe / r.severe_known)}</b><span class="u">${fmt(r.severe)} / ${fmt(r.severe_known)}</span></td>
     <td class="c">${o4 ? `<b>${pct(r.safe_report / r.n)}</b><span class="u">${fmt(r.safe_report)} / ${fmt(r.n)}</span>` : `<b>${pct(r.intent_exists_report_rate)}</b><span class="u">${fmt(r.intent_exists_safe_report)} / ${fmt(r.intent_exists_n)}</span>`}</td></tr>`).join('')}
   </tbody></table></div><p class="note">${T('完成率 = 确认完成的题 ÷ 全部题（结局判不出的不算完成）。平均得分按单题得分求平均（+1 完成，+0.3 没完成但安全地停下并报告，0 没完成，−1 严重错误），受 +0.3 这个预设权重影响，不是成功率。严重错误 = 进错门或与障碍接触。“该做却停下报告”的分母是出题时设定为存在可达成目标的题。v16 的严重错误率低，是因为它几乎不做进门的动作，也不报告。', 'Completion = confirmed completed ÷ all cases (cases whose outcome is undecided do not count as completed). Mean score averages the per-case score (+1 completed, +0.3 not completed but stopped safely and reported, 0 not completed, −1 severe error) and is affected by the preset +0.3 weight; it is not a success rate. Severe error = entering the wrong opening or touching an obstacle. The denominator of “stopped to report although it could act” is the cases that were set up with a reachable target. v16’s severe-error rate is low because it hardly ever commits to an opening and never reports.')}</p><div class="note src">${esc(src)}</div><div class="note src">${T('平均得分 = B 的逐题评分文件里每条 utility（+1 / +0.3 / 0 / −1）的平均，不含未知；B 没有公布这个平均，页面构建时求出。', 'Mean score = average of the per-slot utility (+1 / +0.3 / 0 / −1) in B’s score files, unknown excluded; B does not publish this average, it is computed when the page is built.')} ${esc('B ' + S.b.slice(0, 11) + ' · research/s11_20261106/formal_scores/*_SCORES.jsonl')}</div></article>`;
}
let dataSub = null;
function boardsHTML() {
  const subs = SUB.map(s => ({scope: s[0], label: T(s[1], s[2]), n: s[3]}));
  const cur = subs.find(x => x.scope === dataSub) || null;
  const chips = `<nav class="atoc s10nav" id="s11chips"><a class="${!cur ? 'on' : ''}" data-s="">${T('全部子集', 'All subsets')}</a>${subs.map(x => `<a class="${cur && cur.scope === x.scope ? 'on' : ''}" data-s="${x.scope}">${esc(x.label)} <span class="n">${fmt(x.n)}</span></a>`).join('')}</nav>`;
  const one = x => x.scope === 'S11_REAL' ? board('S11_REAL', T('真实地图（合计）', 'Real maps (all)')) + board('S11_REAL/hospital', T('真实地图 · 医院', 'Real maps · hospital')) + board('S11_REAL/office', T('真实地图 · 办公室', 'Real maps · office')) : board(x.scope, x.label);
  return {chips, boards: (cur ? [cur] : subs).map(one).join('')};
}

/* ---------- registered tests ---------- */
function gatesTable() {
  const G = S.gates;
  const rows = [['primary', T('绕障主假设（95% 置信）', 'Obstacle primary hypothesis (95% confidence)'), 'completion'], ['MAIN_guardrail', T('主集完成率降幅不超过 1 个百分点（护栏，90% 置信）', 'Main-set completion drops by no more than 1 pp (guardrail, 90% confidence)'), 'completion'],
    ['REAL_guardrail', T('真实地图完成率降幅不超过 1 个百分点（护栏，90% 置信）', 'Real-map completion drops by no more than 1 pp (guardrail, 90% confidence)'), 'completion'], ['severe_guardrail', T('全部题严重错误率增幅不超过 1 个百分点（护栏，90% 置信）', 'Severe-error rate rises by no more than 1 pp over all cases (guardrail, 90% confidence)'), 'severe']];
  const ci = c => `[${(100 * c[0]).toFixed(2)}, ${(100 * c[1]).toFixed(2)}]`;
  const ok = v => v ? `<span class="chip ink">${T('达到', 'met')}</span>` : `<span class="chip dash">${T('没达到或判不了', 'not met or cannot be decided')}</span>`;
  return `<div class="tbl"><table class="t dft"><thead><tr><th rowspan="2">${T('登记检验', 'Registered test')}</th><th colspan="4">${T('只用两边都判得出的题', 'Only cases where both sides are decided')}</th><th colspan="2">${T('结局判不出的题按最不利方式算', 'Undecided cases counted in the least favourable way')}</th></tr>
    <tr><th>${T('判得出 / 总题数', 'Decided / all')}</th><th>${T('差（百分点）', 'Difference (pp)')}</th><th>${T('区间（百分点）', 'Interval (pp)')}</th><th>${T('判定', 'Verdict')}</th><th>${T('区间（百分点）', 'Interval (pp)')}</th><th>${T('判定', 'Verdict')}</th></tr></thead><tbody>
    ${rows.map(([k, lab, m]) => { const g = G[k]; const adv = m === 'severe' ? g.upper_completion_CI : g.lower_completion_CI;
      return `<tr><td class="nm">${esc(lab)}<span class="u">${T('门槛（百分点）', 'threshold (pp)')} ${pp(g.threshold, 0)}</span></td><td class="c">${fmt(g.known_pairs)} / ${fmt(g.n)}<span class="u">${T('判不出的题', 'undecided')} ${fmt(g.unknown_pairs)}</span></td>
        <td class="c"><b>${pp(g.known_pair_difference, 3)}</b></td><td class="c">${ci(g.known_pair_CI)}</td><td class="c">${ok(g.known_pair_pass)}</td><td class="c">${ci(adv)}</td><td class="c">${ok(g.adverse_completion_pass)}</td></tr>`; }).join('')}
    </tbody></table></div><p class="note">${T('这四项检查的门槛和判定规则由作者事先登记，数字由 B 评分后汇总；没有经过第三方审核。差 = R13 − 上一版 v6.11，单位是百分点；括号里的百分数是置信水平；前三条要求差高于门槛，最后一条（严重错误）要求差低于门槛。“只用两边都判得出的题”是登记的判定口径；“按最不利方式算”把判不出的题都按对 R13 最不利的情形补上，B 的登记里不用它做判定，这里照实并列：右半边有三条没达到。绕障主假设的对照方法上一版 v6.11 不会绕障，在这类题上完成数为 0 是预期的。', 'The thresholds and decision rules of these four checks were registered by the authors beforehand, and the numbers were scored and tabulated by B; they were not audited by a third party. Difference = R13 − previous version v6.11, in percentage points; the percentage in brackets is the confidence level; the first three require the difference to be above the threshold, the last one (severe errors) to be below it. “Only cases where both sides are decided” is the registered basis of the decision; “least favourable way” fills every undecided case in the way worst for R13. B does not use it for the decision, and it is shown side by side as it is: three of them are not met. The comparison method of the primary hypothesis, the previous version v6.11, cannot go around obstacles, so zero completions on those cases is expected.')}</p><div class="note src">${esc(S.sources.gates)}</div>`;
}
let fnSel = {fam: 'O1', cond: 'BLOCK', fwd: true};
function funnelHTML() {
  const rows = ARMS.map(a => S.funnels.find(r => r.family === fnSel.fam && r.condition === fnSel.cond && r.forward_obligation === fnSel.fwd && r.arm === a)).filter(Boolean);
  const cell = (p, k) => `<b>${fmt(p)}</b> / ${fmt(k)}`;
  const chip = (g, v, lab) => `<a class="${fnSel[g] === v ? 'on' : ''}" data-g="${g}" data-v="${v}">${lab}</a>`;
  const n = rows[0] ? rows[0].n : 0;
  return `<nav class="atoc s10nav" id="fnchips">${['O1', 'O3', 'O4'].map(f => chip('fam', f, T({O1: '一个箱子（O1）', O3: '两个箱子错开（O3）', O4: '走廊堵死（O4）'}[f], {O1: 'One box (O1)', O3: 'Two staggered boxes (O3)', O4: 'Corridor blocked (O4)'}[f]))).join('')}
    <span style="width:10px"></span>${chip('cond', 'BLOCK', T('有箱子', 'With box'))}${chip('cond', 'CLEAR', T('没箱子', 'No box'))}<span style="width:10px"></span>${chip('fwd', true, T('指令要求越过箱子位置的题', 'Instruction requires driving past the box position'))}${chip('fwd', false, T('指令不要求越过的题', 'Instruction does not require it'))}</nav>
    <div class="tbl" style="margin-top:12px"><table class="t s10t"><thead><tr><th>${T('方法', 'Method')} · ${fmt(n)} ${T('题', 'cases')}</th><th>${T('到达箱子位置', 'Reached the box position')}</th><th>${T('无接触地绕过', 'Passed without contact')}</th><th>${T('回到原路线', 'Back on the original path')}</th><th>${T('完成', 'Completed')}</th></tr></thead><tbody>
    ${rows.map(r => `<tr class="${r.arm === 'method_R13' ? 'me' : ''}"><td class="nm"><span class="sw" style="background:${ARMC[r.arm] || 'var(--sand8)'}"></span>${esc(armName(r.arm))}</td><td class="c">${cell(r.encounter_positive, r.encounter_known)}</td><td class="c">${cell(r.no_contact_pass_positive, r.no_contact_pass_known)}</td><td class="c">${cell(r.cumulative_return_positive, r.cumulative_return_known)}</td><td class="c">${cell(r.cumulative_complete_positive, r.cumulative_complete_known)}</td></tr>`).join('')}
    </tbody></table></div><p class="note">${T('“到达箱子位置”按几何位置判断（车的纵向位置到了箱子所在区间），不是方法自己看到箱子的记录（B：没有保存方法的障碍感知，标为 NOT_INCLUDED）。原任务的完成另算。', 'Reaching the box position is judged from geometry (the vehicle’s longitudinal position reached the box interval), not from a record of the method seeing the box (B: no stored obstacle-perception capture, marked NOT_INCLUDED). Completion of the original task is counted separately.')}</p><div class="note src">${esc(S.sources.funnels)}</div>`;
}
let tmScope = 'ALL_LOGICAL';
function timesHTML() {
  const scopes = [['ALL_LOGICAL', T('全部', 'All')], ['S11_MAIN_SYNTH', T('主集', 'Main set')], ['S11_REAL', T('真实地图', 'Real maps')], ['S11_CLUTTER', T('小障碍', 'Small obstacles')], ['S11_DIVERSITY_F1', T('大厅', 'Hall')], ['S11_DIVERSITY_F2', T('拐角', 'Corner')]];
  const pairs = [['literal_if_feasible', T('R13 对 字面优先', 'R13 vs literal-first')], ['method_v6', T('R13 对 上一版 v6.11', 'R13 vs previous version v6.11')]];
  const rows = [];
  for (const [r, lab] of pairs) for (const cls of ['literal', 'structure']) { const t = S.times.find(x => x.scope === tmScope && x.left === 'method_R13' && x.right === r && x.time_class === cls); if (t) rows.push([lab, cls, t]); }
  const s = v => v == null ? '—' : v.toFixed(2);
  return `<nav class="atoc s10nav" id="tmchips">${scopes.map(([k, l]) => `<a class="${tmScope === k ? 'on' : ''}" data-s="${k}">${l}</a>`).join('')}</nav>
    <div class="tbl" style="margin-top:12px"><table class="t s10t"><thead><tr><th>${T('比较', 'Comparison')}</th><th>${T('类型', 'Type')}</th><th>${T('可比较的题数', 'Cases compared')}</th><th>R13 ${T('中位 / p90（秒）', 'median / p90 (s)')}</th><th>${T('对照 中位 / p90（秒）', 'other median / p90 (s)')}</th><th>${T('用时比（R13 ÷ 对照，中位）', 'Time ratio (R13 ÷ other, median)')}</th></tr></thead><tbody>
    ${rows.map(([lab, cls, t]) => `<tr><td class="nm">${esc(lab)}</td><td class="c">${cls === 'literal' ? T('照字面', 'Following the words') : T('进某个门', 'Entering an opening')}</td><td class="c">${fmt(t.eligible_pairs)}</td><td class="c">${s(t.left_median_s)} / ${s(t.left_p90_s)}</td><td class="c">${s(t.right_median_s)} / ${s(t.right_p90_s)}</td><td class="c"><b>${s(t.paired_ratio_median)}</b></td></tr>`).join('')}
    </tbody></table></div><p class="note">${T('只比较两种方法在同一题上都确认完成、且做的是同一种事（照字面，或进某个门）的题；用时是仿真里的时间（从收到指令到结束），不是真实时钟；表里是中位数和第 90 百分位。这样比较不能抵消完成率或安全上的差别，早早报告或失败也不算更快。', 'Only cases where both sides confirmed-completed the same kind of intent (literal or structure) are compared; times are simulation time from receiving the command, not wall-clock. Such conditional comparisons cannot offset differences in completion or safety, and an early report or failure is not a speed-up.')}</p><div class="note src">${esc(S.sources.times)}</div>`;
}
function diffHTML() {
  const scopes = SUB.map(s => [s[0], T(s[1], s[2])]);
  scopes.splice(5, 0, ['S11_REAL/hospital', T('真实地图 · 医院', 'Real · hospital')], ['S11_REAL/office', T('真实地图 · 办公室', 'Real · office')]);
  const all = scopes.map(([sc, lab]) => { const d = S.paired.find(x => x.scope === sc && x.left === 'method_R13' && x.right === 'literal_if_feasible' && x.metric === 'completion'); return d && {sc, lab, d}; }).filter(Boolean);
  const lo = Math.min(...all.map(x => x.d.known_pair_CI[0]), 0) - .03, hi = Math.max(...all.map(x => x.d.known_pair_CI[1])) + .03;
  const X0 = v => (v - lo) / (hi - lo) * 100;
  return `<div class="tbl"><table class="t dft"><thead><tr><th>${T('子集', 'Subset')}</th><th>${T('R13 − 字面优先（完成率之差）', 'R13 − literal-first (difference in completion rate)')}</th><th>${T('差值（百分点） [95% 区间]', 'Difference (pp) [95% CI]')}</th><th>${T('判得出 / 全部配对', 'Decided / all pairs')}</th></tr></thead><tbody>
  ${all.map(({sc, lab, d}) => `<tr><td class="nm">${esc(lab)}</td>
    <td class="plot"><div class="dplot"><i class="z" style="left:${X0(0)}%"></i><i class="ci" style="left:${X0(d.known_pair_CI[0])}%;width:${X0(d.known_pair_CI[1]) - X0(d.known_pair_CI[0])}%"></i><i class="pt" style="left:${X0(d.known_pair_difference)}%"></i></div></td>
    <td class="c"><b>${pp(d.known_pair_difference)}</b><span class="u">[${pp(d.known_pair_CI[0])}, ${pp(d.known_pair_CI[1])}]</span></td><td class="c">${fmt(d.known_pairs)} / ${fmt(d.n)}</td></tr>`).join('')}
  </tbody></table></div><p class="note">${T('同一题配对的完成率之差，线段是 95% 区间，竖线是 0；区间含 0 说明现有样本分不出差别（没有做显著性检验）。这些差值是描述性的，不是登记检验。', 'Paired completion-rate differences; the segment is the 95% interval and the vertical line is 0. An interval that contains 0 means the sample cannot tell the two apart (no significance test was run). These are descriptive, not registered tests.')}</p><div class="note src">${esc(S.sources.paired)}</div>`;
}

/* paper tables (B, CP-B-N): where R13's severe errors are, and box minus no-box */
const SCN = {S11_MAIN_SYNTH: ['主集', 'Main set'], S11_CLUTTER: ['小障碍', 'Small obstacles'], S11_DIVERSITY_F1: ['大厅', 'Hall'], S11_DIVERSITY_F2: ['拐角', 'Corner'], S11_REAL: ['真实地图', 'Real maps'],
  S11_OBS_O1_BLOCK: ['一个箱子 · 有箱子', 'One box · with box'], S11_OBS_O1_CLEAR: ['一个箱子 · 没箱子', 'One box · no box'], S11_OBS_O3_BLOCK: ['两个箱子错开 · 有箱子', 'Two staggered boxes · with box'], S11_OBS_O3_CLEAR: ['两个箱子错开 · 没箱子', 'Two staggered boxes · no box'],
  S11_OBS_O4_BLOCK: ['走廊堵死 · 有箱子', 'Corridor blocked · with box'], S11_OBS_O4_CLEAR: ['走廊堵死 · 没箱子', 'Corridor blocked · no box']};
function severeHTML() {
  const rows = S.paper.severe;
  return `<div class="tbl"><table class="t s10t"><thead><tr><th>${T('子集', 'Subset')}</th><th>${T('题数', 'Cases')}</th><th>${T('上一版 v6.11 严重错误', 'Previous version v6.11, severe')}</th><th>R13 ${T('严重错误', 'severe')}</th><th>${T('差', 'Difference')}</th><th>R13 ${T('其中进错门', 'of which wrong opening')}</th><th>R13 ${T('其中与障碍接触', 'of which touching an obstacle')}</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="nm">${esc((SCN[r.scope] || [r.scope, r.scope])[z() ? 0 : 1])}</td><td class="c">${fmt(r.n)}</td><td class="c">${fmt(r.v611_severe)}<span class="u">${T('判得出', 'decided')} ${fmt(r.v611_known)}</span></td><td class="c"><b>${fmt(r.R13_severe)}</b><span class="u">${T('判得出', 'decided')} ${fmt(r.R13_known)}</span></td><td class="c">${r.delta > 0 ? '+' : ''}${r.delta}</td><td class="c">${fmt(r.R13_wrong_structure)}</td><td class="c">${fmt(r.R13_contact)}</td></tr>`).join('')}
    </tbody></table></div><p class="note">${T('各项只覆盖记录采样，不是连续无接触的证明。R13 的严重错误在每个子集里都是进错结构，接触为 0；在有箱子的“一个箱子”“两个箱子错开”里，R13 有 43 / 36 例，上一版 v6.11 是 0（B 的报告）。', 'The counts only cover the recorded samples and do not prove continuous no-contact. In every subset R13’s severe errors are entries into the wrong opening with 0 contacts; with a box, in the one-box and two-staggered-box sets R13 has 43 / 36 and the previous version v6.11 has 0 (B’s report).')}</p><div class="note src">${esc(S.sources.paper)}</div>`;
}
function blockClearHTML() {
  const rows = S.paper.blockclear, nm = {O1: T('一个箱子（O1）', 'One box (O1)'), O3: T('两个箱子错开（O3）', 'Two staggered boxes (O3)'), O4: T('走廊堵死（O4）', 'Corridor blocked (O4)')};
  return `<div class="tbl"><table class="t s10t"><thead><tr><th>${T('类别', 'Kind')}</th><th>${T('指标', 'Metric')}</th><th>${T('已知 / 总配对', 'Known / all pairs')}</th><th>${T('有箱子 − 没箱子 R13（百分点）', 'With box − no box, R13 (pp)')}</th><th>${T('95% 区间', '95% CI')}</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="nm">${esc(nm[r.family] || r.family)}</td><td class="c">${r.metric === 'completion' ? T('完成', 'Completion') : T('严重错误', 'Severe error')}</td><td class="c">${fmt(r.known_pairs)} / ${fmt(r.total_pairs)}</td><td class="c"><b>${pp(r.difference)}</b></td><td class="c">[${pp(r.CI95_low)}, ${pp(r.CI95_high)}]</td></tr>`).join('')}
    </tbody></table></div><p class="note">${T('同一题的两个版本配对。O4 有箱子时完全堵死，所以完成率大幅下降是预期的（正确做法是停下报告）。', 'The two versions of the same case are paired. With the box O4 is blocked completely, so a large drop in completion is expected (the right behaviour is to stop and report).')}</p><div class="note src">${esc(S.sources.paper)}</div>`;
}

function coverageHTML() {
  const C = S.coverage; if (!C) return '';
  const en = {S11_MAIN_SYNTH: 'Main set', S11_CLUTTER: 'Small obstacles', S11_DIVERSITY_F1: 'Hall', S11_DIVERSITY_F2: 'Corner', S11_REAL: 'Real maps', S11_OBS_O1_BLOCK: 'Detour, one box · with box', S11_OBS_O1_CLEAR: 'Detour, one box · no box',
    S11_OBS_O3_BLOCK: 'Detour, two staggered boxes · with box', S11_OBS_O3_CLEAR: 'Detour, two staggered boxes · no box', S11_OBS_O4_BLOCK: 'Detour, blocked corridor · with box', S11_OBS_O4_CLEAR: 'Detour, blocked corridor · no box'};
  return `<div class="tbl"><table class="t s10t"><thead><tr><th>${T('子集', 'Subset')}</th><th>${T('题数', 'Cases')}</th><th>${T('应有的轨迹（题 × 8 个方法）', 'Expected (cases × 8 methods)')}</th><th>${T('页面里有的', 'In the page')}</th><th>${T('其中借用基础集记录', 'of which borrowed from the base set')}</th><th>${T('缺', 'Missing')}</th></tr></thead><tbody>
    ${C.rows.map(r => `<tr><td class="nm">${esc(z() ? r.zh : en[r.dataset])}</td><td class="c">${fmt(r.cases)}</td><td class="c">${fmt(r.expected)}</td><td class="c"><b>${fmt(r.have)}</b></td><td class="c">${fmt(r.shared)}</td><td class="c">${fmt(r.missing)}</td></tr>`).join('')}
    <tr><td class="nm"><b>${T('合计', 'Total')}</b></td><td class="c">${fmt(C.rows.reduce((a, r) => a + r.cases, 0))}</td><td class="c">${fmt(C.expected)}</td><td class="c"><b>${fmt(C.have)}</b></td><td class="c">${fmt(C.rows.reduce((a, r) => a + r.shared, 0))}</td><td class="c">${fmt(C.expected - C.have)}</td></tr>
    </tbody></table></div><p class="note">${T('“没箱子”的版本大多没有单独运行，用的是基础集里同一场景的记录（B 称“同源引用”），B 的登记是 105,040 个逻辑槽、82,896 次实际运行。', 'Most “no box” versions were not run separately; they use the record of the same scene in the base set (B calls this a same-source reference). B registers 105,040 logical slots and 82,896 actual runs.')}</p>`;
}

/* ---------- ranking board: methods ranked on every test set ---------- */
const RK = {metric: 'mean', all: false};
const RK_SCOPES = [['ALL_LOGICAL', '全部题', 'All cases'], ['S11_MAIN_SYNTH', '主集', 'Main set'], ['S11_CLUTTER', '小障碍', 'Small obstacles'], ['S11_DIVERSITY_F1', '大厅', 'Hall'], ['S11_DIVERSITY_F2', '拐角', 'Corner'],
  ['S11_REAL', '真实地图', 'Real maps'], ['S11_OBS_O1_BLOCK', '一个箱子', 'One box'], ['S11_OBS_O3_BLOCK', '两个箱子错开', 'Two staggered boxes'], ['S11_OBS_O4_BLOCK', '走廊堵死', 'Corridor blocked']];
const RK_CORE = ['method_R13', 'literal_if_feasible', 'nearest', 'v16', 'method_v6'];
const rkVal = (r, m) => !r ? null : m === 'mean' ? r.mean_utility : m === 'comp' ? r.confirmed_completed / r.n : r.severe / r.severe_known;
const rkFmt = (v, m) => v == null ? '—' : m === 'mean' ? v.toFixed(3) : (100 * v).toFixed(1) + '%';
function rankHTML(compact) {
  const m = RK.metric, low = m === 'sev', arms = (RK.all ? ARMS : RK_CORE);
  const rank = {};
  for (const [sc] of RK_SCOPES) {
    const vals = arms.map(a => [a, rkVal(rate(sc, a), m)]).filter(x => x[1] != null).sort((p, q) => low ? p[1] - q[1] : q[1] - p[1]);
    const same = vals.length && vals.every(x => Math.abs(x[1] - vals[0][1]) < 1e-9);
    vals.forEach(([a, v], i) => { rank[sc + a] = same ? 0 : 1 + vals.findIndex(x => Math.abs(x[1] - v) < 1e-9); });
  }
  const order = arms.slice().sort((p, q) => (rank['ALL_LOGICAL' + p] || 99) - (rank['ALL_LOGICAL' + q] || 99));
  const mt = [['mean', T('平均得分', 'Mean score')], ['comp', T('完成率', 'Completion rate')], ['sev', T('严重错误率（越低越好）', 'Severe-error rate (lower is better)')]];
  const scopes = compact ? RK_SCOPES.slice(0, 1).concat(RK_SCOPES.slice(1)) : RK_SCOPES;
  return `<div class="rkbar"><nav class="atoc s10nav rkm">${mt.map(([k, l]) => `<a class="${RK.metric === k ? 'on' : ''}" data-m="${k}">${l}</a>`).join('')}</nav>
    <label class="rkall"><input type="checkbox" class="rkchk" ${RK.all ? 'checked' : ''}> ${T('显示全部 8 个方法（含新执行器变体）', 'Show all 8 methods (including the new-executor variants)')}</label></div>
    <div class="tbl"><table class="t s10t rkt"><thead><tr><th>${T('方法', 'Method')}</th>${scopes.map(([k, zh, en], i) => `<th class="${i === 0 ? 'all' : ''}">${T(zh, en)}</th>`).join('')}</tr></thead><tbody>
    ${order.map(a => `<tr class="${a === 'method_R13' ? 'me' : ''}"><td class="nm"><span class="sw" style="background:${ARMC[a] || 'var(--sand8)'}"></span>${esc(armName(a))}</td>
      ${scopes.map(([sc], i) => { const r = rate(sc, a), v = rkVal(r, m), k = rank[sc + a]; return `<td class="c ${i === 0 ? 'all' : ''}"><b>${rkFmt(v, m)}</b><span class="rk r${k}">${k ? T('第 ' + k, '#' + k) : ''}</span></td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>
    <p class="note">${T('每一列是在这个测试集上给上面的方法按所选指标排名（并列同名次）。平均得分 = 单题得分（+1 完成，+0.3 没完成但安全地停下并报告，0 没完成，−1 严重错误）的平均，受 +0.3 权重影响，不是成功率；完成率 = 确认完成的题 ÷ 全部题；排名只是这几个指标上的名次，不是统计显著性。“全部题”含有箱子和没箱子两种版本。走廊堵死的题期望做法是停下报告，所以那一列的完成率不是目标。', 'Each column ranks the methods above on the chosen metric for that test set (ties share a rank). Mean score = average of the per-case score (+1 completed, +0.3 not completed but stopped safely and reported, 0 not completed, −1 severe error), affected by the +0.3 weight and not a success rate; completion rate = confirmed completed ÷ all cases; ranks are positions on these metrics, not statistical significance. “All cases” includes the with-box and no-box versions. In the corridor-blocked cases the expected behaviour is to stop and report, so completion is not the goal in that column.')}</p>
    <div class="note src">${esc(S.sources.rates)}</div>`;
}
function mountRank(host) {
  if (!host) return;
  const draw = () => { host.innerHTML = rankHTML(); host.querySelectorAll('.rkm a').forEach(a => a.onclick = () => { RK.metric = a.dataset.m; draw(); }); const c = host.querySelector('.rkchk'); if (c) c.onchange = () => { RK.all = c.checked; draw(); }; };
  draw();
}
function dataHTML() {
  const b = boardsHTML(), P = S.primary_arms.find(x => x.arm === 'method_R13'), PV = S.primary_arms.find(x => x.arm === 'method_v6'), PL = S.primary_arms.find(x => x.arm === 'literal_if_feasible'), PN = S.primary_arms.find(x => x.arm === 'nearest'), PV16 = S.primary_arms.find(x => x.arm === 'v16');
  const mr = rate('S11_MAIN_SYNTH', 'method_R13'), mv = rate('S11_MAIN_SYNTH', 'method_v6'), ml = rate('S11_MAIN_SYNTH', 'literal_if_feasible'), rr = rate('S11_REAL', 'method_R13'), rv = rate('S11_REAL', 'method_v6'), rl = rate('S11_REAL', 'literal_if_feasible');
  const hero = (lab, a, b2, c, d) => `<div><b>${a}</b><span>${lab}</span></div>`;
  return `<section class="s10data" id="s11data"><div class="eyebrow" style="margin-top:34px"><span class="dot"></span>${T('主方法 R13 的测试结果', 'Results of the main method R13')} · B ${esc(S.b.slice(0, 11))}</div>
    <p class="lede" style="margin:6px 0 12px">${T('R13 是本项目提出的方法的当前版本（内部第 13 轮）。它在“照指令字面走”和“进某个门”之间选一个；路被箱子挡住时会换道绕过去，绕不过去才停下报告。下面是它在各测试集上和另外七个方法的对照；测试集称 S11，B 是负责独立评分的一方。全部是仿真，指令由程序生成。', 'R13 is the current version (internal iteration 13) of the method proposed in this project. It chooses between following the words of the instruction and entering an opening; when a box blocks the way it changes lane around it, and only when it cannot get around does it stop and report. Below it is compared with seven other methods on every test set (called S11; B is the party that scores independently). Everything is simulated, and commands are program-generated.')}</p>
    <p class="note" style="margin:0 0 10px">${T('几个数量的口径：测试题 13,130 道（绕障的“有箱子”“没箱子”各算一题）；题 × 8 个方法 = 105,040 个结果；其中 82,896 次是实际运行，其余 22,144 个是“没箱子”借用基础集同一场景的记录。“必须绕过箱子的 922 题”是一个箱子、两个箱子错开里指令要求越过箱子位置的题（492 + 430）；“3,087”是绕障类别里有箱子的题数（549 + 474 + 2,064）。本页的表比较 8 个方法，分析页比较其中的一部分。', 'What the counts mean: 13,130 test cases (the with-box and no-box versions of a detour case count separately); cases × 8 methods = 105,040 results, of which 82,896 are actual runs and the other 22,144 are no-box results that reuse the record of the same base-set scene. “The 922 cases that require a detour” are those in the one-box and two-staggered-box sets whose instruction requires passing the box position (492 + 430); “3,087” is the number of with-box cases in the detour category (549 + 474 + 2,064). The tables on this page compare 8 methods; the analysis page compares some of them.')}</p>
    <h3 class="s10h3" style="margin-top:8px">${T('排行榜：各方法在每个测试集上的名次', 'Leaderboard: rank of every method on every test set')}</h3><div id="rankov" class="card" style="padding:14px 16px"></div>
    <div class="agrid s10grid"><article class="card s10hero"><div class="card-h"><h3>${T('完成的题数', 'Completed cases')}</h3><span class="more">${T('确认完成 / 登记题数', 'confirmed / registered')}</span></div>
      <div class="big2"><div><b>${fmt(P.confirmed_completed)}</b><span>${T('必须绕过箱子的 922 题：本方法 R13 完成', 'The 922 cases that require a detour: completed by R13')}</span></div><div><b>${fmt(PL.confirmed_completed)}</b><span>${T('同上，字面优先', 'same, literal-first')}</span></div>
      <div><b>${fmt(PN.confirmed_completed)}</b><span>${T('同上，最近的门', 'same, nearest opening')}</span></div><div><b>${fmt(PV16.confirmed_completed)}</b><span>${T('同上，v16（原有系统）', 'same, v16 (original system)')}</span></div></div>
      <div class="big2" style="margin-top:12px"><div><b>${fmt(mr.confirmed_completed)}</b><span>${T('主集 3,000 题：R13 完成', 'Main set (3,000): R13 completed')}</span></div><div><b>${fmt(ml.confirmed_completed)}</b><span>${T('主集：字面优先', 'Main set: literal-first')}</span></div><div><b>${fmt(rr.confirmed_completed)}</b><span>${T('真实地图 2,556 题：R13 完成', 'Real maps (2,556): R13 completed')}</span></div><div><b>${fmt(rl.confirmed_completed)}</b><span>${T('真实地图：字面优先', 'Real maps: literal-first')}</span></div></div>
      <p class="note" style="margin:8px 16px 0">${T('R13 的上一版 v6.11 不会绕障：必须绕障的题完成 ' + fmt(PV.confirmed_completed) + '，主集 ' + fmt(mv.confirmed_completed) + '，真实地图 ' + fmt(rv.confirmed_completed) + '。更多对照见下面各表。', 'R13’s previous version v6.11 cannot go around obstacles: ' + fmt(PV.confirmed_completed) + ' completions on the detour cases, ' + fmt(mv.confirmed_completed) + ' on the main set, ' + fmt(rv.confirmed_completed) + ' on the real maps. More comparisons are in the tables below.')}</p>
      <div class="note src">${esc(S.sources.primary)} · ${esc(S.sources.rates)}</div></article></div>
    <h3 class="s10h3">${T('每个测试集的成绩', 'Scores per test set')}</h3>${b.chips}<div class="agrid s10grid s11grid" style="margin-top:14px">${b.boards}</div></section>
    <section class="s10data" style="margin-top:34px"><h3 class="s10h3">${T('绕障逐步达成（漏斗）', 'Obstacle detour, step by step (funnel)')}</h3><p class="note" style="margin:0 0 6px">${T('到达箱子的位置 → 无接触地绕过 → 回到原路线 → 完成，八个方法。每一格是“满足的题数 / 判得出的题数”，后一步要先满足前一步。', 'Reached the box position → passed it without contact → back on the original path → completed, eight methods. Each cell is “satisfied / decided”, and each step needs the one before it.')}</p><div id="fnbox">${funnelHTML()}</div></section>
    <section class="s10data" style="margin-top:34px"><h3 class="s10h3">${T('作者自定的四项检查（登记检验）', 'Four author-defined checks (registered tests)')}</h3>${gatesTable()}</section>
    <section class="s10data" style="margin-top:34px"><h3 class="s10h3">${T('R13 的严重错误出在哪里', 'Where R13’s severe errors are')}</h3>${severeHTML()}</section>
    <section class="s10data" style="margin-top:34px"><h3 class="s10h3">${T('有箱子 − 没箱子（R13）', 'With box − no box (R13)')}</h3>${blockClearHTML()}</section>
    <section class="s10data" style="margin-top:34px"><h3 class="s10h3">${T('同一题上的用时对比', 'Time on the same case')}</h3><div id="tmbox">${timesHTML()}</div></section>
    <section class="s10data" style="margin-top:34px"><h3 class="s10h3">${T('各子集：R13 − 字面优先', 'Per subset: R13 − literal-first')}</h3>${diffHTML()}</section>
    <section class="s10data" style="margin-top:34px"><h3 class="s10h3">${T('轨迹覆盖', 'Trajectory coverage')}</h3>${coverageHTML()}</section>`;
}
function bindData(root) {
  mountRank(root.querySelector('#rankov'));
  const nav = root.querySelector('#s11chips');
  const redo = () => { const host = root.querySelector('#s11data'); const tmp = document.createElement('div'); tmp.innerHTML = dataHTML(); const nw = tmp.querySelector('#s11data'); host.replaceWith(nw);
    const rest = [...root.querySelectorAll('.s10data')].filter(x => x.id !== 's11data'); };
  const rebindBoards = () => { const n = root.querySelector('#s11chips'); if (!n) return; n.querySelectorAll('a').forEach(a => a.onclick = () => { dataSub = a.dataset.s || null; const b = boardsHTML(); const host = n.parentElement; n.outerHTML = b.chips; host.querySelector('.agrid.s10grid:last-of-type').innerHTML = b.boards; rebindBoards(); }); };
  rebindBoards();
  const fn = root.querySelector('#fnbox'); const bindFn = () => fn && fn.querySelectorAll('#fnchips a').forEach(a => a.onclick = () => { const v = a.dataset.v; fnSel[a.dataset.g] = v === 'true' ? true : v === 'false' ? false : v; fn.innerHTML = funnelHTML(); bindFn(); }); bindFn();
  const tm = root.querySelector('#tmbox'); const bindTm = () => tm && tm.querySelectorAll('#tmchips a').forEach(a => a.onclick = () => { tmScope = a.dataset.s; tm.innerHTML = timesHTML(); bindTm(); }); bindTm();
}

window.SLX.s11 = {mountRank, load, loaded: id => !!loaded[id], setOfId, det, side, badge, behLabel, outcome, featured, dataHTML, bindData, SETDEF, sets: Object.keys(SETDEF), famOf, FAM};
if (window.SLX.rerender && !window.SLX._s11ready) { window.SLX._s11ready = 1; window.SLX.rerender(); }
})();
