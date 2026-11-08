/* Per-case public answers (B, research/public_answers_20261107): "show the intended meaning", "what the reference says to do",
   "guess first". The case input is loaded first; an answer chunk (data/answers/<dataset>__<k>.js) is loaded only when the reader
   switches the answer on or presses "reveal". Guesses are kept in this browser only (localStorage, every access in try/catch). */
(function () {
'use strict';
const X = window.SLX;
if (!X) return;
const {$, esc} = X;
const z = () => document.documentElement.lang === 'zh-CN';
const T = (zh, en) => z() ? zh : en;

/* ---------- loading ---------- */
let IDX = null;
window.SL_ANS_INDEX = o => { IDX = o; };
const chunks = {}, waits = {};
window.SL_ANS = (name, obj) => { chunks[name] = obj; (waits[name] || []).forEach(f => f(obj)); delete waits[name]; };
const T32 = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t.push(c >>> 0); } return t; })();
function crc32(str) { const b = new TextEncoder().encode(str); let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T32[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const dsOf = id => { const m = /:O([134]):(BLOCK|CLEAR)$/.exec(id); return m ? `S11_OBS_O${m[1]}_${m[2]}` : id.split(':')[0]; };
function loadChunk(name) {
  if (chunks[name]) return Promise.resolve(chunks[name]);
  return new Promise(res => { if (!waits[name]) { waits[name] = []; const s = document.createElement('script'); s.src = `data/answers/${name}.js`; s.onerror = () => res({}); document.head.appendChild(s); } waits[name].push(res); });
}
function indexReady() {
  if (IDX) return Promise.resolve();
  return new Promise(res => { const s = document.createElement('script'); s.src = 'data/answers/index.js'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
}
function get(id) {
  return indexReady().then(() => { const ds = dsOf(id), n = IDX && IDX.chunks[ds]; if (!n) return null; return loadChunk(`${ds}__${crc32(id) % n}`).then(o => o[id] || null); });
}

/* ---------- guesses (browser only) ---------- */
const KEY = 'sl.guess';
const mem = {};
function readGuess(id) { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o[id] || mem[id] || null; } catch (e) { return mem[id] || null; } }
function writeGuess(id, v) { mem[id] = v; try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); o[id] = v; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* storage unavailable: kept in memory only */ } }

/* ---------- wording ---------- */
const U = v => v === 'UNKNOWN';
const num = (v, d = 2) => U(v) ? T('未定', 'undecided') : v == null ? '—' : typeof v === 'number' ? v.toFixed(d) : String(v);
const INTENT = {literal: ['照字面', 'Follow the words'], structure: ['进某个门', 'Enter an opening'], absent: ['指令指的门不存在', 'The opening named does not exist']};
const intentLabel = k => (INTENT[k] || [k, k])[z() ? 0 : 1];
const DEC = d => U(d) ? T('未定', 'undecided') : d === 'LITERAL' ? T('照字面', 'follow the words') : d === 'REPORT' ? T('停下报告', 'stop and report') : T('进门 ', 'enter opening ') + d;
const SIDE = {left: ['左侧', 'left'], right: ['右侧', 'right']};
const CAT = {EXACT: ['可行', 'feasible'], WITHIN_1M: ['精确位置不可行，偏移 1 m 内可行', 'not feasible at the exact place; feasible within 1 m'], INFEASIBLE: ['不可行', 'not feasible'], UNDEFINED: ['未定', 'undecided']};
const FEAS_TIP = () => T('“不可行”只指：在登记的有限路径族（直行加固定半径圆弧）里没找到整车可通过的路线，不是“全图不可达”的证明。', '“Not feasible” only means: no route that the whole vehicle can drive was found in the registered finite family of paths (straight lines plus fixed-radius arcs); it is not a proof that the place cannot be reached.');
const feasLabel = l => { const c = (CAT[l.c] || [l.f, l.f]); return c[z() ? 0 : 1]; };
const BLIND = () => T('答案已经公开：这个测试集不再能当盲测。', 'The answers are public: this test set can no longer serve as a blind test.');
const NOBOX = () => T('有箱子 / 没箱子的题：参考模型不处理箱子，参考的决策和期望得分全部未定。', 'With-box / no-box cases: the reference model does not handle boxes, so its decision and expected scores are all undecided.');

/* ---------- panel ---------- */
function refHTML(r) {
  if (!r) return '';
  const sc = r.sc || {};
  const known = r.d && !U(r.d);
  const rows = [];
  if (known && sc.literal != null && !U(sc.literal)) rows.push([T('照字面', 'Follow the words'), sc.literal, r.d === 'LITERAL']);
  if (known && sc.structures && !U(sc.structures)) for (const k in sc.structures) rows.push([T('进门 ', 'Enter opening ') + k, sc.structures[k], r.d === k]);
  if (known && sc.report != null && !U(sc.report)) rows.push([T('停下报告', 'Stop and report'), sc.report, r.d === 'REPORT']);
  if (!known) return `<dt>${T('参考认为该怎么做', 'What the reference says to do')}</dt><dd>${esc(T('未定', 'undecided'))}</dd>`;
  const lo = Math.min(-1, ...rows.map(x => x[1])), hi = Math.max(1, ...rows.map(x => x[1]));
  return `<dt>${T('参考认为该怎么做', 'What the reference says to do')}</dt><dd><b>${esc(DEC(r.d))}</b></dd>
   <dt>${T('三类做法的期望得分', 'Expected score of the three kinds of action')}</dt><dd class="exs">${rows.map(([l, v, best]) => `<span class="ex ${best ? 'best' : ''}"><em>${esc(l)}</em><i style="width:${Math.max(2, (v - lo) / (hi - lo) * 100)}%"></i><b>${v.toFixed(2)}</b></span>`).join('')}</dd>`;
}
function panelHTML(e, rec, rec2) {
  if (!rec) return `<section class="card"><div class="card-h"><span class="tile">✓</span><h3>${T('答案', 'Answer')}</h3></div><p class="note" style="padding:0 16px 12px">${esc(T('没有找到这一题的答案行。', 'No answer row was found for this case.'))}</p></section>`;
  const t = rec.t, isObs = !!rec.o;
  const tgt = t ? `<dt>${T('目标门', 'Target opening')}</dt><dd>${esc(t.id)} · ${esc((SIDE[t.s] || [t.s, t.s])[z() ? 0 : 1] || '')}${t.l != null ? ` · ${T('离起点', 'at')} ${num(t.l, 1)} m` : ''} · ${T('门宽', 'width')} ${num(t.w)} m</dd>` : '';
  const fwin = t && !(U(t.fw) && U(t.fd)) ? `<dt>${T('参考模型给出的窗口', 'Window given by the reference model')}</dt><dd>${T('进度', 'progress')} ${Array.isArray(t.fw) ? t.fw.map(v => num(v, 1)).join(' – ') : num(t.fw)} m · ${T('期限', 'deadline')} ${num(t.fd, 1)} m</dd>` : (t ? `<dt>${T('参考模型给出的窗口', 'Window given by the reference model')}</dt><dd>${esc(T('未定', 'undecided'))}</dd>` : '');
  const L = rec.l || {};
  const lit = (a, l, tag) => `<dt>${tag ? esc(tag) + ' · ' : ''}${T('字面落点', 'Literal landing point')}</dt><dd>${a ? `(${num(a[0], 1)}, ${num(a[1], 1)}) m` : '—'} · <span title="${esc(FEAS_TIP())}" class="tipu">${T('能否执行：', 'Can it be carried out: ')}${esc(feasLabel(l))}</span></dd>`;
  const body = `<dl class="kv">
    <dt>${T('真实意思', 'Intended meaning')}</dt><dd><b>${esc(intentLabel(rec.i))}</b></dd>${tgt}
    ${rec2 ? lit(L.a, L, T('有箱子', 'With box')) + lit((rec2.l || {}).a, rec2.l || {}, T('没箱子', 'No box')) : lit(L.a, L)}
    ${fwin}
    ${isObs ? '' : refHTML(rec.r)}</dl>
    <p class="note" style="padding:0 16px 6px">${isObs ? esc(NOBOX()) : ''} ${esc(BLIND())}</p>
    <div class="note src">${esc('B ' + (IDX ? IDX.commit.slice(0, 11) : '') + ' · ' + (IDX ? IDX.path : '') + '/' + dsOf(e.id) + '.answers.jsonl')}</div>`;
  return `<section class="card"><div class="card-h"><span class="tile">✓</span><h3>${T('答案（已公开）', 'Answer (published)')}</h3></div>${body}</section>`;
}

/* ---------- overlay on the map ---------- */
function overlayFor(e, rec) {
  const noPlot = /DIVERSITY_F2/.test(e.id) || (rec.t && rec.t.sf && !/initial/.test(rec.t.sf));
  return (g, F) => {
    const {X: PX, Y: PY, s} = F;
    g.save();
    if (rec.t && !noPlot && rec.t.c && rec.t.tg) {
      const [cx, cy] = rec.t.c, [tx, ty] = rec.t.tg, h = (rec.t.w || 1) / 2, [ix, iy] = rec.t.in || [0, 0], dep = Math.min(rec.t.d || 2, 2.5);
      g.fillStyle = 'rgba(255,79,0,.16)'; g.strokeStyle = '#FF4F00'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(PX(cx - tx * h), PY(cy - ty * h)); g.lineTo(PX(cx + tx * h), PY(cy + ty * h)); g.lineTo(PX(cx + tx * h + ix * dep), PY(cy + ty * h + iy * dep)); g.lineTo(PX(cx - tx * h + ix * dep), PY(cy - ty * h + iy * dep)); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(PX(cx - tx * h), PY(cy - ty * h)); g.lineTo(PX(cx + tx * h), PY(cy + ty * h)); g.stroke();
      g.fillStyle = '#FF4F00'; g.font = '600 11.5px ui-monospace,Menlo,monospace'; g.fillText((z() ? '目标门 ' : 'target ') + rec.t.id, PX(cx - tx * h) + 4, PY(cy) - 8 - (iy < 0 ? -26 : 0));
    }
    if (rec.l && rec.l.a && !/DIVERSITY_F2/.test(e.id)) {
      const [ax, ay] = rec.l.a, col = rec.l.c === 'EXACT' ? '#12A594' : rec.l.c === 'UNDEFINED' ? '#8A8D93' : '#E5484D';
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.4; g.beginPath(); g.arc(PX(ax), PY(ay), 7, 0, 7); g.stroke(); g.beginPath(); g.arc(PX(ax), PY(ay), 2.2, 0, 7); g.fill();
      g.font = '600 11px ui-monospace,Menlo,monospace'; g.fillText((z() ? '字面落点' : 'literal point') + ' · ' + feasLabel(rec.l), PX(ax) + 10, PY(ay) + 18);
    }
    g.restore();
  };
}

/* ---------- wiring into the case page ---------- */
const state = {};
function setAnswerOn(e, on, repaint) {
  const host = $('#anspanel'); if (!host) return;
  const btn = $('#tAns'); if (btn) btn.classList.toggle('on', on);
  if (!on) { host.innerHTML = ''; if (e.m._overs) e.m._overs.ans = null; if (e._pair && e._pair.m._overs) e._pair.m._overs.ans = null; if (window.SLX.belief) window.SLX.belief.onAnswer(e, null); repaint && repaint(); return; }
  host.innerHTML = `<p class="note" style="padding:12px 16px">…</p>`;
  Promise.all([get(e.id), e._pair ? get(e._pair.id) : null]).then(([rec, rec2]) => {
    if (!$('#anspanel') || !(btn ? btn.classList.contains('on') : true)) return;
    host.innerHTML = panelHTML(e, rec, rec2);
    if (rec) { e.m._overs = e.m._overs || {}; e.m._overs.ans = overlayFor(e, rec); }
    if (rec2) { e._pair.m._overs = e._pair.m._overs || {}; e._pair.m._overs.ans = overlayFor(e._pair, rec2); }
    if (window.SLX.belief) window.SLX.belief.onAnswer(e, rec);
    repaint && repaint();
    const gr = $('#guessres'); if (gr) revealGuess(e, rec);
  });
}
function revealGuess(e, rec) {
  const gr = $('#guessres'); if (!gr || !rec) return;
  const g = readGuess(e.id);
  gr.innerHTML = g ? `${T('你猜：', 'You guessed: ')}<b>${esc(intentLabel(g))}</b> · ${T('答案：', 'answer: ')}<b>${esc(intentLabel(rec.i))}</b> · ${g === rec.i ? `<span class="chip ink">${T('猜对了', 'correct')}</span>` : `<span class="chip dash">${T('没猜中', 'not this time')}</span>`}` : esc(T('你还没有选。', 'You have not chosen yet.'));
}
function guessHTML(e) {
  const g = readGuess(e.id);
  return `<section class="card guesscard" id="guesscard" style="margin-top:14px"><div class="card-h"><span class="tile">?</span><h3>${T('先猜再看答案', 'Guess first, then see the answer')}</h3><span class="more">${T('只存在你的浏览器里', 'stored only in your browser')}</span></div>
    <p class="note" style="padding:0 16px">${T('这句指令的意思是？', 'What does this instruction mean?')}</p>
    <div class="picks" style="padding:6px 16px">${['literal', 'structure', 'absent'].map(k => `<button class="pk ${g === k ? 'on' : ''}" data-k="${k}">${esc(intentLabel(k))}</button>`).join('')}</div>
    <div style="padding:6px 16px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn" id="guessgo">${T('揭示答案', 'Reveal the answer')}</button><span class="note" id="guessres" style="padding:0"></span></div></section>`;
}
function mount(e, hooks) {
  const stage = document.querySelector('.stagecard');
  if (stage && !$('#guesscard')) stage.insertAdjacentHTML('afterend', guessHTML(e));
  const btn = $('#tAns');
  if (btn) btn.onclick = () => setAnswerOn(e, !btn.classList.contains('on'), hooks.paint);
  document.querySelectorAll('#guesscard .pk').forEach(b => b.onclick = () => { writeGuess(e.id, b.dataset.k); document.querySelectorAll('#guesscard .pk').forEach(x => x.classList.toggle('on', x === b)); const gr = $('#guessres'); if (gr && btn && btn.classList.contains('on')) get(e.id).then(r => revealGuess(e, r)); });
  const go = $('#guessgo'); if (go) go.onclick = () => { setAnswerOn(e, true, hooks.paint); };
}
window.SLX.ans = {get, mount, panelHTML, dsOf, crc32, readGuess};
})();
