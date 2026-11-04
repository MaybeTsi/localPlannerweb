/* Scenario library viewer. Data: window.SL_META, window.SL_INDEX, data/cases/<shard>.js (SL_SHARD).
   Motion vocabulary ported from video-shotcraft demos (parameters noted inline). Browsing tool only: no conclusions. */
(function () {
'use strict';
const META = window.SL_META, IDX = window.SL_INDEX;
const ARMS = META.arms;
/* public source line: file names only (no team letters, commit hashes or branch names) */
function pubSrc(x) { return String(x || '').replace(/\b(?:MAINLINE|[BCDT])(?:\s+[0-9a-f]{7,40})?\s*(?:·\s*)?(?=research\/|docs\/|tools\/|…|\.\.\.|scores|raw|\(|（)/g, '').replace(/\s*@\s*[0-9a-f]{7,40}/g, '').replace(/\b[BCD]\s+[0-9a-f]{7,40}\s*·\s*/g, '').replace(/codex\/[\w.-]+/g, '').replace(/docs\/mainline\//g, '').replace(/\beach B score\b/g, 'each score').replace(/\s+by B\b/g, '').replace(/\s{2,}/g, ' ').trim(); }
const byId = new Map(IDX.map(e => [e.id, e]));
const KINDS = ['01', '02', '03', '04', '05', '06', '07', '09', '14', '15'];
const KN = {'01': '①', '02': '②', '03': '③', '04': '④', '05': '⑤', '06': '⑥', '07': '⑦', '09': '⑨', '14': '⑭', '15': '⑮'};
const SHORT = {v16: 'v16', fixed: 'FX', goal_point: 'GP', nearest: 'NR', snap: 'SN', method: 'M', no_keep: '-K', no_speed: '-S', always_slow: 'AS', method_v2: 'V2', method_v2_k: 'VK', oracle: 'OR', oracle_belief: 'OB'};
const NAV = new URLSearchParams(location.search).get('nav') || 'dock'; document.documentElement.dataset.nav = NAV;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {get(k, d) { try { return localStorage.getItem('sl.' + k) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('sl.' + k, v); } catch (e) {} }};

/* ---------------- i18n ---------------- */
const T = {
 zh: {brand: '测试场景库', brandSub: 'Scenario Library', views: '视图', list: '用例列表', overview: '概览', sets: '集合', holdout: '锁定留出', ho: '原包', hs: '补包', s1d: 'S1 开发集', pending: '待补', sealed: '封存待发放', notGen: '未生成',
  search: '搜索 case_id 或指令文字', all: '全部', kinds: '指令类型',
  kname: {'01': '按距离转弯', '02': '遇口转', '03': '第 N 个口', '04': '停在某处', '05': '走到头', '06': '转弯再前进', '07': '窄道掉头', '09': '现在转还是下一个', '14': '纠正', '15': '方向指令'},
  arm: {v16: 'v16', fixed: '固定动作', goal_point: '目标点+HA*', nearest: '最近结构', snap: '就近吸附', method: '本方法', no_keep: '去保留字面', no_speed: '去调速', always_slow: '全程慢速', method_v2: '本方法 v2', method_v2_k: '本方法 v2-K', oracle: '真值 GOTO（上限参考）', oracle_belief: '真值信念', method_v3: '本方法 v3', method_v4: '本方法 v4', v4_no_speed: 'v4 去调速', v4_no_keep: 'v4 去保留字面', v4_only_nownext: '只修⑨', v4_only_correction: '只修⑭', always_slow_fixed: '一直慢行', oracle_due: 'oracle_due（知道答案）'},
  setS: {HOLD: '锁定留出', S1: 'S1 合成走廊', S2: 'S2 真实楼层', S3: 'S3 误差比例', S4: 'S4 场景族', S1PP: 'S1″ 合成走廊（S6）', S2PP: 'S2″ 真实楼层（S6）', DEV: '开发集'}, bd: {hospital: '医院', office: '办公室'}, fam: {F0: 'F0 杂物', F1: 'F1 大厅', F2: 'F2 拐角/T 口', F3: 'F3 障碍挡窗口', F4: 'F4 障碍遮挡', F5: 'F5 障碍假口', F6: 'F6 方向指令'}, devS1: 'S1 开发', devS4: 'S4 开发',
  setDesc: {HOLD: '锁定留出集：原包与补包各 1,080 条，九类指令各 240 条；评分和轨迹都来自锁定的 CPU 评测。', S1: '合成走廊：候选数 K、开口侧、壁龛位置和目标序位随机；7 类指令各 120 条，c = 0.25。', S2: '真实楼层：医院与办公室的建筑栅格，起点到门 3 / 6 / 10 m；主估计按门等权。', S3: '用 S1 的生成器改变误差比例 c = 0.15 / 0.35，①④⑥ 三类。', S4: '场景族 F0–F6：杂物、大厅、拐角 / T 口、障碍挡窗口、障碍遮挡、障碍假口、方向指令；各族成功率分开。', S1PP: 'S6 合成走廊：840 个全新输入几何，7 类指令（①②③④⑥⑨⑭）；12 个臂的全部轨迹（参考路由）。已评分，目标门答案暂未公开，所以不显示答案。', S2PP: 'S6 真实楼层：同 30 扇真实门（医院 9、办公室 21）的 1,405 次新起点和发话，不是新楼或新门；12 个臂的全部轨迹（参考路由）；主估计按门等权。答案暂未公开。', DEV: '开发子集：答案公开，没有评分，不用于报告。'},
  stCases: '用例', stTraj: '有轨迹', stAns: '答案', stScored: '已评分', stDev: '开发公开', fSub: '子集', fKind: '类型', fOut: '结局', legendT: '图例', pre: '对比', preAll: '全部', preNone: '清空', grpBase: '基线', grpMe: '本方法与消融', grpV2: '新版本', grpRef: '真值参考', grpV4: 'v4 消融',
  allSub: '全部', withTraj: '只看有轨迹', trajNote: n => n ? `轨迹：锁定留出全部；S1–S4 每组前 ${n} 条` : '轨迹：所有已评分用例全部收录（开发集没有评分和运行记录）', noTraj: '未收录轨迹', s4nopool: 'S4 各族的成功率不合并；请在上方选一族。', subWhy: {S2: '建筑', S2PP: '建筑', S3: '误差比例 c', S4: '场景族', DEV: '来源'},
  rateSrc: '数据', estTip: '主估计', armsOfSet: '本集合的方法', ratesNote2: '格内为“成功 / 槽位”计数；悬停看 主估计和 95% 区间（S2 按门等权）。未知另列，不计入成功。', dsPick: '数据集', famCard: 'S4 场景族 F1–F6', famNote2: '每族取发放的第一条 S4 开发集用例（答案公开），按场景库地图绘制；橙框为目标结构。', dirTarget: '方向',
  eyebrowList: 'CPU 回放 · 已评分 · 真实轨迹', heroA: n => `${n} 类口头指令`, heroB: n => `${n} 种方法`, lede: '车式小车在室内按口头指令行驶的测试用例。每条含地图、起点、指令、目标结构，以及各方法的轨迹和评分。',
  m1: s => `本方法意图成功 · ${s}`, m1foot: '按类型', m2: s => `各方法意图成功 · ${s}`, m3: '集合状态', scored: '已评分', s6rates: '已评分；S6 各方法的成功率和配对区间见“分析”第 6 章，这里不另算。', devpub: '开发公开，无评分',
  outcomeOf: '结局', succ: '成功', fail: '失败', other: '未知 / 不适用', showing: '显示', of: '/', loadMore: '再加载', empty: '没有符合条件的用例。',
  legend: '方法条：实心＝意图成功，空心＝失败，虚线＝不适用，点线＝未知，灰底＝无运行记录',
  orig: '原包', supp: '补包', dev: 'S1 开发', video: '视频',
  back: '返回列表', answer: '显示答案', cand: '本方法候选', literal: '字面落点', overlay: '叠加', split: '并排', slider: '拉杆',
  arms: '方法', hI: '意图', hL: '字面', hC: '无接触', hT: '用时 s', rateTitle: '本类意图成功', target: '目标', alcove: '不可通行',
  spoke: '发话', corr: '纠正', commit: '承诺', done: '完成', noRun: '无运行记录', na: '不适用', answerHidden: '该集合尚未评分或答案暂未公开，答案不显示。',
  kfTitle: '机制视频关键帧', kfCap: '本例被选为机制视频；关键帧来自 D 分支 frames/。', commitNote: '承诺', deadline: '期限前绑定为 GOTO',
  ansOpen: '答案已公开', ansClosed: '答案未公开', srcT: '数据来源', ovTitle: '概览', ovLede: '各集合与类型的用例数、各方法意图成功（直接取自统计文件）、S4 场景族图和机制视频选例。',
  counts: '用例数', countsSrc: '按场景库清单逐条计数', rates: '各方法意图成功', ratesNote: '格内为“成功 / 槽位”，与统计文件相同；未知另列。点击格子在下方查看逐例点阵。',
  dsHold: '留出合计', dsHO: '原包', dsHS: '补包', dsMM: '失配', dsNP: '夜跑主层', dsND: '夜跑 D 接触', total: '合计', dotsTitle: '逐例点阵', dotsNote: '一点＝一条用例（上方所选数据集），颜色为意图评分；点击打开该例。点表格中的格子切换类型和方法。',
  vidsTitle: '机制视频选例',
  unknown: '未知', heroCap: n => `本方法实际轨迹 · 锁定留出 ${n} 条（每类前 30 条，C）· 橙＝意图成功，灰＝失败`, rejected: '编译被拒，停在起点', railOpen: '展开侧栏', railClose: '收起侧栏', railKey: '收起 / 展开', railKindNote: '本方法成功', toDark: '切换到深色', toLight: '切换到浅色', dark: '深色', light: '浅色',
  heroT: '本方法的真实行驶路线', heroS: n => `${n} 条锁定留出用例 · 全部从同一起点出发、向右行驶 · 单位 m`, hOk: '意图成功', hNo: '意图失败', hStart: '起点', hHint: '移到线上看是哪条用例，点击打开', hAll: '全部类型'},
 en: {brand: 'Scenario Library', brandSub: '测试场景库', views: 'Views', list: 'Cases', overview: 'Overview', sets: 'Sets', holdout: 'Locked holdout', ho: 'original', hs: 'supplement', s1d: 'S1 development', pending: 'TBD', sealed: 'sealed, not released', notGen: 'not generated',
  search: 'Search case_id or instruction', all: 'All', kinds: 'Instruction kind',
  kname: {'01': 'Turn at distance', '02': 'First opening', '03': 'N-th opening', '04': 'Stop at', '05': 'Corridor end', '06': 'Turn, then forward', '07': 'U-turn', '09': 'Now or next', '14': 'Correction', '15': 'Direction'},
  arm: {v16: 'v16', fixed: 'Fixed', goal_point: 'Goal point+HA*', nearest: 'Nearest', snap: 'Snap', method: 'Method', no_keep: 'No keep-literal', no_speed: 'No speed rule', always_slow: 'Always slow', method_v2: 'Method v2', method_v2_k: 'Method v2-K', oracle: 'Oracle GOTO (reference)', oracle_belief: 'Oracle belief', method_v3: 'Method v3', method_v4: 'Method v4', v4_no_speed: 'v4 no speed rule', v4_no_keep: 'v4 no keep-literal', v4_only_nownext: 'Only ⑨ fix', v4_only_correction: 'Only ⑭ fix', always_slow_fixed: 'Always slow (fixed)', oracle_due: 'oracle_due (knows target)'},
  setS: {HOLD: 'Locked holdout', S1: 'S1 synthetic', S2: 'S2 real floors', S3: 'S3 error scale', S4: 'S4 families', S1PP: 'S1″ synthetic (S6)', S2PP: 'S2″ real floors (S6)', DEV: 'Development'}, bd: {hospital: 'Hospital', office: 'Office'}, fam: {F0: 'F0 clutter', F1: 'F1 hall', F2: 'F2 corner / T', F3: 'F3 box in window', F4: 'F4 occlusion', F5: 'F5 false gap', F6: 'F6 direction'}, devS1: 'S1 dev', devS4: 'S4 dev',
  setDesc: {HOLD: 'Locked holdout: original and supplement packs, 1,080 cases each, 240 per kind; scores and trajectories from the locked CPU evaluation.', S1: 'Synthetic corridors: candidate count K, opening side, alcove positions and target ordinal randomised; 7 kinds × 120, c = 0.25.', S2: 'Real floors: hospital and office building rasters, start 3 / 6 / 10 m from the door; the main estimate weights doors equally.', S3: 'S1 generator with error scale c = 0.15 / 0.35, kinds ①④⑥.', S4: 'Families F0–F6: clutter, hall, corner / T, box in window, occlusion, false gap, direction; rates reported per family.', S1PP: 'S6 synthetic corridors: 840 new input geometries, 7 kinds (①②③④⑥⑨⑭); every trajectory of the 12 arms (reference route). Scored; the target answers are not public yet, so they stay hidden.', S2PP: 'S6 real floors: 1,405 new starts and utterances on the same 30 real doors (hospital 9, office 21), not new buildings or doors; every trajectory of the 12 arms (reference route); doors are weighted equally. Answers not public yet.', DEV: 'Development subsets: answers public, not scored, not reported.'},
  stCases: 'cases', stTraj: 'with trajectory', stAns: 'answers', stScored: 'scored', stDev: 'public development', fSub: 'Subset', fKind: 'Kind', fOut: 'Outcome', legendT: 'Legend', pre: 'Compare', preAll: 'All', preNone: 'None', grpBase: 'Baselines', grpMe: 'Method and ablations', grpV2: 'New version', grpRef: 'Oracle reference', grpV4: 'v4 ablations',
  allSub: 'All', withTraj: 'With trajectory', trajNote: n => n ? `Trajectories: every locked-holdout case; first ${n} per group in S1–S4` : 'Trajectories: every scored case (development sets have no scores or runs)', noTraj: 'trajectory not included', s4nopool: 'S4 families are not pooled; pick one family above.', subWhy: {S2: 'building', S2PP: 'building', S3: 'error scale c', S4: 'family', DEV: 'source'},
  rateSrc: 'Data', estTip: 'Main estimate', armsOfSet: 'Methods in this set', ratesNote2: 'Cells are “success / slots” counts; hover for the main estimate and 95% interval (S2 weights doors equally). Unknown listed separately, never counted as success.', dsPick: 'Dataset', famCard: 'S4 families F1–F6', famNote2: 'First released S4 development case of each family (answers public), drawn from the library map; orange box = target structure.', dirTarget: 'direction',
  eyebrowList: 'CPU replay · scored · recorded trajectories', heroA: n => `${n} spoken instruction kinds`, heroB: n => `${n} methods`, lede: 'Test cases of a car-like robot following spoken indoor instructions: map, start, instruction and target structure, with each method’s trajectory and scores.',
  m1: s => `Method intent success · ${s}`, m1foot: 'by kind', m2: s => `Intent success by method · ${s}`, m3: 'Set status', scored: 'scored', s6rates: 'Scored; S6 rates per method and paired intervals are in Analysis, chapter 6; not recomputed here.', devpub: 'public development, unscored',
  outcomeOf: 'Outcome', succ: 'success', fail: 'failure', other: 'unknown / N/A', showing: 'Showing', of: '/', loadMore: 'Load more', empty: 'No case matches.',
  legend: 'Method strip: filled = intent success, hollow = failure, dashed = not applicable, dotted = unknown, grey = no run',
  orig: 'original', supp: 'supplement', dev: 'S1 dev', video: 'video',
  back: 'Back to cases', answer: 'Show answer', cand: 'Method candidates', literal: 'Literal point', overlay: 'Overlay', split: 'Side by side', slider: 'Slider',
  arms: 'Methods', hI: 'INT', hL: 'LIT', hC: 'NC', hT: 'time s', rateTitle: 'Intent success for this kind', target: 'target', alcove: 'not passable',
  spoke: 'spoken', corr: 'correction', commit: 'commit', done: 'done', noRun: 'no run record', na: 'N/A', answerHidden: 'This set is not scored yet or its answers are not public; answers stay hidden.',
  kfTitle: 'Mechanism video keyframe', kfCap: 'Selected for a mechanism video; keyframe from branch D frames/.', commitNote: 'commit', deadline: 'bound to GOTO before the deadline',
  ansOpen: 'answers public', ansClosed: 'answers hidden', srcT: 'Sources', ovTitle: 'Overview', ovLede: 'Case counts per set and kind, intent success per method (taken from the statistics files), the S4 family figure and the mechanism-video selections.',
  counts: 'Case counts', countsSrc: 'Counted from the library index', rates: 'Intent success by method', ratesNote: 'Cells show “success / slots” as in the statistics files; unknown listed separately. Click a cell to see the per-case dots below.',
  dsHold: 'Holdout total', dsHO: 'Original', dsHS: 'Supplement', dsMM: 'Mismatch', dsNP: 'Night primary', dsND: 'Night D-exposed', total: 'Total', dotsTitle: 'Per-case dots', dotsNote: 'One dot = one case of the dataset chosen above, coloured by intent score; click to open it. Click a table cell to switch kind and method.',
  vidsTitle: 'Mechanism-video selections',
  unknown: 'unknown', heroCap: n => `Actual method trajectories · ${n} locked-holdout cases (first 30 per kind, C) · orange = intent success, grey = failure`, rejected: 'compile rejected, stays at start', railOpen: 'Expand sidebar', railClose: 'Collapse sidebar', railKey: 'collapse / expand', railKindNote: 'method · success', toDark: 'Switch to dark', toLight: 'Switch to light', dark: 'Dark', light: 'Light',
  heroT: 'Where the method actually drove', heroS: n => `${n} locked-holdout cases · all start at the same point and drive right · metres`, hOk: 'intent success', hNo: 'intent failure', hStart: 'start', hHint: 'Hover a line to see its case; click to open', hAll: 'all kinds'}};
let L = store.get('lang', 'zh');
const t = k => T[L][k];
function instr(e) {
  const sec = v => String(+(+v).toFixed(1));
  if (L === 'zh') return e.k === '14' && e.u.corrected_at_s != null ? `先指某扇门，${sec(e.u.corrected_at_s)} 秒后纠正为下一个${e.u.direction === 'left' ? '左' : '右'}侧开口` : e.tx;
  const u = e.u, d = u.direction;
  switch (e.k) {
    case '01': return `Go ${u.distance_m} m, then turn ${d} 90°`;
    case '02': return `Enter the first passable opening on the ${d}`;
    case '03': return `Enter passable opening no. ${u.ordinal} on the ${d}`;
    case '04': return `Go ${u.distance_m} m, then stop`;
    case '05': return 'Go to the end of the corridor and stop';
    case '06': return `Go ${u.distance_m} m, turn ${d} through the door, then ${u.follow_forward_m} m on`;
    case '07': return 'Turn around here';
    case '09': return `Turn ${d} at this or the next opening (spoken at ${u.issued_at_s} s)`;
    case '14': return `First points to a door; at ${sec(u.corrected_at_s)} s corrected to the next ${d} opening`;
    case '15': { const m = /向(左|右)前方行驶\s*([\d.]+)\s*米/.exec(e.tx); return m ? `Drive ahead-${m[1] === '左' ? 'left' : 'right'} for ${m[2]} m` : e.tx; }
    default: return e.tx;
  }
}

/* ---------------- data access ---------------- */
const shards = {}, waiting = {};
window.SL_SHARD = (name, obj) => { shards[name] = obj; (waiting[name] || []).forEach(f => f(obj)); delete waiting[name]; };
function shard(name) {
  if (shards[name]) return Promise.resolve(shards[name]);
  return new Promise(res => {
    if (!waiting[name]) { waiting[name] = []; const s = document.createElement('script'); s.src = `data/cases/${name}.js`; document.head.appendChild(s); }
    waiting[name].push(res);
  });
}
/* trajectories: data/traj/<shard>__<n>.js holds base64 zigzag-varint deltas of [t_cs, x_cm, y_cm, yaw_crad] (lossless, see
   tools/build_data.py encode_traj). Chunks load when a card comes near the viewport; decoded arrays live in a bounded LRU. */
const tchunks = {}, twait = {};
window.SL_TRAJ = (name, obj) => { tchunks[name] = obj; (twait[name] || []).forEach(f => f(obj)); delete twait[name]; };
function trajChunk(name) { if (tchunks[name]) return Promise.resolve(tchunks[name]);
  return new Promise(res => { if (!twait[name]) { twait[name] = []; const s = document.createElement('script'); s.src = `data/traj/${name}.js`; document.head.appendChild(s); } twait[name].push(res); }); }
function trajDecode(b64) { const bin = atob(b64), out = []; let i = 0, cur = [0, 0, 0, 0], j = 0, row = [];
  while (i < bin.length) { let n = 0, sh = 0, b; do { b = bin.charCodeAt(i++); n += (b & 0x7f) * Math.pow(2, sh); sh += 7; } while (b & 0x80);
    const d = (n % 2) ? -(n + 1) / 2 : n / 2; cur[j] += d; row.push(cur[j] / 100); if (++j === 4) { out.push(row); row = []; j = 0; } }
  return out; }
const trLRU = new Map(), TR_MAX = 600;
function traj(ae) { if (!ae || !ae.tr) return null;
  if (trLRU.has(ae)) { const v = trLRU.get(ae); trLRU.delete(ae); trLRU.set(ae, v); return v; }
  const v = typeof ae.tr === 'string' ? trajDecode(ae.tr) : null; trLRU.set(ae, v);
  if (trLRU.size > TR_MAX) trLRU.delete(trLRU.keys().next().value); return v; }
/* scores shard + trajectory chunk + building raster for one case; the chunk's strings are attached to the score rows once */
function caseReady(e) { const det = shards[e.sh] && shards[e.sh][e.id]; return det && (!e.ch || det._tr) && (!e.m.img || rasters[e.m.img]) ? det : null; }
function ensureCase(e) {
  return Promise.all([shard(e.sh), e.ch ? trajChunk(e.ch) : null, e.m.img ? raster(e.m.img) : null]).then(([sh, ch]) => { const det = sh[e.id];
    if (ch && !det._tr) { const row = ch[e.id] || {}; for (const a in row) if (det.arms[a]) det.arms[a].tr = row[a]; det._tr = 1; } return det; }); }
function rate(ds, cat, arm) { return ds ? META.rates.find(r => r.dataset === ds && r.category === cat && r.arm === arm) : null; }
/* S2 building rasters (C truth occupancy, 0.1 m), rendered once per theme into an offscreen canvas */
const rasters = {}, rWait = {}, rCanvas = {};
window.SL_RASTER = (name, obj) => { rasters[name] = obj; (rWait[name] || []).forEach(f => f(obj)); delete rWait[name]; };
function raster(name) { if (rasters[name]) return Promise.resolve(rasters[name]);
  return new Promise(res => { if (!rWait[name]) { rWait[name] = []; const s = document.createElement('script'); s.src = `data/maps/${name}.js`; document.head.appendChild(s); } rWait[name].push(res); }); }
function rasterCanvas(name) { const R = rasters[name]; if (!R) return null; const key = name + THEME; if (rCanvas[key]) return rCanvas[key];
  const c = document.createElement('canvas'); c.width = R.w; c.height = R.h; const g = c.getContext('2d'), im = g.createImageData(R.w, R.h);
  const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; } const q = /rgba?\(([^)]+)\)/.exec(h); return q ? q[1].split(',').slice(0, 3).map(Number) : [200, 200, 200]; };
  const probe = document.createElement('span'); document.body.appendChild(probe); const css = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
  const col = [hex(css('--map-unk')), hex(css('--map-free')), hex(css('--map-wall'))]; probe.remove();
  let i = 0; const a = R.rle; for (let k = 0; k < a.length; k += 2) { const cc = col[a[k]]; for (let n = 0; n < a[k + 1]; n++, i++) { const x = i % R.w, y = R.h - 1 - Math.floor(i / R.w), o = (y * R.w + x) * 4; im.data[o] = cc[0]; im.data[o + 1] = cc[1]; im.data[o + 2] = cc[2]; im.data[o + 3] = 255; } }
  g.putImageData(im, 0, 0); return rCanvas[key] = c; }
/* sets: web set key -> case filter; sub-filters inside a set */
const SETS = ['HOLD', 'S1', 'S2', 'S3', 'S4', 'S1PP', 'S2PP', 'DEV'];
function inSet(e, set) { return set === 'HOLD' ? (e.d === 'HO' || e.d === 'HS') : set === 'DEV' ? (e.d === 'S1D' || e.d === 'S4D') : e.d === set; }
function subOpts(set) { if (set === 'S2' || set === 'S2PP') return ['hospital', 'office']; if (set === 'S3') return [...new Set(IDX.filter(e => e.d === 'S3').map(e => e.c))].sort().map(c => 'c=' + c);
  if (set === 'S4') return ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6']; if (set === 'DEV') return ['S1D', 'S4D']; if (set === 'HOLD') return ['HO', 'HS']; return []; }
function inSub(e, sub) { if (!sub || sub === 'all') return true; if (sub.startsWith('c=')) return 'c=' + e.c === sub; if (/^F\d$/.test(sub)) return e.f === sub; if (sub === 'hospital' || sub === 'office') return e.bd === sub; return e.d === sub; }
function subLabel(sub) { if (sub === 'all') return t('allSub'); if (sub.startsWith('c=')) return sub; if (/^F\d$/.test(sub)) return t('fam')[sub]; if (t('bd')[sub]) return t('bd')[sub]; return {HO: t('orig'), HS: t('supp'), S1D: t('devS1'), S4D: t('devS4')}[sub] || sub; }
/* B statistics dataset for (set, sub); S4 families are never pooled (B SUMMARY notes) */
function rateDs(set, sub) { sub = sub || 'all'; if (set === 'HOLD') return sub === 'HO' ? 'holdout_original' : sub === 'HS' ? 'holdout_supplement' : 'holdout';
  if (set === 'S1') return 'S1'; if (set === 'S2') return sub === 'all' ? 'S2' : 'S2:' + sub; if (set === 'S3') return sub === 'all' ? 'S3' : 'S3:' + sub;
  if (set === 'S4') return sub === 'all' ? null : 'S4_' + sub; return null; }
function caseDs(e) { return e.d === 'HO' || e.d === 'HS' ? 'holdout' : e.d === 'S1' ? 'S1' : e.d === 'S2' ? 'S2:' + e.bd : e.d === 'S3' ? 'S3:c=' + e.c : e.d === 'S4' ? 'S4_' + e.f : null; }
function setOfCase(e) { return SETS.find(s => inSet(e, s)); }
/* side-panel groups, keyed by their first arm in display order (ARMS order) */
const ARM_GROUPS = [['grpBase', ['v16', 'fixed', 'goal_point', 'nearest', 'snap']], ['grpMe', ['method', 'no_keep', 'no_speed', 'always_slow', 'always_slow_fixed']], ['grpV2', ['method_v2', 'method_v2_k', 'method_v3', 'method_v4']], ['grpV4', ['v4_no_speed', 'v4_no_keep', 'v4_only_nownext', 'v4_only_correction']], ['grpRef', ['oracle', 'oracle_belief', 'oracle_due']]];
const armsCache = {};
function armsOf(set) { if (armsCache[set]) return armsCache[set]; const on = new Set(); IDX.forEach(e => { if (inSet(e, set)) for (let i = 0; i < ARMS.length; i++) if ((e.o[i] || ' ') !== ' ') on.add(i); });
  return armsCache[set] = ARMS.filter((a, i) => on.has(i)); }
function dsLabel(ds) { const m = {holdout: t('dsHold'), holdout_original: t('dsHO'), holdout_supplement: t('dsHS'), mismatch: t('dsMM'), night_primary: t('dsNP'), night_D_exposed: t('dsND')};
  if (ds === 'holdout') return t('holdout'); if (m[ds]) return `${t('holdout')} · ${m[ds]}`; if (ds.startsWith('S4_')) return `S4 · ${t('fam')[ds.slice(3)]}`; const [a, b] = ds.split(':'); return b ? `${a} · ${subLabel(b)}` : a; }
const fmt = n => n == null ? '—' : Number(n).toLocaleString('en-US');

/* ---------------- easing (demos/_fixtures/Polish.tsx) ---------------- */
const cl = x => x < 0 ? 0 : x > 1 ? 1 : x;
function bez(x1, y1, x2, y2) { const ax = 1 - 3 * x2 + 3 * x1, bx = 3 * x2 - 6 * x1, cx = 3 * x1, ay = 1 - 3 * y2 + 3 * y1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const sx = u => ((ax * u + bx) * u + cx) * u, sy = u => ((ay * u + by) * u + cy) * u, dx = u => (3 * ax * u + 2 * bx) * u + cx;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let u = x; for (let i = 0; i < 8; i++) { const e = sx(u) - x; if (Math.abs(e) < 1e-6) break; const d = dx(u); if (Math.abs(d) < 1e-6) break; u -= e / d; } return sy(u); }; }
const EASE = {snappy: bez(.16, 1, .3, 1), out: bez(.22, 1, .36, 1), smooth: bez(.65, 0, .35, 1), swift: bez(.4, 0, .2, 1), roll: bez(.25, .8, .25, 1), outCubic: x => 1 - Math.pow(1 - cl(x), 3), inOut: x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }};
const ramp = (f, s, d, e = EASE.snappy) => e(cl((f - s) / Math.max(1e-6, d)));
const mix = (a, b, k) => a + (b - a) * k;
function anim(frames, step, done) { if (reduce) { step(frames); done && done(); return () => {}; } let stop = false; const st = performance.now();
  const tick = now => { if (stop) return; const f = Math.min(frames, (now - st) / 1000 * 30); step(f); if (f < frames) requestAnimationFrame(tick); else done && done(); };
  requestAnimationFrame(tick); return () => { stop = true; }; }

/* ---------------- map renderer ---------------- */
let MAP, ARMC, CANDC;
function readTheme() { const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  MAP = {unk: v('--map-unk'), free: v('--map-free'), wall: v('--map-wall'), grid: v('--map-grid'), gate: v('--map-gate'), gateOff: v('--map-gate-off'), lit: v('--map-lit'), hud: v('--map-hud'), ink: v('--map-ink'), acc: v('--accent'),
    dFail: v('--dot-fail'), dUnk: v('--dot-unk'), dNa: v('--dot-na'), heroOk: v('--hero-ok'), heroNo: v('--hero-no'), heroOkDot: v('--accent'), heroNoDot: v('--hero-no-dot'), heroStart: v('--hero-start'), heroAxis: v('--hero-axis')};
  ARMC = Object.fromEntries(ARMS.map(a => [a, v('--arm-' + a)])); CANDC = [v('--accent'), v('--arm-goal_point'), v('--arm-v16')]; }
let THEME = store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = THEME; readTheme();
const MONO = getComputedStyle(document.documentElement).getPropertyValue('--mono');
const SANS = getComputedStyle(document.documentElement).getPropertyValue('--sans');
function prep(cv) { const d = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); } const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return [g, W, H]; }
function frameOf(e, W, H, pad) { const [x0, y0, x1, y1] = e.m.b; const s = Math.min(W / (x1 - x0 + 2 * pad), H / (y1 - y0 + 2 * pad)); const ox = (W - (x1 - x0) * s) / 2 - x0 * s, oy = (H + (y1 - y0) * s) / 2 + y0 * s; return {s, X: x => ox + x * s, Y: y => oy - y * s}; }
function drawMap(cv, e, det, o) {
  const [g, W, H] = prep(cv); const F = frameOf(e, W, H, o.pad ?? .35), {s, X, Y} = F; const small = !!o.small;
  g.fillStyle = MAP.unk; g.fillRect(0, 0, W, H);
  const [x0, y0, x1, y1] = e.m.b;
  if (!small) { g.strokeStyle = MAP.grid; g.lineWidth = 1; for (let x = Math.ceil(x0); x <= x1; x++) { g.beginPath(); g.moveTo(Math.round(X(x)) + .5, 0); g.lineTo(Math.round(X(x)) + .5, H); g.stroke(); } for (let y = Math.ceil(y0); y <= y1; y++) { g.beginPath(); g.moveTo(0, Math.round(Y(y)) + .5); g.lineTo(W, Math.round(Y(y)) + .5); g.stroke(); } }
  const wt = (small ? 1.6 : 2.6) / s;
  if (e.m.img) { const rc = rasterCanvas(e.m.img), R = rasters[e.m.img]; if (rc) { g.imageSmoothingEnabled = false; g.drawImage(rc, X(R.ox), Y(R.oy + R.h * R.res), R.w * R.res * s, R.h * R.res * s); g.imageSmoothingEnabled = true; } }
  g.fillStyle = MAP.wall; for (const r of e.m.r) g.fillRect(X(r[0] - wt), Y(r[3] + wt), (r[2] - r[0] + 2 * wt) * s, (r[3] - r[1] + 2 * wt) * s);
  g.fillStyle = MAP.free; for (const r of e.m.r) g.fillRect(X(r[0]), Y(r[3]), (r[2] - r[0]) * s, (r[3] - r[1]) * s);
  g.fillStyle = '#8A8D93'; for (const r of e.m.o || []) { const q = Array.isArray(r) ? r : (r.rect || r.bounds); if (q) g.fillRect(X(q[0]), Y(q[3]), (q[2] - q[0]) * s, (q[3] - q[1]) * s); }
  const ans = o.answer && det && det.answers;
  if (!small) {
    g.font = '10.5px ' + MONO; g.fillStyle = MAP.hud;
    for (let x = Math.ceil(x0 / 2) * 2; x <= x1; x += 2) { g.fillRect(Math.round(X(x)), H - 18, 1, 6); g.fillText(x + (x === 0 ? ' m' : ''), X(x) + 4, H - 8); }
    for (const [ci, c] of e.m.c.entries()) { const [id0, cx, cy, tx, ty, ix, iy, w] = c, h = w / 2, id = gateName(e, id0, ci); const pass = ans && ans.opening_passability ? ans.opening_passability[id0] : null;
      g.strokeStyle = pass === false ? MAP.gateOff : MAP.gate; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(cx - tx * h), Y(cy - ty * h)); g.lineTo(X(cx + tx * h), Y(cy + ty * h)); g.stroke(); g.setLineDash([]);
      g.fillStyle = pass === false ? MAP.hud : MAP.gate; g.font = '600 11.5px ' + MONO; const ly = Y(cy) + (iy > 0 ? 16 : -7); g.fillText(id, X(cx - tx * h) + 3, ly);
      if (pass === false) { g.font = '10.5px ' + SANS; g.fillStyle = MAP.hud; g.fillText(t('alcove'), X(cx - tx * h) + 22, ly); } }
    if (o.literal !== false) { const u = e.u, st = e.m.s || [0, 0, 0]; if (u.distance_m != null && ['01', '04', '06'].includes(e.k)) { const c = Math.cos(st[2]), sn = Math.sin(st[2]), lx = st[0] + u.distance_m * c, ly = st[1] + u.distance_m * sn, L = 2.6;
      g.strokeStyle = MAP.lit; g.lineWidth = 1.5; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(X(lx + sn * L), Y(ly - c * L)); g.lineTo(X(lx - sn * L), Y(ly + c * L)); g.stroke(); g.setLineDash([]); g.fillStyle = MAP.lit; g.font = '11.5px ' + SANS; g.fillText(`${t('literal')} ${u.distance_m} m`, X(lx - sn * L) + 6, Y(ly + c * L) - 4); } }
    const dt = ans && ans.target && ans.target.kind === 'direction' ? ans.target : null;
    if (dt && o.reticle != null && o.reticle >= 0) { const st = e.m.s || [0, 0, 0], a = st[2] + dt.relative_angle_rad, ex = st[0] + dt.distance_m * Math.cos(a), ey = st[1] + dt.distance_m * Math.sin(a), k = cl(o.reticle / 24);
      g.save(); g.strokeStyle = MAP.acc; g.fillStyle = MAP.acc; g.lineWidth = 2.4; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(X(st[0]), Y(st[1])); g.lineTo(X(mix(st[0], ex, k)), Y(mix(st[1], ey, k))); g.stroke(); g.setLineDash([]);
      if (k >= 1) { g.font = '600 12px ' + MONO; g.fillText(`${t('dirTarget')} ${Math.round(dt.relative_angle_rad * 180 / Math.PI)}° · ${dt.distance_m} m`, X(ex) + 8, Y(ey) - 8); } g.restore(); }
    if (o.cand && det && det.cand) det.cand.list.forEach((k, i) => { const col = CANDC[i % 3]; g.strokeStyle = col; g.lineWidth = 2.4; g.beginPath(); g.arc(X(k[2]), Y(k[3]), 7, 0, 7); g.stroke(); g.font = '600 11.5px ' + MONO; const lb = `${String.fromCharCode(65 + i)} ${Math.round((k[4] || 0) * 100)}%`, lw = g.measureText(lb).width, lx = X(k[2]) + 10, ly = Y(k[3]) - 8;
      g.fillStyle = MAP.free; g.globalAlpha = .9; g.beginPath(); g.roundRect ? g.roundRect(lx - 4, ly - 12, lw + 8, 17, 5) : g.rect(lx - 4, ly - 12, lw + 8, 17); g.fill(); g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = 1; g.stroke(); g.fillStyle = col; g.fillText(lb, lx, ly); });
  }
  const tm = o.t;
  for (const a of (o.arms || [])) { const ae = det && det.arms[a], tr = traj(ae); if (!tr || !tr.length) continue; const col = ARMC[a];
    g.save(); g.globalAlpha = o.alpha ?? 1; g.strokeStyle = col; g.lineWidth = small ? (o.alpha ? 2 : 2.4) : (a === 'method' ? 3.6 : 2.6); g.lineJoin = g.lineCap = 'round'; g.beginPath(); let last = null;
    for (const p of tr) { if (tm != null && p[0] > tm) break; last ? g.lineTo(X(p[1]), Y(p[2])) : g.moveTo(X(p[1]), Y(p[2])); last = p; }
    if (last && tm != null) { const q = poseAt(tr, tm); g.lineTo(X(q[1]), Y(q[2])); last = q; }
    g.stroke(); g.restore();
    if (last && (tm != null || !small) && !(small && o.alpha)) { car(g, X, Y, s, last, e, col); if (o.pen) { g.fillStyle = col; g.beginPath(); g.arc(X(last[1]), Y(last[2]), 3.2, 0, 7); g.fill(); } } }
  if (tm == null || small) { const st = e.m.s || [0, 0, 0]; car(g, X, Y, s, [0, st[0], st[1], st[2]], e, MAP.ink, .5); }
  if (ans && o.reticle != null && o.reticle >= 0 && !(ans.target && ans.target.kind === 'direction')) reticle(g, X, Y, e, ans, o.reticle, W, H);
  return F;
}
/* building doors carry long ids (office_y14_pos716_731): number them along the list instead, full id in the side panel */
function gateName(e, id, i) { if (!e.m.img) return id; if (i == null) i = e.m.c.findIndex(c => c[0] === id); return 'd' + (i + 1); }
function poseAt(tr, tm) { if (tm <= tr[0][0]) return tr[0]; for (let i = 1; i < tr.length; i++) if (tr[i][0] >= tm) { const a = tr[i - 1], b = tr[i], k = (tm - a[0]) / ((b[0] - a[0]) || 1); return [tm, mix(a[1], b[1], k), mix(a[2], b[2], k), mix(a[3], b[3], k)]; } return tr[tr.length - 1]; }
const VEH = {front_m: .6345, rear_m: .1455, width_m: .6075};
function car(g, X, Y, s, p, e, col, alpha = 1) { const v = VEH; g.save(); g.globalAlpha = alpha; g.translate(X(p[1]), Y(p[2])); g.rotate(-p[3]); const a = v.rear_m * s, b = v.front_m * s, w = v.width_m / 2 * s;
  g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(-a, -w, a + b, 2 * w, Math.min(3, w / 2)) : g.rect(-a, -w, a + b, 2 * w); g.fill();
  if (w > 3) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-a * .2, 0); g.lineTo(b * .7, 0); g.lineTo(b * .45, -w * .4); g.moveTo(b * .7, 0); g.lineTo(b * .45, w * .4); g.stroke(); } g.restore(); }
