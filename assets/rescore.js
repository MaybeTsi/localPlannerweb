/* Rescoring by the actual turn point (B, research/physical_rescore_20261108): a small mark next to the method label wherever the old and new score differ,
   the tolerance band and the real turn points on the map, the footnote for the overview and the plain-language page (#rescore).
   Data: data/rescore/<dataset>.js and summary.js, built by tools/build_rescore.py from B's PHYSICAL_PER_CASE.csv / TABLE2_PAIRED.csv / COMPUTATION_CHECKS.json. */
(function () {
'use strict';
const X = window.SLX;
if (!X) return;
const {$, esc, fmt} = X;
const z = () => document.documentElement.lang === 'zh-CN';
const T = (zh, en) => z() ? zh : en;
const f1 = v => v == null ? '—' : (+v).toFixed(1), f2 = v => v == null ? '—' : (+v).toFixed(2);

/* ---------- loading ---------- */
const store = {}, waits = {}; let SUM = null, sumWait = null;
window.SL_RESCORE = (ds, o) => { store[ds] = o; (waits[ds] || []).forEach(f => f(o)); delete waits[ds]; };
window.SL_RESCORE_SUMMARY = o => { SUM = o; (sumWait || []).forEach(f => f(o)); sumWait = null; };
const script = (src, fail) => { const s = document.createElement('script'); s.src = src; s.onerror = fail; document.head.appendChild(s); };
const load = ds => store[ds] ? Promise.resolve(store[ds]) : new Promise(res => { if (!waits[ds]) { waits[ds] = []; script(`data/rescore/${ds}.js`, () => window.SL_RESCORE(ds, {})); } waits[ds].push(res); });
const summary = () => SUM ? Promise.resolve(SUM) : new Promise(res => { if (!sumWait) { sumWait = []; script('data/rescore/summary.js', () => window.SL_RESCORE_SUMMARY({})); } sumWait.push(res); });

/* ---------- explanations ---------- */
const sgn = v => v == null ? T('未判定', 'unknown') : v === 1 ? '+1' : v === -1 ? '−1' : v === 0 ? '0' : f1(v);
const verdict = q => q[1] === 1 ? T('完成', 'completed') : q[1] == null ? T('未判定', 'undecided') : T('未完成', 'not completed');
function why(rec, q) {
  const [old, nw, , , ta, ok, er] = q, lo = rec.d - rec.t, hi = rec.d + rec.t, parts = [];
  if (ta != null && ok[3]) {
    const off = ta - rec.d;
    parts.push(T(`口述 ${f1(rec.d)} m，容差 ±${f2(rec.t)} m（${f2(lo)}–${f2(hi)} m）；实际转弯点离出发点 ${f2(ta)} m`, `Spoken ${f1(rec.d)} m, tolerance ±${f2(rec.t)} m (${f2(lo)}–${f2(hi)} m); the vehicle actually turned at ${f2(ta)} m from the start`)
      + (ok[0] ? T('，在容差内。', ', within the tolerance.') : T(`，${off > 0 ? '晚' : '早'}了 ${f2(Math.abs(off))} m，超出容差。`, `, ${f2(Math.abs(off))} m ${off > 0 ? 'late' : 'early'}, outside the tolerance.`)));
  } else parts.push(T(`口述 ${f1(rec.d)} m，容差 ±${f2(rec.t)} m；没有检测到持续的转弯。`, `Spoken ${f1(rec.d)} m, tolerance ±${f2(rec.t)} m; no sustained turn was found.`));
  if (er === 1) parts.push(T('终点整车在字面对应的门内。', 'The end point has the whole vehicle inside the opening the literal reading leads to.'));
  else if (er === 2) parts.push(T('终点不在字面对应的区域内。', 'The end point is not in the region the literal reading leads to.'));
  else if (er === 3) parts.push(T('没有可用的字面区域，判不出。', 'There is no usable literal region, so it cannot be decided.'));
  else if (ok[2] === 0) parts.push(T('终点不满足要求。', 'The end point does not meet the requirement.'));
  parts.push(T(`旧分 ${sgn(old)}，按实际落点判为：${verdict(q)}${nw != null ? '（' + sgn(nw) + '）' : ''}。`, `Old score ${sgn(old)}; judged by the actual landing point: ${verdict(q)}${nw != null ? ' (' + sgn(nw) + ')' : ''}.`));
  return parts.join(' ');
}

/* ---------- marks beside the method labels ---------- */
function mark(rec) {
  document.querySelectorAll('#side .armrow[data-a]').forEach(b => {
    b.querySelectorAll('.rsm').forEach(n => n.remove());
    const q = rec.a[b.dataset.a]; if (!q || q[0] === q[1]) return;
    const nm = b.querySelector('.nm'); if (!nm) return;
    nm.insertAdjacentHTML('beforeend', `<em class="rsm ${q[1] === 1 ? 'ok' : q[1] == null ? 'un' : 'no'}" title="${esc(why(rec, q))}">${T('按实际落点：', 'By actual landing: ')}${verdict(q)}</em>`);
  });
}

/* ---------- map overlay: tolerance band around the spoken distance and the real turn points ---------- */
function overlay(rec, e) {
  return (g, F, o) => {
    const [ox, oy, yaw] = rec.o, h = [Math.cos(yaw), Math.sin(yaw)], n = [-h[1], h[0]], P = (s, w) => [F.X(ox + s * h[0] + w * n[0]), F.Y(oy + s * h[1] + w * n[1])], W = 3.2, lo = rec.d - rec.t, hi = rec.d + rec.t;
    g.save();
    const poly = [P(lo, -W), P(hi, -W), P(hi, W), P(lo, W)]; g.beginPath(); poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    g.fillStyle = 'rgba(255,106,31,.10)'; g.fill(); g.strokeStyle = 'rgba(255,106,31,.45)'; g.lineWidth = 1; g.setLineDash([4, 3]); g.stroke();
    const a = P(rec.d, -W), b = P(rec.d, W); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = 'rgba(214,80,10,.9)'; g.lineWidth = 1.6; g.setLineDash([]); g.stroke();
    g.fillStyle = 'rgba(214,80,10,.95)'; g.font = '600 11px ui-sans-serif,system-ui,sans-serif'; g.fillText(T(`口述 ${f1(rec.d)} m ± ${f2(rec.t)}`, `spoken ${f1(rec.d)} m ± ${f2(rec.t)}`), Math.min(a[0], b[0]) + 4, Math.max(a[1], b[1]) + 14);
    const arms = (o && o.arms && o.arms.length ? o.arms : Object.keys(rec.a)).filter(x => rec.a[x] && rec.a[x][2] != null && (X.dev || X.pubArms.includes(x)) && (!o || o.arms || X.state.on[x]));
    const col = X.ARMC;
    arms.forEach((x, i) => { const q = rec.a[x], px = F.X(q[2]), py = F.Y(q[3]); const bad = q[5][0] === 0;
      g.beginPath(); g.arc(px, py, 6, 0, 7); g.fillStyle = col[x] || '#555'; g.fill(); g.lineWidth = 2; g.strokeStyle = bad ? '#E5484D' : '#fff'; g.stroke();
      g.fillStyle = col[x] || '#555'; g.font = '700 10.5px ui-monospace,Menlo,monospace'; g.fillText(f1(q[4]) + ' m', px + 9, py - 8 - (i % 3) * 11); });
    g.restore(); };
}

function mount(e, hooks) {
  const ds = e.id.split(':')[0];
  if (e.m._overs) e.m._overs.rescore = null;
  load(ds).then(all => { const rec = all[e.id]; if (!rec || !$('#side')) return;
    mark(rec);
    e.m._overs = e.m._overs || {}; e.m._overs.rescore = overlay(rec, e); hooks && hooks.paint && hooks.paint();
    const note = `<p class="note rsnote">${T('这一题的部分方法按实际落点重判了：旧标签保留，旁边的小标记是重判结果；地图上浅色带是口述距离的容差，圆点是各方法实际转弯的位置。', 'Some methods in this case were re-judged by where they actually turned: the old label is kept, the small mark beside it is the re-judged result; the pale band on the map is the tolerance around the spoken distance and the dots are where each method actually turned.')} <a href="#rescore">${T('说明', 'Explanation')}</a></p>`;
    if (!document.querySelector('.rsnote')) { const card = [...document.querySelectorAll('#side .card')].find(c => c.querySelector('.armrow')); card && card.insertAdjacentHTML('beforeend', note); } });
}

/* ---------- overview footnote ---------- */
const footnote = () => `<p class="note rsfoot">${T('距离转弯题的部分记录按实际落点重判后结论不变，详见', 'For some records of the distance-then-turn cases, re-judging by where the vehicle actually turned leaves the conclusions unchanged; see the ')}<a href="#rescore">${T('说明', 'explanation')}</a>${T('。正式数字没有改动。', '. The official numbers are unchanged.')}</p>`;

/* ---------- plain-language page ---------- */
function page() {
  X.topbar(`<a href="#home">${T('总览', 'Summary')}</a><i>/</i><b>${T('按实际落点重判', 'Re-judged by actual landing')}</b>`);
  $('#page').innerHTML = '<p class="note" style="padding:40px 0">…</p>';
  summary().then(S => {
    if (!S || !S.checks) { $('#page').innerHTML = `<p class="note" style="padding:40px 0">${T('数据没有加载。', 'Data not loaded.')}</p>`; return; }
    const c = S.checks, tr = S.transitions, P = S.paired, pick = (scope, l, r, pop) => P.find(x => x.scope === scope && x.l === l && x.r === r && x.pop === pop);
    const whole = P.filter(x => x.pop === 'WHOLE_PARENT_SET'), dist = P.filter(x => x.pop === 'DISTANCE_01_06');
    const flipW = whole.filter(x => x.flip).length, flipD = dist.filter(x => x.flip);
    const lab = a => ({method_R13: T('本方法', 'our method'), v16: T('系统基线', 'system baseline'), literal_if_feasible: T('字面优先', 'literal-first'), method_v6: T('上一版 v6.11', 'previous version v6.11')})[a] || a;
    const ci = x => `${x.nd >= 0 ? '+' : ''}${x.nd.toFixed(4)} [${x.nc[0].toFixed(4)}, ${x.nc[1].toFixed(4)}]`, ci0 = x => `${x.od >= 0 ? '+' : ''}${x.od.toFixed(4)} [${x.oc[0].toFixed(4)}, ${x.oc[1].toFixed(4)}]`;
    const mainRows = [['method_R13', 'v16'], ['method_R13', 'literal_if_feasible'], ['method_R13', 'method_v6']].map(([l, r]) => pick('S11_MAIN_SYNTH', l, r, 'WHOLE_PARENT_SET')).filter(Boolean);
    const clut = pick('S11_CLUTTER', 'method_R13', 'method_v6', 'WHOLE_PARENT_SET');
    const flipTxt = flipD.map(x => T(`${x.scope === 'S11_CLUTTER' ? '小障碍走廊' : '大厅'}里 ${lab(x.l)} 对 ${lab(x.r)}`, `${x.scope} ${lab(x.l)} vs ${lab(x.r)}`)).join(T('；', '; '));
    $('#page').innerHTML = `<section class="shead"><div class="sh-l"><div class="eyebrow"><span class="dot"></span>${T('仿真回放 · 事后复查', 'Simulation replay · post-hoc check')}</div><h1 class="h">${T('距离转弯题：按实际落点重判', 'Distance-then-turn cases: re-judged by actual landing')}</h1>
      <p class="lede">${T('“前进 X 米后左转 / 右转”这类题，评分器原来是一段一段检查的。事后又按小车实际在哪儿转弯、最后停在哪儿重新判了一遍。结论：整体比较没有变号，正式数字也没有改。', 'For “go X metres then turn left / right” cases the scorer originally checked the route piece by piece. Afterwards the same cases were judged again by where the vehicle actually turned and where it stopped. Result: no overall comparison changes sign, and the official numbers are unchanged.')}</p></div></section>
    <article class="card rspage"><div class="card-h"><span class="tile">1</span><h3>${T('为什么要重判', 'Why re-judge')}</h3></div><div class="rsbody">
      <p>${T('旧评分器按段检查。一段“前进 5 米”只看这一段开头的净进度大概是不是 5 米；转弯那一段只看起止的朝向变没变 90°。所以小车晚转了好几米，中间多开的那一段没有被单独卡住，仍可能记成“完成”。', 'The old scorer checks segment by segment. A “go 5 metres” segment only compares the net progress at its start with 5 m, and the turn segment only checks that the heading changed by 90°. So a vehicle that turns several metres late can still be marked completed, because the extra driving in between is not checked on its own.')}</p>
      <p>${T('反过来，有的方法在字面对应的位置就进了门，但决策被标成“进门”，旧评分器把它算成进错门，其实它正好停在字面要求的地方。', 'The other way round, a method may go into the opening exactly where the literal reading leads, but its decision is labelled “enter the opening”, and the old scorer counted it as the wrong opening although it stopped exactly where the words ask.')}</p>
      <p>${T('两个例子：', 'Two examples: ')}<a href="#case/S11_MAIN_SYNTH:01:0018">S11_MAIN_SYNTH:01:0018</a>${T('（“前进 5 米左转”：本方法 10.4 m 才转，旧分仍是完成；按实际落点未完成）', ' (“go 5 m and turn left”: our method turns only at 10.4 m, the old score still says completed; by actual landing it did not complete)')}、<a href="#case/S10_MAIN_SYNTH:06:0035">S10_MAIN_SYNTH:06:0035</a>${T('（上一版开到 11.7 m 才转并进了 C 门，旧分完成；在字面落点进 A 门的几个方法反而被记进错门）', ' (the previous version turned at 11.7 m and went into opening C, the old score says completed; several methods that went into opening A at the literal landing point were marked as the wrong opening)')}。</p></div></article>
    <article class="card rspage"><div class="card-h"><span class="tile">2</span><h3>${T('怎么重判的', 'How it was re-judged')}</h3></div><div class="rsbody">
      <p>${T('只看真正的“照字面”那类意图（指向某个门的、该停下的题，旧分数原样保留）。取小车实际转弯的位置：朝向第一次转过 45° 并保持一小会儿的点。转弯点离出发点的距离，要落在口述距离的容差内（口述距离的 25%，至少 1 m）；方向要对、没有接触、最后停稳。“转弯再前进”这一类还要求终点在字面对应的位置。', 'Only cases whose real intent is the literal reading are re-judged (cases pointing at an opening or that should stop keep their old scores). The actual turn is where the heading first passes 45° and stays there for a moment. Its distance from the start must lie within a tolerance of the spoken distance (25% of it, at least 1 m); the direction must be right, there must be no contact, and the vehicle must come to rest. The “turn then go on” kind also needs the end point at the place the literal reading leads to.')}</p>
      <p>${T('这是对已有记录的重新计算，没有新的仿真。规则在看轨迹结果之前就已登记。', 'This is a recomputation on existing records; nothing was re-simulated. The rule was registered before the trajectory results were looked at.')}</p></div></article>
    <article class="card rspage"><div class="card-h"><span class="tile">3</span><h3>${T('哪些记录的分数变了', 'Which records changed')}</h3></div><div class="rsbody">
      <p>${T(`共检查 ${fmt(c.audited_cases)} 题、${fmt(c.audited_arm_records)} 条正式记录；新旧分数不同的有 ${fmt(c.changed_score_rows)} 条。两类错判：`, `${fmt(c.audited_cases)} cases and ${fmt(c.audited_arm_records)} official records were checked; ${fmt(c.changed_score_rows)} records have a different score. Two kinds of mismatch:`)}</p>
      <ul><li>${T(`A 类 ${c.A} 条：旧分记完成，实际没照字面走到；`, `Type A, ${c.A} records: the old score says completed, but the vehicle did not actually follow the words;`)}</li><li>${T(`B 类 ${c.B} 条：实际走到了字面落点，旧分记进错。`, `Type B, ${c.B} records: the vehicle did reach the literal landing point, but the old score says wrong opening.`)}</li></ul>
      <p>${T(`变化的方向：${fmt(tr['-1>1'] || 0)} 条从 −1 变 +1；${fmt(tr['U>1'] || 0)} 条从“未判定”变 +1；${fmt(tr['1>0'] || 0)} 条从 +1 变 0；${fmt(tr['1>-1'] || 0)} 条从 +1 变 −1；其余是少数从“未判定”判清为 0 / −1，或 0 变 +1。A、B 按记录计，不是独立题数。`, `Directions: ${fmt(tr['-1>1'] || 0)} records went from −1 to +1; ${fmt(tr['U>1'] || 0)} from “unknown” to +1; ${fmt(tr['1>0'] || 0)} from +1 to 0; ${fmt(tr['1>-1'] || 0)} from +1 to −1; the rest are a few “unknown” records that became 0 or −1, or 0 that became +1. A and B count records, not independent cases.`)}</p>
      <p>${T('这些记录在逐题页里方法名旁有“按实际落点：完成 / 未完成”的小标记，鼠标放上去能看到转弯点离口述距离多远。', 'On the case pages these records carry a small “By actual landing: completed / not completed” mark beside the method name; hover to see how far the turn point is from the spoken distance.')}</p></div></article>
    <article class="card rspage"><div class="card-h"><span class="tile">4</span><h3>${T('对比较结果的影响', 'Effect on the comparisons')}</h3></div><div class="rsbody">
      <p>${T(`复查把新旧分数都能判定的同一批题配对比较，共 ${whole.length} 个整集合比较，${flipW ? flipW + ' 个变号' : '没有一个变号'}。主集上本方法与各对照的得分差（单位是得分，不是完成率百分点；括号是 95% 区间）：`, `The check paired the same cases that both the old and new scores can judge: ${whole.length} whole-set comparisons, ${flipW ? flipW + ' changed sign' : 'none changed sign'}. Score differences on the main set (the unit is score, not percentage points; brackets are 95% intervals):`)}</p>
      <div class="tblwrap"><table class="s10t"><thead><tr><th>${T('比较', 'Comparison')}</th><th>${T('旧', 'Old')}</th><th>${T('按实际落点', 'By actual landing')}</th></tr></thead><tbody>${mainRows.map(x => `<tr><td class="nm">${esc(lab(x.l))} − ${esc(lab(x.r))}</td><td>${esc(ci0(x))}</td><td>${esc(ci(x))}</td></tr>`).join('')}</tbody></table></div>
      <p>${T('本方法与上一版的差别原本就含 0，重判后仍含 0。', 'The difference between our method and the previous version already included 0, and still does.')}${clut ? T(` 一处要说明：小障碍走廊里本方法对上一版，区间从不含 0（${ci0(clut)}）变成含 0（${ci(clut)}）——这一项不能再说有差别。`, ` One thing to disclose: in the small-obstacle corridors our method against the previous version moves from an interval that excludes 0 (${ci0(clut)}) to one that includes 0 (${ci(clut)}); this item can no longer be called a difference.`) : ''}</p>
      <p>${T(`只看距离转弯这一子集时，有 ${flipD.length} 处点估计变号${flipTxt ? '（' + flipTxt + '）' : ''}；这两处新旧区间都含 0，不能推广成整个测试集的结论。`, `Looking at the distance-then-turn subset alone, ${flipD.length} point estimates change sign${flipTxt ? ' (' + flipTxt + ')' : ''}; in both the old and the new interval include 0, so this must not be generalised to the whole test set.`)}</p></div></article>
    <article class="card rspage"><div class="card-h"><span class="tile">5</span><h3>${T('要注意的地方', 'Caveats')}</h3></div><div class="rsbody"><ul>
      <li>${T('总览页和排行榜上的正式数字没有任何改动；这是事后的敏感性复查。', 'The official numbers on the summary page and leaderboards are unchanged; this is a post-hoc sensitivity check.')}</li>
      <li>${T('“转过 45°”衡量的是转向这个事件，不单独证明转满了 90°。', '“Passing 45°” measures the turning event; it does not by itself prove a full 90° turn.')}</li>
      <li>${T('拐角集（F2）里环境自带的转角和字面指令有一点解释上的边界，这里保持最初的字面方向，没有按结果改定义。', 'In the corner set (F2) the corner of the environment and the literal instruction leave some room for interpretation; the original literal direction is kept and the definition was not changed to fit the outcome.')}</li>
      <li>${T('所有数据来自仿真，指令由程序生成，不是真人实验，也不是实车。', 'All data come from simulation with program-generated instructions; this is not a human study and not a physical robot.')}</li>
      <li>${T('来源：评分复查“按实际落点重判”', 'Source: the scoring re-check “re-judged by actual landing”')}${X.dev ? ' · ' + esc(S.commit_b.slice(0, 11)) : ''}。</li></ul></div></article>`;
  });
}
window.SLX.rescore = {mount, page, footnote};
if (document.querySelector('#homebox') && !document.querySelector('.rsfoot')) X.rerender();
})();