function targetBox(e, ans) { const tg = ans.target || {}; if (tg.target_id) { const c = e.m.c.find(c => c[0] === tg.target_id); if (!c) return null; const [, cx, cy, tx, ty, ix, iy, w, d] = c, h = w / 2, dd = Math.min(d ?? 1.2, 1.6);
    const xs = [cx - tx * h, cx + tx * h, cx - tx * h + ix * dd, cx + tx * h + ix * dd], ys = [cy - ty * h, cy + ty * h, cy - ty * h + iy * dd, cy + ty * h + iy * dd]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if (tg.point) return [tg.point[0] - .5, tg.point[1] - .5, tg.point[0] + .5, tg.point[1] + .5];
  if (tg.kind === 'uturn' && tg.wide_location_m != null) return [tg.wide_location_m - 1.2, -1.2, tg.wide_location_m + 1.2, 1.2];
  return null; }
/* reticle-lock-on (ReticleLockOn.tsx): fly-in 10f out-cubic; shrink 2.2→0.94 (swift) →1 (out); bite 6px; focus dim .10; label pill back-out */
function reticle(g, X, Y, e, ans, f, W, H) { const b = targetBox(e, ans); if (!b) return; const FLY = 10, SH0 = 6, UNDER = 26, LOCK = 32;
  const fly = 1 - EASE.outCubic(f / FLY); const shrink = f < UNDER ? mix(2.2, .94, ramp(f, SH0, UNDER - SH0, EASE.swift)) : mix(.94, 1, ramp(f, UNDER, LOCK - UNDER, EASE.out));
  const bite = f < LOCK ? 0 : f < LOCK + 1 ? f - LOCK : f < LOCK + 5 ? 1 - (f - LOCK - 1) / 4 : 0;
  const cx = (X(b[0]) + X(b[2])) / 2, cy = (Y(b[1]) + Y(b[3])) / 2, hw = ((X(b[2]) - X(b[0])) / 2 + 8) * shrink - 5 * bite, hh = ((Y(b[1]) - Y(b[3])) / 2 + 8) * shrink - 5 * bite, ox = fly * 360, oy = fly * 200, ARM = Math.min(20, hw * .7, hh * .7);
  const focus = ramp(f, LOCK - 2, 12, EASE.outCubic); if (focus > 0) { g.save(); g.fillStyle = THEME === 'dark' ? `rgba(0,0,0,${.18 * focus})` : `rgba(33,32,28,${.04 * focus})`; g.beginPath(); g.rect(0, 0, W, H); g.rect(cx - hw + 4, cy - hh + 4, 2 * hw - 8, 2 * hh - 8); g.fill('evenodd'); g.restore(); }
  g.save(); g.globalAlpha = cl(f / 3); g.lineCap = 'round';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const px = cx + sx * hw + ox, py = cy + sy * hh + oy; for (const [w, col] of [[7, MAP.free], [3.5, MAP.ink]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(px - sx * ARM, py); g.lineTo(px, py); g.lineTo(px, py - sy * ARM); g.stroke(); } }
  g.restore();
  const lt = EASE.out(cl((f - LOCK - 2) / 10)); if (lt > 0) { const label = `${t('target')} ${ans.target.target_id ? gateName(e, ans.target.target_id) : ans.target.kind}`; g.save(); g.font = '600 12px ' + MONO; const tw = g.measureText(label).width + 30, lx = cx - hw, ly = cy - hh - 30;
    const sc = .6 + .4 * EASE.out(lt) + .1 * Math.sin(Math.PI * lt); g.translate(lx, ly + 11); g.scale(sc, sc); g.translate(-lx, -(ly + 11)); g.globalAlpha = lt;
    g.fillStyle = MAP.ink; g.beginPath(); g.roundRect ? g.roundRect(lx, ly, tw, 22, 11) : g.rect(lx, ly, tw, 22); g.fill(); g.fillStyle = MAP.acc; g.beginPath(); g.arc(lx + 11, ly + 11, 3.5, 0, 7); g.fill(); g.fillStyle = MAP.free; g.fillText(label, lx + 20, ly + 15); g.restore(); } }

/* ---------------- shell ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const state = {set: SETS.includes(store.get('set', 'HOLD')) ? store.get('set', 'HOLD') : 'HOLD', sub: 'all', kind: 'all', arm: 'method', out: 'all', q: '', tr: false, shown: 48, view: 'overlay', on: {method: 1, goal_point: 1, nearest: 1, v16: 1}, answer: false, cand: true, ovDs: 'holdout', dot: ['01', 'method']};
const nSet = (set, f = () => true) => IDX.filter(e => inSet(e, set) && f(e)).length;
function setsDef() { const M = META.manifest.counts || {}; const fams = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'];
  return [
   {id: 'HOLD', ico: 'H', sub: `${t('ho')} ${fmt(nSet('HOLD', e => e.d === 'HO'))} · ${t('hs')} ${fmt(nSet('HOLD', e => e.d === 'HS'))}`, scored: true},
   {id: 'S1', ico: '1', sub: `${t('kinds')} ${KINDS.filter(k => IDX.some(e => e.d === 'S1' && e.k === k)).length} · ${t('scored')}`, scored: true},
   {id: 'S2', ico: '2', sub: `${t('bd').hospital} ${fmt(nSet('S2', e => e.bd === 'hospital'))} · ${t('bd').office} ${fmt(nSet('S2', e => e.bd === 'office'))}`, scored: true},
   {id: 'S3', ico: '3', sub: subOpts('S3').map(c => `${c} ${fmt(nSet('S3', e => 'c=' + e.c === c))}`).join(' · '), scored: true},
   {id: 'S4', ico: '4', sub: `F0–F6 · ${fams.filter(f => IDX.some(e => e.d === 'S4' && e.f === f)).length} ${L === 'zh' ? '族' : 'families'}`, scored: true},
   {id: 'S1PP', ico: '1″', sub: `${t('kinds')} ${KINDS.filter(k => IDX.some(e => e.d === 'S1PP' && e.k === k)).length} · ${t('scored')}`, scored: true},
   {id: 'S2PP', ico: '2″', sub: `${t('bd').hospital} ${fmt(nSet('S2PP', e => e.bd === 'hospital'))} · ${t('bd').office} ${fmt(nSet('S2PP', e => e.bd === 'office'))}`, scored: true},
   {id: 'DEV', ico: 'D', sub: `${t('devS1')} ${fmt(nSet('DEV', e => e.d === 'S1D'))} · ${t('devS4')} ${fmt(nSet('DEV', e => e.d === 'S4D'))} · ${t('devpub')}`, scored: false},
  ].map(x => ({...x, label: t('setS')[x.id], n: nSet(x.id)})); }
function mark() { return `<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" class="logo"><rect x="1" y="1" width="30" height="30" rx="8.5" fill="#FF4F00"/><rect x="9" y="5.5" width="17" height="12" rx="2.6" fill="#fff" opacity=".38"/><rect x="7.5" y="8.5" width="17" height="12" rx="2.6" fill="#fff" opacity=".62"/><rect x="6" y="11.5" width="17" height="14.5" rx="2.8" fill="#fff"/><path d="M9.3 22.6h5.2c2.6 0 3.9-1.4 3.9-4v-3.2" fill="none" stroke="#17181C" stroke-width="2.1" stroke-linecap="round"/><circle cx="18.4" cy="15" r="1.7" fill="#FF4F00"/></svg>`; }
/* sidebar (536fe2b layout): views, then one filled pill per set with a one-line breakdown; commits in the footer */
function paintReps(root) { root.querySelectorAll('canvas[data-rep]').forEach(cv => { const id = cv.dataset.rep, e = IDX.find(x => inSet(x, id) && x.t) || IDX.find(x => inSet(x, id)); if (!e) return;
  const go = () => ensureCase(e).then(det => drawMap(cv, e, det, {small: true, pad: .3, arms: ['method'], alpha: .9})); e.m.img ? raster(e.m.img).then(go) : go(); }); }
/* dock show / hide without hover: × pins it collapsed; scrolling down collapses, scrolling up expands (unless pinned); S toggles */
const WIDE = () => matchMedia('(min-width:1760px)').matches;
const dockState = {mini: store.get('dock', 'open') === 'closed' || !WIDE(), pinned: store.get('dock', 'open') === 'closed', y: 0};
function dock(mini, byUser) { const d = $('#dock'); if (!d) return; dockState.mini = mini; if (byUser) { dockState.pinned = mini; store.set('dock', mini ? 'closed' : 'open'); } d.classList.toggle('fold', mini); }
if (NAV === 'dock') { window.addEventListener('scroll', () => { const y = window.scrollY, dy = y - dockState.y; dockState.y = y; if (dockState.pinned || WIDE()) return; if (dy > 6 && !dockState.mini) dock(true); }, {passive: true});
  document.addEventListener('keydown', ev => { if ((ev.key === 's' || ev.key === 'S') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !ev.metaKey && !ev.ctrlKey) dock(!dockState.mini, true); }); }
function setSet(id) { if (NAV === 'dock' && !WIDE()) dockState.mini = true; state.set = id; store.set('set', id); state.sub = 'all'; state.kind = 'all'; state.shown = 48; if (!armsOf(id).includes(state.arm)) state.arm = 'method'; closeNav(); if (route().name !== 'list') location.hash = 'list'; else render(); }
function rail(route) {
  const r = $('#rail'); const sets = setsDef();
  if (NAV === 'mini') { const rn = route;
    r.innerHTML = `<div class="mini"><a class="mb" href="#list" title="${t('brand')}">${mark()}</a>
     <a class="mi ${rn === 'list' ? 'v' : ''}" href="#list" data-tip="${t('list')}">▦</a><a class="mi ${rn === 'overview' ? 'v' : ''}" href="#overview" data-tip="${t('overview')}">◔</a><span class="msep"></span>
     ${sets.map(x => `<button class="ms ${rn !== 'overview' && state.set === x.id ? 'on' : ''}" data-set="${x.id}"><b>${x.ico}</b><small>${x.n >= 1000 ? (x.n / 1000).toFixed(1) + 'k' : x.n}</small>
       <span class="fly"><em>${esc(x.label)}</em><span class="fn">${fmt(x.n)}</span><span class="fs">${esc(x.sub)}</span><canvas data-rep="${x.id}"></canvas></span></button>`).join('')}</div>`;
    r.querySelectorAll('[data-set]').forEach(b => b.onclick = () => setSet(b.dataset.set)); let painted = false; r.addEventListener('mouseover', () => { if (!painted) { painted = true; paintReps(r); } }); return; }
  if (NAV !== 'rail') { r.innerHTML = ''; return; }
  r.innerHTML = `<a class="brand" href="#list">${mark()}<span><b>${t('brand')}</b><small>${t('brandSub')}</small></span></a>
  <h6>${t('views')}</h6>
  <a class="ri ${route === 'list' ? 'on' : ''}" href="#list"><span class="ico">▦</span>${t('list')}</a>
  <a class="ri ${route === 'overview' ? 'on' : ''}" href="#overview"><span class="ico">◔</span>${t('overview')}</a>
  <h6>${t('sets')}</h6>
  ${sets.map(s => `<button class="ri ${route === 'list' && state.set === s.id ? 'on' : ''}" data-set="${s.id}"><span class="ico">${s.ico}</span><span>${esc(s.label)}<span class="sub">${esc(s.sub)}</span></span><span class="n">${fmt(s.n)}</span></button>`).join('')}
  <div class="foot">${esc(META.built_utc.slice(0, 10))}</div>`;
  r.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { state.set = b.dataset.set; store.set('set', state.set); state.sub = 'all'; state.kind = 'all'; state.shown = 48; if (!armsOf(state.set).includes(state.arm)) state.arm = 'method'; closeNav(); if (location.hash.replace('#', '') !== 'list') location.hash = 'list'; else render(); });
  r.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
}
function closeNav() { $('#app').classList.remove('nav'); }
function topbar(crumbs) {
  const rn = route().name, sets = setsDef();
  const brand = !['rail', 'mini'].includes(NAV) ? `<a class="tb-brand" href="#list">${mark()}<span>${t('brand')}</span></a>` : '';
  const tabs = NAV === 'top' ? `<nav class="stabs" id="stabs">${sets.map((x, i) => `<button class="${rn !== 'overview' && state.set === x.id ? 'on' : ''}" data-set="${x.id}" title="${esc(x.sub)}"><span>${esc(x.label)}</span><sup>${fmt(x.n)}</sup></button>`).join('')}<i class="ink" id="sink"></i></nav>` : '';
  const views = ['top', 'tiles', 'title'].includes(NAV) ? seg('view0', [['list', t('list')], ['overview', t('overview')]], rn === 'overview' ? 'overview' : 'list', 'sm vseg') : '';
  $('#top').innerHTML = (NAV !== 'rail' ? brand + tabs + views : '') + `<button class="menu-btn" id="menu" aria-label="menu"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
   ${['rail', 'mini'].includes(NAV) ? `<nav class="crumb">${crumbs}</nav>` : ''}
   <label class="search"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#8E9097" stroke-width="1.6"><circle cx="7" cy="7" r="5"/><path d="m11 11 3.5 3.5"/></svg><input id="q" placeholder="${t('search')}" value="${esc(state.q)}" autocomplete="off"><kbd>⌘K</kbd></label>
   <button class="themebtn" id="themebtn" aria-label="${THEME === 'dark' ? t('toLight') : t('toDark')}" title="${THEME === 'dark' ? t('toLight') : t('toDark')}">${THEME === 'dark' ? '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/></svg>' : '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7z"/></svg>'}<span>${THEME === 'dark' ? t('light') : t('dark')}</span></button>
   ${seg('lang', [['zh', '中文'], ['en', 'EN']], L, 'sm')}`;
  $('#themebtn').onclick = () => { THEME = THEME === 'dark' ? 'light' : 'dark'; store.set('theme', THEME); document.documentElement.dataset.theme = THEME; readTheme(); render(); };
  $('#menu').onclick = () => $('#app').classList.toggle('nav');
  document.querySelectorAll('#stabs [data-set]').forEach(b => b.onclick = () => setSet(b.dataset.set));
  const ink = $('#sink'), on = $('#stabs button.on'); if (ink) { if (on) { ink.style.width = on.offsetWidth - 24 + 'px'; ink.style.transform = `translateX(${on.offsetLeft + 12}px)`; } else ink.style.opacity = 0; }
  bindSeg('view0', v => { location.hash = v; });
  const q = $('#q'); q.oninput = () => { state.q = q.value.trim(); state.shown = 48; if (route().name !== 'list') location.hash = 'list'; else renderGrid(true); };
  bindSeg('lang', v => { L = v; store.set('lang', v); document.documentElement.lang = v === 'zh' ? 'zh-CN' : 'en'; render(); });
}
function seg(id, opts, cur, cls = '') { return `<div class="seg ${cls}" data-seg="${id}" role="tablist"><span class="thumb"></span>${opts.map(([v, l]) => `<button role="tab" data-v="${v}" class="${v === cur ? 'on' : ''}" aria-selected="${v === cur}">${l}</button>`).join('')}</div>`; }
/* segmented-thumb-hero: thumb slides ~8f ease-out with leading-edge stretch; positions measured */
function placeThumb(el, animate) { const on = el.querySelector('button.on'), th = el.querySelector('.thumb'); if (!on || !th) return; if (!animate) th.style.transition = 'none'; th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft}px)`; if (!animate) { th.offsetWidth; th.style.transition = ''; } }
function bindSeg(id, fn, root = document) { const el = root.querySelector(`[data-seg="${id}"]`); if (!el) return; requestAnimationFrame(() => placeThumb(el, false));
  el.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.classList.contains('on')) return; el.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); placeThumb(el, true); setTimeout(() => fn(b.dataset.v), reduce ? 0 : 140); }); }

/* DigitRoll (assets/lib/DigitRoll.tsx): per digit delay 4f, 22f, bezier(.25,.8,.25,1), one full strip then target */
function digitRoll(el, value, delay = 0) { const s = fmt(value); el.innerHTML = s.split('').map(ch => /\d/.test(ch) ? `<span style="display:inline-block;height:1em;overflow:hidden;vertical-align:top;line-height:1"><span class="strip-d" data-d="${ch}" style="display:block">${'01234567890123456789'.split('').map(d => `<span style="display:block;height:1em">${d}</span>`).join('')}</span></span>` : `<span>${ch}</span>`).join('');
  const cols = [...el.querySelectorAll('.strip-d')]; if (reduce) { cols.forEach(c => c.style.transform = `translateY(${-(10 + +c.dataset.d)}em)`); return; }
  cols.forEach((c, i) => { c.style.transition = `transform ${22 / 30}s cubic-bezier(.25,.8,.25,1) ${(delay + i * 4) / 30}s`; });
  requestAnimationFrame(() => requestAnimationFrame(() => cols.forEach(c => c.style.transform = `translateY(${-(10 + +c.dataset.d)}em)`))); }

/* ---------------- routes ---------------- */
function route() { const h = decodeURIComponent(location.hash.replace(/^#/, '')); if (h.startsWith('case/')) return {name: 'case', id: h.slice(5)}; if (h === 'overview') return {name: 'overview'}; if (h === 'analysis' || h.startsWith('analysis/')) return {name: 'analysis', id: h.slice(9)}; return {name: 'list'}; }
let cleanup = [];
function render() { cleanup.forEach(f => f()); cleanup = []; const r = route(); state.pend = r.id; rail(r.name); document.title = L === 'zh' ? '测试场景库' : 'Scenario Library';
  if (r.name === 'case') renderCase(r.id); else if (r.name === 'overview') renderOverview(); else if (r.name === 'analysis') renderAnalysis(r.id); else renderList();
  if (NAV === 'dock') { const sets = setsDef(); let d = $('#dock'); if (!d) { d = document.createElement('nav'); d.id = 'dock'; document.body.appendChild(d); }
    const cur = r.name === 'overview' || r.name === 'analysis' ? null : state.set;
    d.innerHTML = `${sets.map((x, i) => `<button class="it ${cur === x.id ? 'on' : ''}" style="--i:${i}" data-set="${x.id}" title="${esc(x.sub)}"><b>${x.ico}</b><span>${esc(x.label)}</span><sup>${fmt(x.n)}</sup></button>`).join('')}<i class="dsep it"></i><a class="it ${r.name === 'overview' ? 'on' : ''}" href="#overview"><b><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 13.5V9M8 13.5V3.5M13 13.5V7"/></svg></b><span>${t('overview')}</span></a><a class="it ${r.name === 'analysis' ? 'on' : ''}" href="#analysis"><b><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 13.5h11M4 11l3-3.5 2.5 2L13 5"/><circle cx="13" cy="5" r="1"/></svg></b><span>${L === 'zh' ? '分析' : 'Analysis'}</span></a>
      <button class="dk-x" id="dkx" title="${L === 'zh' ? '收起（S）' : 'Collapse (S)'}" aria-label="collapse"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8.5 3 4.5 7l4 4"/></svg></button>
      <span class="dk-h" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="1" width="5" height="5" rx="1.4"/><rect x="8" y="1" width="5" height="5" rx="1.4"/><rect x="1" y="8" width="5" height="5" rx="1.4"/><rect x="8" y="8" width="5" height="5" rx="1.4" opacity=".45"/></svg><span>${L === 'zh' ? '集合' : 'Sets'}</span><em>${cur ? (cur === 'HOLD' ? 'H' : cur === 'DEV' ? 'D' : cur === 'S1PP' ? 'S1″' : cur === 'S2PP' ? 'S2″' : cur) : r.name === 'analysis' ? (L === 'zh' ? '分析' : 'AN') : (L === 'zh' ? '概览' : 'OV')}</em></span>
      <span class="dk-up" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5.5 3 9.5 7l-4 4"/></svg></span>`;
    d.querySelectorAll('[data-set]').forEach(b => b.onclick = ev => { ev.stopPropagation(); if (d.classList.contains('fold')) { dock(false, true); return; } setSet(b.dataset.set); });
    $('#dkx').onclick = ev => { ev.stopPropagation(); dock(true, true); };
    d.onclick = ev => { if (d.classList.contains('fold')) dock(false, true); };
    d.onwheel = ev => { if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) && Math.abs(ev.deltaX) > 6) { ev.preventDefault(); const now = Date.now(); if (now - (dockState.w || 0) < 400) return; dockState.w = now; dock(ev.deltaX < 0, true); } };
    d.classList.toggle('fold', dockState.mini); }
  if (NAV !== 'rail') $('#page').insertAdjacentHTML('beforeend', `<footer class="pfoot"><span>${esc(META.built_utc.slice(0, 10))}</span></footer>`); }
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ---------------- list ---------------- */
let firstList = true;
function crumbsList() { const cur = setsDef().find(s => s.id === state.set);
  return `<a href="#list">${t('list')}</a><i>/</i><b>${esc(cur.label)}</b>${state.sub !== 'all' ? `<i>/</i><b>${esc(subLabel(state.sub))}</b>` : ''}${state.kind !== 'all' ? `<i>/</i><b>${KN[state.kind]} ${t('kname')[state.kind]}</b>` : ''}`; }
const inView = e => inSet(e, state.set) && inSub(e, state.sub);
function renderList() {
  const sets = setsDef(), cur = sets.find(s => s.id === state.set) || sets[0];
  topbar(crumbsList());
  const ds = rateDs(state.set, state.sub), dsName = ds ? dsLabel(ds) : esc(cur.label), all = rate(ds, 'ALL', 'method'), arms = armsOf(state.set);
  const kindsPresent = KINDS.filter(k => IDX.some(e => inView(e) && e.k === k)), kindsAll = KINDS.filter(k => IDX.some(e => e.k === k));
  const subs = subOpts(state.set);
  const nk = KINDS.filter(k => rate(ds, k, 'method')), noRates = !ds ? `<p class="note" style="margin:14px 0 0">${state.set === 'S4' ? t('s4nopool') : state.set === 'S1PP' || state.set === 'S2PP' ? t('s6rates') : t('devpub')}</p>` : '';
  const nAll = IDX.filter(inView).length, nTr = IDX.filter(e => inView(e) && e.t).length;
  const tiles = NAV === 'tiles' ? `<section class="tiles">${sets.map((x, i) => `<button class="stile ${state.set === x.id ? 'on' : ''}" data-set="${x.id}"><span class="no">${String(i + 1).padStart(2, '0')}</span><b>${esc(x.label)}</b><span class="cnt">${fmt(x.n)}</span><span class="sb">${esc(x.sub)}</span><canvas data-rep="${x.id}"></canvas></button>`).join('')}</section>` : '';
  $('#page').innerHTML = tiles + `<section class="shead"><div class="sh-l">
   <div class="eyebrow"><span class="dot"></span>${t('eyebrowList')}</div>
   <h1 class="h">${NAV === 'title' ? `<button class="tsel" id="tsel" aria-expanded="false">${esc(cur.label)}<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>` : esc(cur.label)}${state.sub !== 'all' ? `<span class="hsub">${esc(subLabel(state.sub))}</span>` : ''}</h1>
   <p class="lede">${t('setDesc')[state.set]}</p>
   <div class="stats"><span><b>${fmt(nAll)}</b>${t('stCases')}</span><span><b>${fmt(nTr)}</b>${t('stTraj')}</span><span class="chip ${cur.scored ? 'ink' : 'blue'}">${cur.scored ? t('stScored') : t('stDev')}</span></div></div>
  <div class="metrics">
   <article class="card metric"><div class="card-h"><span class="tile">M</span><h3>${t('m1')(dsName)}</h3><span class="more">${t('m1foot')}</span></div>
    ${ds ? `<div class="big"><b id="m1n">0</b><span>/ ${fmt(all && all.slots)}</span></div>
    <div class="bars" style="grid-template-columns:repeat(${Math.max(nk.length, 3)},1fr)">${nk.map(k => { const r = rate(ds, k, 'method'); const v = r.intent_success.success, n = r.slots || 1; return `<button class="b ${state.kind === k ? 'on' : ''}" data-k="${k}" title="${KN[k]} ${t('kname')[k]}: ${v} / ${n}"><em>${v}</em><i style="height:${Math.max(4, v / n * 64)}px"></i><span>${KN[k]}</span></button>`; }).join('')}</div>
    <div class="foot src">${esc(all ? pubSrc(all.src) : '')}</div>` : noRates}</article>
   <article class="card metric"><div class="card-h"><span class="tile">∑</span><h3>${t('m2')(dsName)}</h3></div>
    ${ds ? `<div class="rows">${arms.map(a => [a, rate(ds, 'ALL', a)]).filter(x => x[1]).sort((p, q) => q[1].intent_success.success - p[1].intent_success.success).map(([a, r]) => `<div class="row ${a === 'method' ? 'me' : ''}" style="--c:${ARMC[a]}"><span class="share" style="width:${r.intent_success.success / r.slots * 100}%"></span><span class="sw" style="background:${ARMC[a]}"></span><span class="nm">${t('arm')[a]}</span><span class="val"><b>${fmt(r.intent_success.success)}</b> / ${fmt(r.slots)}${r.intent_success.unknown ? ` · ? ${fmt(r.intent_success.unknown)}` : ''}</span></div>`).join('')}</div>
    <div class="foot src">${esc(all ? all.scope : '')}</div>` : noRates}</article>
  </div></section>
  <div class="fbar" id="fbar">
   <div class="frow">${subs.length ? `<span class="flab">${t('fSub')}</span>${seg('sub', [['all', t('allSub')], ...subs.map(x => [x, esc(subLabel(x))])], state.sub, 'sm subseg')}<span class="fsep"></span>` : ''}
    <span class="flab">${t('fKind')}</span><div class="kchips" id="kchips">${['all', ...kindsPresent].map(k => `<button class="kc ${state.kind === k ? 'on' : ''}" data-k="${k}">${k === 'all' ? t('all') : `<span class="k">${KN[k]}</span>${t('kname')[k]}`}<span class="n">${IDX.filter(e => inView(e) && (k === 'all' || e.k === k)).length}</span></button>`).join('')}</div></div>
   <div class="frow"><span class="flab">${t('fOut')}</span>
    <select class="pick" id="armsel" aria-label="arm">${arms.map(a => `<option value="${a}" ${state.arm === a ? 'selected' : ''}>${t('arm')[a]}</option>`).join('')}</select>
    ${seg('out', [['all', t('all')], ['1', t('succ')], ['0', t('fail')], ['x', t('other')]], state.out, 'sm')}
    <button class="sw2 trk ${state.tr ? 'on' : ''}" id="trk" title="${t('trajNote')(META.traj_policy.S)}"><i></i>${t('withTraj')}</button>
    <span class="fmeta" id="fmeta"></span>
    <details class="lg"><summary>${t('legendT')}</summary><div class="lgp"><span class="strip">${[['ok', t('succ')], ['', t('fail')], ['na', t('na')], ['un', t('unknown')], ['no', t('noRun')]].map(([c, l]) => `<span class="${c}" style="--c:var(--accent)"></span><em>${l}</em>`).join('')}</span><p>${t('trajNote')(META.traj_policy.S)}</p></div></details></div>
   <div class="frow act" id="act"></div>
  </div>
  <div class="grid" id="grid"></div><div class="more-row" id="more"></div>`;
  if (ds && all) digitRoll($('#m1n'), all.intent_success.success, 6);
  document.querySelectorAll('.stile[data-set]').forEach(b => b.onclick = () => setSet(b.dataset.set));
  const ts = $('#tsel'); if (ts) ts.onclick = () => { let m = $('#mega'); if (m) { m.remove(); ts.setAttribute('aria-expanded', 'false'); return; } ts.setAttribute('aria-expanded', 'true');
    m = document.createElement('div'); m.id = 'mega'; m.innerHTML = `<div class="mg-in"><div class="mg-h"><span class="flab">${t('sets')}</span><span>${L === 'zh' ? '选择一个集合' : 'Choose a set'}</span></div><div class="mg-grid">${sets.map((x, i) => `<button class="mg ${state.set === x.id ? 'on' : ''}" data-set="${x.id}"><canvas data-rep="${x.id}"></canvas><span class="no">${String(i + 1).padStart(2, '0')}</span><b>${esc(x.label)}</b><span class="cnt">${fmt(x.n)}</span><span class="sb">${t('setDesc')[x.id]}</span></button>`).join('')}</div></div>`;
    document.body.appendChild(m); m.onclick = ev => { if (ev.target === m) { m.remove(); ts.setAttribute('aria-expanded', 'false'); } }; m.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { m.remove(); setSet(b.dataset.set); }); paintReps(m); cleanup.push(() => m.remove()); };
  document.querySelectorAll('.stile canvas[data-rep]').forEach(cv => { const id = cv.dataset.rep, e = IDX.find(x => inSet(x, id) && x.t) || IDX.find(x => inSet(x, id)); if (!e) return;
    const go = () => ensureCase(e).then(det => drawMap(cv, e, det, {small: true, pad: .3, arms: ['method'], alpha: .9}));
    e.m.img ? raster(e.m.img).then(go) : go(); });
  document.querySelectorAll('.bars .b').forEach(b => b.onclick = () => selectKind(b.dataset.k));
  document.querySelectorAll('#kchips .kc').forEach(b => b.onclick = () => selectKind(b.dataset.k, b));
  $('#armsel').onchange = e => { state.arm = e.target.value; renderGrid(true); };
  bindSeg('out', v => { state.out = v; state.shown = 48; renderGrid(true); });
  bindSeg('sub', v => { state.sub = v; state.shown = 48; if (state.kind !== 'all' && !IDX.some(e => inView(e) && e.k === state.kind)) state.kind = 'all'; renderList(); });
  $('#trk').onclick = () => { state.tr = !state.tr; $('#trk').classList.toggle('on', state.tr); state.shown = 48; renderGrid(true); };
  renderGrid(firstList); firstList = false;
}
/* hero field: each line = the method's recorded path in one locked-holdout case (C raw), all from the common start.
   Lines grow with an accelerating stagger (R2); hover highlights one case, click opens it; the selected kind is emphasised. */
let heroDraw = null;
function heroField() { const cv = $('#field'); if (!cv || !META.hero) return; const H0 = META.hero, tip = $('#ftip');
  let x0 = 0, x1 = -1e9, y0 = 1e9, y1 = -1e9; H0.forEach(h => { for (let i = 0; i < h.p.length; i += 2) { x1 = Math.max(x1, h.p[i]); y0 = Math.min(y0, h.p[i + 1]); y1 = Math.max(y1, h.p[i + 1]); } });
  x0 = -100; x1 += 60; y0 -= 60; y1 += 60;
  const order = H0.map((h, i) => i).sort((a, b) => (H0[a].i === true) - (H0[b].i === true));
  let hover = -1, F = null, done = 0;
  const draw = f => { const [g, W, H] = prep(cv); const padB = 22, s = Math.min((W - 8) / (x1 - x0), (H - padB - 6) / (y1 - y0)), ox = 4 - x0 * s, oy = (H - padB) / 2 + ((y1 + y0) / 2) * s;
    const X = x => ox + x * s, Y = y => oy - y * s; F = {X, Y};
    g.clearRect(0, 0, W, H); g.lineCap = g.lineJoin = 'round';
    // metre axis
    g.strokeStyle = MAP.heroAxis; g.fillStyle = MAP.heroAxis; g.lineWidth = 1; g.font = '10.5px ' + MONO; g.globalAlpha = .7;
    g.beginPath(); g.moveTo(X(0), H - padB + 4); g.lineTo(X(x1 - 60), H - padB + 4); g.stroke();
    for (let m = 0; m * 100 <= x1 - 60; m += 4) { g.beginPath(); g.moveTo(X(m * 100), H - padB + 1); g.lineTo(X(m * 100), H - padB + 7); g.stroke(); g.fillText(m + (m === 0 ? ' m' : ''), X(m * 100) + 3, H - 4); }
    g.globalAlpha = 1;
    const sel = 'all';
    order.forEach((idx, n) => { const h = H0[idx]; const start = 40 * (1 - Math.pow(1 - n / order.length, 1.8)); const k = reduce ? 1 : EASE.inOut(cl((f - start) / 24)); if (k <= 0) return;
      const m = Math.max(2, Math.round(h.p.length / 2 * k)); const ok = h.i === true; const dim = (sel !== 'all' && h.k !== sel) || (hover >= 0 && hover !== idx);
      g.globalAlpha = dim ? .12 : 1; g.strokeStyle = ok ? MAP.heroOk : MAP.heroNo; g.lineWidth = ok ? 1.6 : 1.1;
      g.beginPath(); for (let i = 0; i < m; i++) { const x = X(h.p[2 * i]), y = Y(h.p[2 * i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      if (k >= 1) { g.fillStyle = ok ? MAP.heroOkDot : MAP.heroNoDot; g.beginPath(); g.arc(X(h.p[h.p.length - 2]), Y(h.p[h.p.length - 1]), ok ? 2.2 : 1.6, 0, 7); g.fill(); } });
    g.globalAlpha = 1;
    if (hover >= 0) { const h = H0[hover]; g.strokeStyle = h.i === true ? MAP.heroOkDot : MAP.heroStart; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < h.p.length / 2; i++) { const x = X(h.p[2 * i]), y = Y(h.p[2 * i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(X(h.p[h.p.length - 2]), Y(h.p[h.p.length - 1]), 4, 0, 7); g.fill(); }
    g.fillStyle = MAP.heroStart; g.beginPath(); g.arc(X(0), Y(0), 4.5, 0, 7); g.fill(); g.font = '600 11px ' + SANS; g.fillText(t('hStart'), X(0) + 8, Y(0) - 8); };
  const pick = ev => { if (!F) return -1; const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top; let best = -1, bd = 64;
    H0.forEach((h, idx) => { for (let i = 0; i < h.p.length; i += 2) { const d = (F.X(h.p[i]) - mx) ** 2 + (F.Y(h.p[i + 1]) - my) ** 2; if (d < bd) { bd = d; best = idx; } } }); return best; };
  cv.onmousemove = ev => { if (!done) return; const b = pick(ev); if (b !== hover) { hover = b; draw(70); }
    if (b >= 0) { const h = H0[b], e = byId.get(h.id); tip.hidden = false; const r = cv.getBoundingClientRect(); tip.style.left = Math.min(r.width - 250, ev.clientX - r.left + 14) + 'px'; tip.style.top = Math.max(0, ev.clientY - r.top - 64) + 'px';
      tip.innerHTML = `<b>${KN[h.k]} ${esc(instr(e))}</b><span>${esc(h.id)} · ${h.i === true ? t('hOk') : t('hNo')}</span>`; cv.style.cursor = 'pointer'; } else { tip.hidden = true; cv.style.cursor = 'default'; } };
  cv.onmouseleave = () => { hover = -1; tip.hidden = true; if (done) draw(70); };
  cv.onclick = ev => { const b = pick(ev); if (b >= 0) location.hash = 'case/' + encodeURIComponent(H0[b].id); };
  heroDraw = () => draw(70);
  cleanup.push(anim(70, draw, () => { done = 1; })); const onR = () => draw(70); window.addEventListener('resize', onR); cleanup.push(() => { window.removeEventListener('resize', onR); heroDraw = null; }); }
/* chip-grid-single-select-blackout: 1 grey press frame, then 5f linear invert with 1→1.04→1 */
function selectKind(k, chip) { if (state.kind === k) return; state.kind = k; state.shown = 48;
  const chips = document.querySelectorAll('#kchips .kc'); const target = chip || [...chips].find(c => c.dataset.k === k);
  if (target && !reduce) { target.classList.add('press'); setTimeout(() => { target.classList.remove('press'); chips.forEach(c => c.classList.toggle('on', c === target)); target.animate([{transform: 'scale(1)'}, {transform: 'scale(1.04)'}, {transform: 'scale(1)'}], {duration: 300, easing: 'ease-out'}); }, 34); }
  else chips.forEach(c => c.classList.toggle('on', c.dataset.k === k));
  document.querySelectorAll('.bars .b').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  const crumbs = $('.crumb'); if (crumbs) crumbs.innerHTML = crumbsList();
  renderGrid(true); }
function filtered() { const ai = ARMS.indexOf(state.arm), q = state.q.toLowerCase();
  return IDX.filter(e => inView(e) && (!state.tr || e.t) && (state.kind === 'all' || e.k === state.kind) && (!q || e.id.toLowerCase().includes(q) || e.tx.toLowerCase().includes(q) || instr(e).toLowerCase().includes(q)) &&
    (state.out === 'all' || (state.out === 'x' ? !'01'.includes(e.o[ai] || ' ') || e.o[ai] === ' ' : e.o[ai] === state.out))); }
let io = null;
function renderGrid(enter) {
  const list = filtered(), grid = $('#grid'); if (!grid) return; const shown = list.slice(0, state.shown);
  $('#fmeta').innerHTML = `${t('showing')} <b>${fmt(shown.length)}</b> ${t('of')} ${fmt(list.length)}`;
  const conds = [[t('setS')[state.set], null], state.sub !== 'all' && [subLabel(state.sub), 'sub'], state.kind !== 'all' && [`${KN[state.kind]} ${t('kname')[state.kind]}`, 'kind'], state.out !== 'all' && [`${t('arm')[state.arm]} · ${{1: t('succ'), 0: t('fail'), x: t('other')}[state.out]}`, 'out'], state.tr && [t('withTraj'), 'tr'], state.q && [`“${state.q}”`, 'q']].filter(Boolean);
  const act = $('#act'); if (act) { act.innerHTML = `<span class="flab">${L === 'zh' ? '当前' : 'Now'}</span>${conds.map(([l, k]) => `<span class="ac">${esc(l)}${k ? `<button data-x="${k}" aria-label="remove">×</button>` : ''}</span>`).join('')}${conds.length > 1 ? `<button class="clr" id="clr">${L === 'zh' ? '清除筛选' : 'Clear filters'}</button>` : ''}`;
    const clear = k => { if (k === 'sub') state.sub = 'all'; if (k === 'kind') state.kind = 'all'; if (k === 'out') state.out = 'all'; if (k === 'tr') state.tr = false; if (k === 'q') state.q = ''; };
    act.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { clear(b.dataset.x); renderList(); }); const c = $('#clr'); if (c) c.onclick = () => { ['sub', 'kind', 'out', 'tr', 'q'].forEach(clear); renderList(); }; }
  grid.innerHTML = shown.length ? shown.map(cardHTML).join('') : `<div class="empty card"><b>${t('empty')}</b><p>${conds.slice(1).map(c => esc(c[0])).join(' · ')}</p><button class="btn" id="clr2">${L === 'zh' ? '清除筛选' : 'Clear filters'}</button></div>`;
  const c2 = $('#clr2'); if (c2) c2.onclick = () => { state.sub = state.kind = state.out = 'all'; state.tr = false; state.q = ''; renderList(); };
  $('#more').innerHTML = list.length > shown.length ? `<button class="btn" id="morebtn">${t('loadMore')} · ${fmt(Math.min(48, list.length - shown.length))}</button>` : '';
  const mb = $('#morebtn'); if (mb) mb.onclick = () => { state.shown += 48; renderGrid(false); };
  // bento-light-up entrance: accelerating gaps 12→3f (R2), 16f rise; type-and-filter: 0.4f stagger on refilter
  const cards = [...grid.querySelectorAll('.cc')];
  if (enter && !reduce) { const gaps = [0, 12, 9, 6, 4, 3]; let acc = 0; cards.forEach((c, i) => { acc += i === 0 ? 0 : (firstList ? (gaps[i] ?? 2) : .4) ; c.classList.add('enter'); c.style.animationDelay = (Math.min(acc, 60) / 30) + 's'; }); }
  if (io) io.disconnect();
  io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); const e = byId.get(en.target.dataset.id); ensureCase(e).then(() => queuePaint(en.target)); } }), {rootMargin: '300px'});
  cards.forEach(c => { paintCard(c); io.observe(c); bindHover(c); });
}
function badgeHTML(e) { const ch = e.o[ARMS.indexOf(state.arm)] || ' '; const [c, l] = ch === '1' ? ['ok', '✓ ' + t('succ')] : ch === '0' ? ['bad', '✗ ' + t('fail')] : ch === '?' ? ['un', '? ' + t('unknown')] : ch === '-' ? ['un', t('na')] : ['no', t('noRun')];
  return `<span class="ob ${c}" title="${t('arm')[state.arm]}">${l}</span>`; }
function stripHTML(e) { const shown = armsOf(setOfCase(e)); return ARMS.map((a, i) => { if (!shown.includes(a)) return ''; const ch = e.o[i] || ' '; const cls = ch === '1' ? 'ok' : ch === '0' ? '' : ch === '-' ? 'na' : ch === '?' ? 'un' : 'no'; const lab = ch === '1' ? t('succ') : ch === '0' ? t('fail') : ch === '-' ? t('na') : ch === '?' ? t('unknown') : t('noRun');
  return `<span class="${cls} ${a === state.arm ? 'sel' : ''}" style="--c:${ARMC[a]}" title="${t('arm')[a]}: ${lab}"></span>`; }).join(''); }
function caseTag(e) { return e.d === 'HO' ? t('orig') : e.d === 'HS' ? t('supp') : e.d === 'S1D' ? t('devS1') : e.d === 'S4D' ? `${t('devS4')} ${e.f}` : e.d === 'S2' ? `S2 ${t('bd')[e.bd]}` : e.d === 'S3' ? `S3 c=${e.c}` : e.d === 'S4' ? `S4 ${e.f}` : e.d === 'S1PP' ? 'S1″' : e.d === 'S2PP' ? `S2″ ${t('bd')[e.bd]}` : e.d; }
function cardHTML(e) {
  return `<a class="card cc" href="#case/${encodeURIComponent(e.id)}" data-id="${esc(e.id)}">
   <div class="hd"><span class="tile">${KN[e.k]}</span><span class="kn">${t('kname')[e.k]}</span><span class="chips">${e.v ? `<span class="chip acc">● ${t('video')}</span>` : ''}${badgeHTML(e)}</span></div>
   <h4>${esc(instr(e))}</h4>
   <div class="media"><canvas></canvas><span class="hud tr"><span class="rec"></span><span class="tt"></span></span><span class="hud bl"><i style="background:${ARMC[state.arm]}"></i><span class="armlab">${t('arm')[state.arm]}</span></span></div>
   <div class="ft"><span class="id">${esc(caseTag(e))} · ${esc(e.id.split(':')[2] || e.id)}</span><span class="strip">${stripHTML(e)}</span></div></a>`; }
/* paint queue: thumbnails are drawn a few per frame (about 8 ms of work), visible cards first; finished thumbnails are
   kept as bitmaps (bounded LRU) so re-filtering or switching back does not redraw them */
const pq = new Set(); let pqBusy = false;
function queuePaint(el) { pq.add(el); if (!pqBusy) { pqBusy = true; requestAnimationFrame(drainPaint); } }
function drainPaint() { const t0 = performance.now();
  for (const el of pq) { pq.delete(el); if (el.isConnected && !el._hover) paintCard(el); if (performance.now() - t0 > 8) break; }
  if (pq.size) requestAnimationFrame(drainPaint); else pqBusy = false; }
const thumbs = new Map(), THUMB_MAX = 240;
function paintCard(el) { const e = byId.get(el.dataset.id), cv = el.querySelector('canvas'); const det = caseReady(e);
  const key = det && `${e.id}|${state.arm}|${THEME}|${cv.clientWidth}x${cv.clientHeight}|${Math.min(2, window.devicePixelRatio || 1)}`;
  const hit = key && thumbs.get(key);
  if (hit) { const [g] = prep(cv); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(hit, 0, 0); thumbs.delete(key); thumbs.set(key, hit); }
  else {
    // the route shown is the arm chosen in the outcome selector (its own recorded trajectory)
    drawMap(cv, e, det, {small: true, pad: .45, arms: det ? [state.arm] : [], alpha: .8});
    if (key && cv.width) { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); thumbs.set(key, c);
      if (thumbs.size > THUMB_MAX) thumbs.delete(thumbs.keys().next().value); } }
  if (det) { const ae = det.arms[state.arm], lab = el.querySelector('.armlab');
    lab.textContent = t('arm')[state.arm] + (!ae ? ' · ' + t('noRun') : ae.na ? ' · ' + t('na') : ae.rs === 'COMPILE_REJECTED' ? ' · ' + t('rejected') : !ae.tr ? ' · ' + t('noTraj') : ''); } }
/* hover: draw-svg-trace style pen head grows along the selected arm's real trajectory (in-out), car follows */
function bindHover(el) { let stop = null; el.addEventListener('mouseenter', () => { el._hover = true; const e = byId.get(el.dataset.id); ensureCase(e).then(det => { if (!el._hover) return; const arm = state.arm, tr = traj(det.arms[arm]); if (!tr) return; const a = tr[0][0], b = tr[tr.length - 1][0], tt = el.querySelector('.tt'), cv = el.querySelector('canvas');
    stop = anim(66, f => { const tm = a + (b - a) * EASE.inOut(f / 66); drawMap(cv, e, det, {small: true, pad: .45, arms: [arm], t: tm, pen: true}); tt.textContent = `t ${tm.toFixed(2)} s`; }); }); });
  el.addEventListener('mouseleave', () => { el._hover = false; stop && stop(); const e = byId.get(el.dataset.id); const [x0, y0, x1, y1] = e.m.b; el.querySelector('.tt').textContent = ''; paintCard(el); }); }

/* ---------------- detail ---------------- */
function renderCase(id) {
  const e = byId.get(id); if (!e) { location.hash = 'list'; return; }
  const setLabel = `${t('setS')[setOfCase(e)]} · ${caseTag(e).replace(/^S\d″? /, '')}`;
  topbar(`<a href="#list">${t('list')}</a><i>/</i><a href="#list">${esc(setLabel)}</a><i>/</i><b>${esc(e.id)}</b>`);
  $('#page').innerHTML = `<div class="dhead"><a class="btn" href="#list" style="justify-self:start;height:32px;font-size:12.5px">← ${t('back')}</a>
   <div class="eyebrow"><span class="dot"></span>${KN[e.k]} ${t('kname')[e.k]} · ${esc(setLabel)}</div>
   <div class="dict" id="dict"><span class="mic" id="mic"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="2.5" width="6" height="10" rx="3"/><path d="M4 10a6 6 0 0 0 12 0M10 16v2"/></svg></span><h1 id="itext"></h1></div>
   <div class="dmeta"><span class="mono">${esc(e.id)}</span>${e.v ? `<span class="chip acc">● ${t('video')}</span>` : ''}<span class="chip ${e.ans ? 'ink' : 'dash'}">${e.ans ? t('ansOpen') : t('ansClosed')}</span></div></div>
   <div class="dgrid"><div style="min-width:0"><section class="card stagecard">
    <div class="stools">${seg('view', [['overlay', t('overlay')], ['split', t('split')], ['slider', t('slider')]], state.view, 'sm')}
     <button class="sw2 ${state.answer && e.ans ? 'on' : ''}" id="tAns" ${e.ans ? '' : 'disabled title="' + t('answerHidden') + '"'}><i></i>${t('answer')}</button>
     <button class="sw2 ${state.cand ? 'on' : ''}" id="tCand"><i></i>${t('cand')}</button></div>
    <div id="stageWrap"></div>
    <div class="scrub"><button class="play" id="play" aria-label="play"></button><div class="track" id="track"><div class="rail2"></div><div class="fill" id="tfill"></div><div class="knob" id="knob"></div><input type="range" id="trange" step="0.01" aria-label="time"></div><span class="tc" id="tc"></span></div>
   </section>${e.ans ? '' : `<p class="note">${t('answerHidden')}</p>`}</div>
   <aside class="side" id="side"></aside></div>`;
  typeInstr(instr(e));
  ensureCase(e).then(det => { if (route().id !== id) return; mountCase(e, det); });
}
/* glass-pill-dictation: pill lands, caret leads, text types at 2f/char, warm glow fades with progress */
function typeInstr(s) { const h = $('#itext'), d = $('#dict'), mic = $('#mic'); if (reduce) { h.textContent = s; mic.classList.add('idle'); return; }
  d.animate([{transform: 'scale(1.06)', filter: 'blur(4px)', opacity: 0}, {transform: 'scale(1)', filter: 'blur(0)', opacity: 1}], {duration: 600, easing: 'cubic-bezier(.16,1,.3,1)'});
  const chars = [...s], n = chars.length; d.style.setProperty('--glow', 1);
  const stop = anim(6 + n * 2 + 10, f => { const k = Math.max(0, Math.floor((f - 6) / 2)); h.innerHTML = esc(chars.slice(0, Math.min(n, k)).join('')) + (k < n + 4 ? '<span class="caret"></span>' : ''); d.style.setProperty('--glow', (1 - cl((f - 6) / (n * 2 + 10))).toFixed(2)); if (k >= n) mic.classList.add('idle'); });
  cleanup.push(stop); }
function mountCase(e, det) {
  const arms = ARMS.filter(a => det.arms[a]); const trs = arms.map(a => traj(det.arms[a])).filter(Boolean);
  const t0 = trs.length ? Math.min(...trs.map(tr => tr[0][0])) : 0, t1 = trs.length ? Math.max(...trs.map(tr => tr[tr.length - 1][0])) : 1;
  let tnow = t1, playing = false, retK = state.answer && e.ans ? 99 : -1, freeze = null;
  const cmd = det.arms.method && det.arms.method.t0 != null ? det.arms.method.t0 : (det.arms.v16 && det.arms.v16.t0) ?? t0;
  const ticks = [[cmd, t('spoke'), '']];
  if (e.k === '14' && e.u.corrected_at_s != null) ticks.push([cmd + e.u.corrected_at_s, t('corr'), '']);
  if (det.cand && det.cand.commit_t != null) ticks.push([det.cand.commit_t, t('commit'), 'c']);
  if (det.done_t != null) ticks.push([det.done_t, t('done'), '']);
  const range = $('#trange'); range.min = t0; range.max = t1; range.value = tnow;
  $('#track').insertAdjacentHTML('beforeend', ticks.filter(x => x[0] >= t0 && x[0] <= t1).map(x => `<span class="tick ${x[2]}" style="left:${(x[0] - t0) / (t1 - t0 || 1) * 100}%">${x[1]} ${x[0].toFixed(2)}</span>`).join(''));
  const playIcon = () => $('#play').innerHTML = playing ? '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor"/></svg>' : '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 1l8.5 5-8.5 5z" fill="currentColor"/></svg>'; playIcon();
  const visible = () => arms.filter(a => state.on[a]);
  let sliderPct = null;
  function buildStage() { const w = $('#stageWrap');
    if (state.view === 'split') { const vis = visible(); w.innerHTML = `<div class="splitgrid">${(vis.length ? vis : ['method']).map(a => { const ae = det.arms[a]; const r = rate(caseDs(e), e.k, a);
      return `<div class="sp"><div class="sh"><div><b style="color:${ARMC[a]}">${t('arm')[a]}</b><small>${a}</small></div><div class="rt" style="color:${ARMC[a]}">${r ? `${r.intent_success.success} / ${r.slots}<small style="display:block">${t('rateTitle').split('（')[0].split(' (')[0]}</small>` : ''}</div></div>
       <div class="stage"><canvas data-arm="${a}" style="height:230px"></canvas></div>
       <div class="st" style="background:${ae && ae.i ? 'var(--ink)' : 'var(--fill)'};color:${ae && ae.i ? 'var(--bg)' : 'var(--ink2)'}">${!ae ? t('noRun') : ae.na ? t('na') : `${t('hI')} ${ae.i === true ? '✓' : ae.i === false ? '✗' : '?'} · ${t('hL')} ${ae.l === true ? '✓' : ae.l === false ? '✗' : '?'} · ${t('hC')} ${ae.c === true ? '✓' : ae.c === false ? '✗' : '?'} · ${ae.rs}`}</div></div>`; }).join('')}</div>`; }
    else { w.innerHTML = `<div class="stage" id="stage"><canvas id="cv" style="height:${Math.round(Math.min(520, Math.max(300, w.clientWidth * .48)))}px"></canvas><span class="hud" style="left:12px;top:10px">${esc(e.id)}</span><span class="hud" id="tcode" style="right:12px;top:10px">● LIVE</span><div id="ann" style="position:absolute;inset:0;pointer-events:none"></div></div>`;
      if (state.view === 'slider') { const pair = sliderPair(); $('#stage').insertAdjacentHTML('beforeend', `<span class="ab" style="left:12px;background:${ARMC[pair[0]]};color:#fff">${t('arm')[pair[0]]}</span><span class="ab" style="right:12px;background:${ARMC[pair[1]]};color:#fff">${t('arm')[pair[1]]}</span><div class="slider-bar" id="sbar"><b><svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#17181C" stroke-width="1.6" stroke-linecap="round"><path d="M5 2 1 6l4 4M11 2l4 4-4 4"/></svg></b></div>`);
        const bar = $('#sbar'), st = $('#stage'); bar.onpointerdown = ev => { bar.setPointerCapture(ev.pointerId); const mv = m => { const r = st.getBoundingClientRect(); sliderPct = cl((m.clientX - r.left) / r.width) * 100; paint(); }; bar.onpointermove = mv; bar.onpointerup = () => { bar.onpointermove = null; }; };
        // before-after-slider-scrub: pre-pull to 6.5% (4f), fling to 76% (12f out), settle 70% (12f), hold 18f, slow scrub to rest (48f)
        const rest = 50; const pos = f => f < 10 ? 8 : f < 14 ? mix(8, 6.5, ramp(f, 10, 4, EASE.smooth)) : f < 26 ? mix(6.5, 76, ramp(f, 14, 12, EASE.out)) : f < 38 ? mix(76, 70, ramp(f, 26, 12, EASE.smooth)) : f < 56 ? 70 : mix(70, rest, ramp(f, 56, 48, EASE.smooth));
        cleanup.push(anim(104, f => { sliderPct = pos(f); paint(); })); } }
    paint(); }
  function sliderPair() { const v = visible().filter(a => a !== 'method'); return [v[0] || (arms.includes('goal_point') ? 'goal_point' : arms.find(a => a !== 'method')), 'method']; }
  function paint() { const vis = visible();
    if (state.view === 'split') document.querySelectorAll('#stageWrap canvas').forEach(cv => drawMap(cv, e, det, {arms: [cv.dataset.arm], t: tnow, cand: state.cand && cv.dataset.arm === 'method', answer: state.answer && e.ans, reticle: retK, pad: .25}));
    else if (state.view === 'slider') { const cv = $('#cv'); if (!cv) return; const pair = sliderPair(); const [g, W, H] = prep(cv);
      const off = document.createElement('canvas'); off.style.cssText = `position:absolute;width:${W}px;height:${H}px`; document.body.appendChild(off);
      drawMap(off, e, det, {arms: [pair[0]], t: tnow, answer: state.answer && e.ans, reticle: retK, pad: .25}); const left = document.createElement('canvas'); left.width = off.width; left.height = off.height; left.getContext('2d').drawImage(off, 0, 0);
      drawMap(off, e, det, {arms: [pair[1]], t: tnow, cand: state.cand, answer: state.answer && e.ans, reticle: retK, pad: .25});
      g.setTransform(1, 0, 0, 1, 0, 0); const px = cv.width * (sliderPct ?? 50) / 100; g.drawImage(left, 0, 0); g.save(); g.beginPath(); g.rect(px, 0, cv.width, cv.height); g.clip(); g.drawImage(off, 0, 0); g.restore(); off.remove();
      const bar = $('#sbar'); if (bar) bar.style.left = (sliderPct ?? 50) + '%'; }
    else { const cv = $('#cv'); if (cv) state._F = drawMap(cv, e, det, {arms: vis, t: tnow, cand: state.cand, answer: state.answer && e.ans, reticle: retK, pad: .25}); }
    const k = (tnow - t0) / (t1 - t0 || 1); $('#tfill').style.width = k * 100 + '%'; $('#knob').style.left = k * 100 + '%'; range.value = tnow;
    $('#tc').textContent = (freeze ? '❚❚ ' : '') + `t ${tnow.toFixed(2)} s`; const tc = $('#tcode'); if (tc) tc.textContent = playing ? (freeze ? `❚❚ ${t('commit').toUpperCase()}` : '● LIVE') : '❚❚'; }
  /* speed-ramp-freeze · freeze-annotate: instant stop at commit, frame corners 8f, circle 10f, note rises, hold, ease-in thaw */
  function annotate(f) { const ann = $('#ann'); if (!ann) return; if (f == null) { ann.innerHTML = ''; return; } const k = ramp(f, 0, 8, EASE.snappy) * (1 - ramp(f, 40, 10, EASE.swift)); const top = det.cand && det.cand.list.slice().sort((p, q) => q[4] - p[4])[0]; const F = state._F;
    const st = $('#stage'), W = st.clientWidth, H = $('#cv').clientHeight; const draw = ramp(f, 8, 10, EASE.swift), note = ramp(f, 14, 10, EASE.out);
    const corners = [[8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1]].map(([x, y, sx, sy]) => { const o = (1 - k) * -18; return `<path d="M${x + o * sx} ${y + o * sy + sy * 26} V${y + o * sy} H${x + o * sx + sx * 26}"/>`; }).join('');
    let circ = '', label = ''; if (top && F) { const cx = F.X(top[2]), cy = F.Y(top[3]); const i = det.cand.list.indexOf(top); circ = `<ellipse cx="${cx}" cy="${cy}" rx="30" ry="24" fill="none" stroke="#FF4F00" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="${108 * draw} 200" transform="rotate(-8 ${cx} ${cy})"/>`;
      label = `<div style="position:absolute;left:${Math.min(W - 230, cx + 38)}px;top:${Math.max(6, cy - 70 + (1 - note) * 12)}px;opacity:${note * k};background:#fff;border:1px solid var(--line2);box-shadow:var(--shadow-md);border-radius:10px;padding:7px 11px;font-size:13px;font-weight:650;color:var(--accent-ink)">${t('commitNote')} ${String.fromCharCode(65 + i)} · P ${(top[4] || 0).toFixed(2)}<div style="font:11px var(--mono);font-weight:400;color:var(--ink2)">${e.k === '07' ? '' : t('deadline')}</div></div>`; }
    ann.innerHTML = `<svg width="${W}" height="${H}" style="position:absolute;inset:0;opacity:${k}"><g stroke="#FF4F00" stroke-width="4" fill="none" stroke-linecap="round">${corners}</g>${circ}</svg>${label}<div style="position:absolute;inset:0;background:#fff;opacity:${f < 4 ? (1 - f / 4) * .45 : 0}"></div>`; }
  let stopPlay = null;
  function play() { if (playing) { playing = false; stopPlay && stopPlay(); freeze = null; annotate(null); playIcon(); paint(); return; }
    playing = true; playIcon(); if (tnow >= t1 - .01) tnow = t0; let last = performance.now(); const ct = det.cand && det.cand.commit_t; let frozeAt = null;
    const step = now => { if (!playing) return; const dt = (now - last) / 1000; last = now;
      if (frozeAt != null) { const f = (now - frozeAt) / 1000 * 30; annotate(f); if (f > 52) { frozeAt = null; freeze = null; annotate(null); } paint(); requestAnimationFrame(step); return; }
      const nt = Math.min(t1, tnow + dt); if (state.view === 'overlay' && ct != null && tnow < ct && nt >= ct && !reduce) { tnow = ct; frozeAt = now; freeze = true; paint(); requestAnimationFrame(step); return; }
      tnow = nt; paint(); if (tnow >= t1) { playing = false; playIcon(); if (state.answer && e.ans) { retK = 0; ret(); } return; } requestAnimationFrame(step); };
    requestAnimationFrame(step); stopPlay = () => { playing = false; }; }
  function ret() { cleanup.push(anim(60, f => { retK = f; paint(); })); }
  $('#play').onclick = play; cleanup.push(() => { playing = false; });
  range.oninput = () => { tnow = +range.value; if (playing) { playing = false; playIcon(); } freeze = null; annotate(null); paint(); };
  bindSeg('view', v => { state.view = v; buildStage(); });
  const tA = $('#tAns'); tA.onclick = () => { if (!e.ans) return; state.answer = !state.answer; tA.classList.toggle('on', state.answer); if (state.answer) { retK = 0; ret(); } else { retK = -1; paint(); } };
  const tC = $('#tCand'); tC.onclick = () => { state.cand = !state.cand; tC.classList.toggle('on', state.cand); paint(); };
  // side panel
  const yn = (v, na) => na ? `<span class="v u">—</span>` : v === true ? '<span class="v y">✓</span>' : v === false ? '<span class="v n">✗</span>' : '<span class="v u">?</span>';
  const have = armsOf(setOfCase(e)).filter(a => det.arms[a]);
  const presets = [[`${t('arm').method} · ${t('arm').nearest}`, ['method', 'nearest']], [`${t('arm').method} · v16`, ['method', 'v16']], [`${t('arm').method} · v2`, ['method', 'method_v2']], [`${t('arm').method} · ${t('arm').oracle_belief}`, ['method', 'oracle_belief']], [t('preAll'), have], [t('preNone'), []]];
  const cds = caseDs(e), rr = cds ? ARMS.map(a => [a, rate(cds, e.k, a)]).filter(x => x[1]) : [];
  $('#side').innerHTML = `<section class="card"><div class="card-h"><span class="tile">≡</span><h3>${t('arms')}</h3><span class="more"></span></div>
   <div class="armh"><span></span><span>${t('arms')}</span><span>${t('hI')}</span><span>${t('hL')}</span><span>${t('hC')}</span><span>${t('hT')}</span></div>
   <div class="presets"><span class="flab" style="align-self:center">${t('pre')}</span>${presets.filter(p => p[1].every(a => det.arms[a])).map((p, i) => `<button data-pre="${i}">${p[0]}</button>`).join('')}</div>
   ${armsOf(setOfCase(e)).map((a, i, xs) => { const grp = x => ARM_GROUPS.find(g => g[1].includes(x)); const g = grp(a); const head = g && (i === 0 || grp(xs[i - 1]) !== g) ? `<div class="armg">${t(g[0])}</div>` : ''; const ae = det.arms[a]; if (!ae) return head + `<div class="armrow off" style="--c:${ARMC[a]}"><span class="sq"></span><span class="nm">${t('arm')[a]}<code>${a} · ${t('noRun')}</code></span><span></span><span></span><span></span><span></span></div>`;
     return head + `<button class="armrow ${state.on[a] ? '' : 'off'}" data-a="${a}" style="--c:${ARMC[a]}" title="${esc(ae.fs || '')}"><span class="sq"></span><span class="nm">${t('arm')[a]}<code>${a}${ae.na ? ' · ' + t('na') : ' · ' + ae.rs}</code></span>${yn(ae.i, ae.na)}${yn(ae.l, ae.na)}${yn(ae.c, ae.na)}<span class="t">${ae.t == null ? '—' : (+ae.t).toFixed(2)}</span></button>`; }).join('')}
   ${e.m.img ? `<div class="note src" style="padding:0 16px 14px">${e.m.c.map((c, i) => `d${i + 1} = ${esc(c[0])}`).join('<br>')}</div>` : ''}</section>
   ${rr.length ? `<section class="card"><div class="card-h"><span class="tile">${KN[e.k]}</span><h3>${t('rateTitle')}</h3><span class="more">${esc(dsLabel(cds))}</span></div><div class="rows" style="padding-bottom:6px">${rr.sort((p, q) => q[1].intent_success.success - p[1].intent_success.success).map(([a, r]) => `<div class="row ${a === 'method' ? 'me' : ''}" style="--c:${ARMC[a]}"><span class="share" style="width:${r.intent_success.success / r.slots * 100}%"></span><span class="sw" style="background:${ARMC[a]}"></span><span class="nm">${t('arm')[a]}</span><span class="val"><b>${r.intent_success.success}</b> / ${r.slots}${r.intent_success.unknown ? ` · ${t('unknown')} ${r.intent_success.unknown}` : ''}</span></div>`).join('')}</div></section>` : ''}
   ${e.v && META.videos[e.id] ? `<a class="card kf" href="${META.videos[e.id][L] || META.videos[e.id].zh}" target="_blank" rel="noopener"><img src="${META.videos[e.id][L] || META.videos[e.id].zh}" alt="${t('kfTitle')}" loading="lazy"><div class="c"><b>${t('kfTitle')} · ${esc(e.v)}</b><br>${t('kfCap')}</div></a>` : ''}`;
  document.querySelectorAll('#side [data-pre]').forEach(b => b.onclick = () => { const on = presets.filter(p => p[1].every(a => det.arms[a]))[+b.dataset.pre][1]; ARMS.forEach(a => { state.on[a] = on.includes(a) ? 1 : 0; }); document.querySelectorAll('#side .armrow[data-a]').forEach(r => r.classList.toggle('off', !state.on[r.dataset.a])); if (state.view === 'overlay') paint(); else buildStage(); });
  document.querySelectorAll('#side .armrow[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a; state.on[a] = !state.on[a]; b.classList.toggle('off', !state.on[a]); if (state.view === 'overlay') paint(); else buildStage(); });
  buildStage(); const onR = () => buildStage(); window.addEventListener('resize', onR); cleanup.push(() => window.removeEventListener('resize', onR));
  if (state.answer && e.ans) { retK = 0; ret(); }
}

/* ---------------- overview ---------------- */
const DS_ALL = ['holdout', 'holdout_original', 'holdout_supplement', 'mismatch', 'night_primary', 'night_D_exposed', 'S1', 'S2', 'S2:hospital', 'S2:office', 'S3', 'S3:c=0.15', 'S3:c=0.35', 'S4_F0', 'S4_F1', 'S4_F2', 'S4_F3', 'S4_F4', 'S4_F5', 'S4_F6'];
/* cases behind a statistics dataset (for the per-case dots); null when the dataset is not a set of library cases */
function dsCases(ds) { if (ds === 'holdout') return e => e.d === 'HO' || e.d === 'HS'; if (ds === 'holdout_original') return e => e.d === 'HO'; if (ds === 'holdout_supplement') return e => e.d === 'HS';
  if (ds === 'S1' || ds === 'S2' || ds === 'S3') return e => e.d === ds; if (ds.startsWith('S2:')) return e => e.d === 'S2' && e.bd === ds.slice(3); if (ds.startsWith('S3:')) return e => e.d === 'S3' && 'c=' + e.c === ds.slice(3);
  if (ds.startsWith('S4_')) return e => e.d === 'S4' && e.f === ds.slice(3); return null; }
function renderOverview() {
  topbar(`<a href="#list">${t('list')}</a><i>/</i><b>${t('overview')}</b>`);
  const dsList = DS_ALL.filter(d => META.rates.some(r => r.dataset === d));
  const countRows = [['HO', e => e.d === 'HO'], ['HS', e => e.d === 'HS'], ['S1', e => e.d === 'S1'], ['S2 · ' + t('bd').hospital, e => e.d === 'S2' && e.bd === 'hospital'], ['S2 · ' + t('bd').office, e => e.d === 'S2' && e.bd === 'office'],
    ...subOpts('S3').map(c => ['S3 · ' + c, e => e.d === 'S3' && 'c=' + e.c === c]), ...subOpts('S4').map(f => ['S4 · ' + t('fam')[f], e => e.d === 'S4' && e.f === f]), ['S1″', e => e.d === 'S1PP'], ['S2″ · ' + t('bd').hospital, e => e.d === 'S2PP' && e.bd === 'hospital'], ['S2″ · ' + t('bd').office, e => e.d === 'S2PP' && e.bd === 'office'], ['S1D', e => e.d === 'S1D'], ['S4D', e => e.d === 'S4D']]
    .map(([l, f]) => [l === 'HO' ? `${t('holdout')} · ${t('orig')}` : l === 'HS' ? `${t('holdout')} · ${t('supp')}` : l === 'S1D' ? t('devS1') : l === 'S4D' ? t('devS4') : l, IDX.filter(f)]);
  const kinds = KINDS.filter(k => IDX.some(e => e.k === k));
  $('#page').innerHTML = `<section class="hero"><div><div class="eyebrow"><span class="dot"></span>${t('eyebrowList')}</div><h1 class="h">${t('ovTitle')}</h1>
   <div class="lede" style="font-size:19px;color:var(--ink);margin-top:16px;line-height:1.7">${t('heroA')(kinds.length)} · ${t('heroB')(ARMS.length)} · ${fmt(IDX.length)} ${t('stCases')}</div><p class="lede">${t('ovLede')}</p></div>
  <figure class="field"><figcaption class="fh"><b>${t('heroT')}</b><span>${t('heroS')(META.hero.length)}</span></figcaption>
   <div class="fc"><canvas id="field"></canvas><div class="ftip" id="ftip" hidden></div></div>
   <div class="fl"><span><i style="background:var(--accent)"></i>${t('hOk')}</span><span><i style="background:var(--hero-no-dot)"></i>${t('hNo')}</span><span><i class="dot0"></i>${t('hStart')}</span><span class="hint">${t('hHint')}</span></div></figure></section>
  <div class="ovgrid" style="margin-top:22px">
   <section class="card span12"><div class="card-h"><span class="tile">#</span><h3>${t('counts')}</h3><span class="more">${t('countsSrc')}</span></div>
    <div class="tbl"><table class="t"><thead><tr><th>${t('sets')}</th>${kinds.map(k => `<th>${KN[k]}</th>`).join('')}<th>${t('total')}</th></tr></thead><tbody>
    ${countRows.map(([l, xs]) => `<tr><td>${esc(l)}</td>${kinds.map(k => `<td class="c">${xs.filter(e => e.k === k).length || '—'}</td>`).join('')}<td class="c"><b>${fmt(xs.length)}</b></td></tr>`).join('')}
    <tr class="tot"><td>${t('total')}</td>${kinds.map(k => `<td class="c">${fmt(IDX.filter(e => e.k === k).length)}</td>`).join('')}<td class="c" title="LIBRARY_MANIFEST cases ${fmt(META.manifest.cases)}"><b>${fmt(IDX.length)}</b></td></tr>
    </tbody></table></div><div class="note src">${esc(pubSrc(META.sources.cases))} · ${esc(pubSrc(META.sources.manifest))}</div></section>
   <section class="card span12"><div class="card-h"><span class="tile">%</span><h3>${t('rates')}</h3><span class="more" style="margin-left:auto"><select class="pick" id="dsSel" aria-label="${t('dsPick')}">${dsList.map(d => `<option value="${d}" ${state.ovDs === d ? 'selected' : ''}>${esc(dsLabel(d))}</option>`).join('')}</select></span></div>
    <p class="note">${t('ratesNote2')}</p><div class="tbl" id="ratesTbl"></div><div class="note src" id="ratesSrc"></div></section>
   <section class="card span12" id="dotsCard"><div class="card-h"><span class="tile">∴</span><h3>${t('dotsTitle')}</h3><span class="more" id="dotsLab"></span></div><p class="note">${t('dotsNote')}</p><div class="dots"><canvas id="dots"></canvas></div><div class="note src" id="dotsSrc"></div></section>
   <section class="card span12 fam"><div class="card-h"><span class="tile">F</span><h3>${t('famCard')}</h3></div><img src="scenario_families_F1-F6.svg" alt="${t('famCard')}"><div class="dl"><a class="btn" href="scenario_families_F1-F6.png" target="_blank">PNG</a><a class="btn" href="scenario_families_F1-F6.pdf" target="_blank">PDF</a><span class="src">${t('famNote2')}</span></div></section>
   <section class="card span12"><div class="card-h"><span class="tile">i</span><h3>${t('srcT')}</h3><span class="more">${esc(META.built_utc)}</span></div>
    <div class="tbl"><table class="t" style="min-width:0"><tbody>    ${[...new Set(Object.values(META.sources).map(pubSrc))].map(s => `<tr><td class="c" style="text-align:left;white-space:normal">${esc(s)}</td></tr>`).join('')}</tbody></table></div><div style="height:12px"></div></section>
   <section class="card span12"><div class="card-h"><span class="tile">▶</span><h3>${t('vidsTitle')}</h3></div>
    <div class="vidgrid">${Object.entries(META.videos).map(([id, v]) => `<a class="vid" href="#case/${encodeURIComponent(id)}"><img src="${v[L] || v.zh}" alt="${esc(v.clip)}" loading="lazy"><div><b>${KN[v.kind]} ${esc(v.clip)}</b><code>${esc(id)}</code></div></a>`).join('')}</div><div class="note src">${esc(pubSrc(META.sources.videos))}</div></section>
  </div>`;
  $('#dsSel').onchange = ev => { state.ovDs = ev.target.value; const ks = ratesTable(); if (!ks.includes(state.dot[0])) state.dot[0] = ks[0] || '01'; dots(false); };
  const ks = ratesTable(); if (!ks.includes(state.dot[0])) state.dot[0] = ks[0] || '01'; dots(true); heroField();
}
function ratesTable() { const ds = state.ovDs, rows = META.rates.filter(r => r.dataset === ds); const cats = [...new Set(rows.map(r => r.category))]; const kinds = KINDS.filter(k => cats.includes(k)), extra = cats.filter(c => !KINDS.includes(c) && c !== 'ALL');
  const arms = ARMS.filter(a => rows.some(r => r.arm === a)), rowsK = [...kinds, ...extra, 'ALL'], cf = dsCases(ds);
  $('#ratesTbl').innerHTML = `<table class="t"><thead><tr><th></th>${arms.map(a => `<th style="color:${a === 'method' ? 'var(--accent-ink)' : ''}">${t('arm')[a]}</th>`).join('')}</tr></thead><tbody>${rowsK.map(k => `<tr class="${k === 'ALL' ? 'tot' : ''}"><td>${k === 'ALL' ? t('total') : KN[k] ? `${KN[k]} ${t('kname')[k]}` : esc(k)}</td>${arms.map(a => { const r = rows.find(x => x.category === k && x.arm === a); if (!r) return '<td class="c">—</td>'; const s = r.intent_success; const pct = r.slots ? s.success / r.slots * 100 : 0;
    const est = s.estimate != null ? `${t('estTip')} ${(s.estimate * 100).toFixed(1)}%${s.ci95 ? ` [${(s.ci95[0] * 100).toFixed(1)}, ${(s.ci95[1] * 100).toFixed(1)}]` : ''}` : (s.group_bootstrap && s.group_bootstrap.estimate != null ? `${t('estTip')} ${(s.group_bootstrap.estimate * 100).toFixed(1)}%` : '');
    const clickable = cf && KINDS.includes(k); const sel = clickable && state.dot[0] === k && state.dot[1] === a;
    return `<td class="c ${a === 'method' ? 'me' : ''} ${clickable ? 'cl' : ''} ${sel ? 'sel' : ''}" data-k="${k}" data-a="${a}" title="${esc(r.scope)}${est ? ' · ' + est : ''}">${s.success} / ${r.slots}${s.unknown ? `<span class="u">${t('unknown')} ${s.unknown}</span>` : ''}<span class="bar"><i style="width:${pct}%"></i></span></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  $('#ratesSrc').textContent = [...new Set(rows.map(r => pubSrc(r.src)))].join(' · ');
  document.querySelectorAll('#ratesTbl td.cl').forEach(td => td.onclick = () => { state.dot = [td.dataset.k, td.dataset.a]; ratesTable(); dots(false); document.getElementById('dotsCard').scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'center'}); });
  return kinds; }
/* unit-dot-swarm-regroup: one dot per case, grouped by B outcome; columns stack bottom-up, later rows faster; spring settle */
let dotState = null;
function dots(first) { const cv = $('#dots'); if (!cv) return; const ds = state.ovDs, cf = dsCases(ds); const card = $('#dotsCard'); card.hidden = !cf; if (!cf) return;
  if (!META.rates.some(r => r.dataset === ds && r.arm === state.dot[1])) state.dot[1] = 'method';
  const [k, a] = state.dot, ai = ARMS.indexOf(a); const cases = IDX.filter(e => cf(e) && e.k === k);
  const r = rate(ds, k, a); $('#dotsSrc').textContent = pubSrc(ds.startsWith('holdout') ? META.sources.scores_lock : META.sources.scores_S) + ' · ' + dsLabel(ds); $('#dotsLab').innerHTML = `${KN[k]} ${t('kname')[k]} · <b style="color:${ARMC[a]}">${t('arm')[a]}</b>${r ? ` · ${r.intent_success.success} / ${r.slots}` : ''}`;
  const groups = [['1', t('succ'), ARMC[a]], ['0', t('fail'), MAP.dFail], ['?', t('unknown'), MAP.dUnk], ['-', t('na'), MAP.dNa]];
  const [g, W, H] = prep(cv); const R = 4.2, P = 11, colsPer = Math.max(6, Math.floor((W / 4 - 30) / P)); const pos = new Map();
  groups.forEach(([ch], gi) => { const xs = cases.filter(e => (e.o[ai] || ' ') === ch || (ch === '-' && e.o[ai] === ' ')); xs.forEach((e, i) => { const col = i % colsPer, row = Math.floor(i / colsPer); pos.set(e.id, [gi * W / 4 + 16 + col * P + R, H - 34 - row * P]); }); });
  const prev = dotState && dotState.pos; const st = performance.now(); dotState = {pos, cases, groups, W, H, ai};
  const startOf = id => prev && prev.get(id) || [W / 2 + (Math.sin(id.length * 97 + id.charCodeAt(id.length - 1) * 13) * .5) * W * .8, H / 2 + Math.cos(id.charCodeAt(id.length - 3) * 7) * H * .35];
  const frame = f => { g.clearRect(0, 0, W, H); g.font = '600 12px ' + SANS; groups.forEach(([ch, lab, col], gi) => { g.fillStyle = MAP.hud; const n = r ? (ch === '1' ? r.intent_success.success : ch === '0' ? r.intent_success.failure : ch === '?' ? r.intent_success.unknown : r.not_applicable) : null; g.fillText(`${lab}${n != null ? ' · ' + n : ''}`, gi * W / 4 + 16, H - 10); });
    cases.forEach((e, i) => { const [tx, ty] = pos.get(e.id); const [sx, sy] = startOf(e.id); const row = Math.round((H - 34 - ty) / P); const d0 = (i % 24) * .35 + row * .15; const k2 = reduce ? 1 : cl((f - d0) / Math.max(8, 22 - row * .5)); const sp = 1 - Math.exp(-6 * k2) * Math.cos(9 * k2 * .55) * (1 - k2);
      const x = mix(sx, tx, sp), y = mix(sy, ty, sp); const ch = e.o[ai] || ' '; g.fillStyle = ch === '1' ? ARMC[a] : ch === '0' ? MAP.dFail : ch === '?' ? MAP.dUnk : MAP.dNa; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); }); };
  cleanup.push(anim(first ? 70 : 50, frame));
  cv.onclick = ev => { const rc = cv.getBoundingClientRect(), mx = ev.clientX - rc.left, my = ev.clientY - rc.top; let best = null, bd = 64; for (const [id, [x, y]] of pos) { const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = id; } } if (best) location.hash = 'case/' + encodeURIComponent(best); };
  cv.onmousemove = ev => { const rc = cv.getBoundingClientRect(), mx = ev.clientX - rc.left, my = ev.clientY - rc.top; let hit = false; for (const [, [x, y]] of pos) if ((x - mx) ** 2 + (y - my) ** 2 < 36) { hit = true; break; } cv.style.cursor = hit ? 'pointer' : 'default'; }; }

/* ---------------- analysis (data/analysis.js) ---------------- */
function renderAnalysis(anchor) {
  const A = window.SL_ANALYSIS; const z = L === 'zh'; const tx = o => o ? (z ? o.zh : o.en) : '';
  topbar(`<a href="#list">${t('list')}</a><i>/</i><b>${z ? '分析' : 'Analysis'}</b>`);
  if (!A) { $('#page').innerHTML = `<p class="note">data/analysis.js missing</p>`; return; }
  const chip = c => `<span class="chip ${c.k === 'acc' ? 'acc' : 'dash'}">${esc(tx(c))}</span>`;
  const src = xs => `<details class="srcs"><summary>${z ? '数据来源' : 'Sources'} · ${xs.length}</summary><ul>${xs.map(x => `<li>${esc(pubSrc(x))}</li>`).join('')}</ul></details>`;
  const fig = id => `analysis/${id}_${z ? 'zh' : 'double'}.png`;
  const item = (it, ci) => {
    const head = `<div class="ah"><h3>${esc(z ? it.zh : it.en)}</h3>${(it.chips || []).map(chip).join('')}</div>`;
    if (it.card) return `<article class="card acard status">${head}<ul class="facts">${it.facts.map(f => `<li>${esc(tx(f))}</li>`).join('')}</ul>${src(it.src)}</article>`;
    const tbl = it.rows ? `<div class="tbl"><table class="t rel"><thead><tr><th>${z ? '标准' : 'Criterion'}</th><th>${z ? '状态' : 'Status'}</th><th>${z ? '依据（报告原文）' : 'Basis (report text, Chinese)'}</th></tr></thead><tbody>${it.rows.map(r => `<tr><td>${esc(r[0])}</td><td><span class="chip acc">${z ? r[1] : r[1] === '部分做到' ? 'partly met' : esc(r[1])}</span></td><td class="basis">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>` : '';
    const img = it.rows ? '' : `<a class="afig" href="${fig(it.fig)}" target="_blank" rel="noopener"><img src="${fig(it.fig)}" alt="${esc(z ? it.zh : it.en)}" loading="lazy"></a>`;
    return `<article class="card acard" id="a-${it.fig}">${head}${img}
      ${it.text ? `<p class="atext">${esc(tx(it.text))}</p>` : ''}${tbl}<div class="afoot">${src(it.src)}<code>${it.fig}</code></div></article>`; };
  $('#page').innerHTML = `<section class="shead"><div class="sh-l"><div class="eyebrow"><span class="dot"></span>${z ? '数据分析' : 'Data analysis'}</div>
    <h1 class="h">${z ? '分析' : 'Analysis'}</h1><p class="lede">${z ? '每节一张图或一张表，加两三句说明；每个数字的来源写在卡片下方。' : 'One figure or table per item with a few plain sentences; the source of every number is listed under each card.'}</p>
    <nav class="atoc">${A.chapters.map(c => `<a href="#analysis/${c.id}">${c.no} · ${esc(z ? c.zh : c.en)}</a>`).join('')}</nav></div></section>
   ${A.chapters.map(c => `<section class="achap" id="ch-${c.id}"><div class="ach"><span class="tile">${c.no}</span><h2>${esc(z ? c.zh : c.en)}</h2></div>${c.lede ? `<p class="lede">${esc(tx(c.lede))}</p>` : ''}
     <div class="agrid ${c.id === 'earlier' ? 'small' : ''}">${c.items.map(item).join('')}</div></section>`).join('')}
   <p class="afootnote">${esc(tx(A.footer))}</p>`;
  if (anchor) { const el = document.getElementById('ch-' + anchor); if (el) setTimeout(() => el.scrollIntoView({block: 'start'}), 30); }
}

/* ---------------- boot ---------------- */
document.documentElement.lang = L === 'zh' ? 'zh-CN' : 'en';
document.addEventListener('keydown', ev => { if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); const q = $('#q'); q && q.focus(); } });
$('#scrim').onclick = closeNav;
render();
})();
