#!/usr/bin/env python3
"""Rebuild the scenario-library web data from read-only branch snapshots.

Reads (never writes) other branches through git objects:
  B  codex/kappa-facts-20261028
       research/scenario_library/library_index.json        cases of every set (JSON Lines)
       research/scenario_library/LIBRARY_MANIFEST.json     per-set counts
       research/locked_eval_stats_20261104/CP_B3_20261030/{scores.jsonl,statistics.json}   locked holdout
       research/fresh_tests_20261101/scores/S{1,2,3}_SCORES.jsonl, statistics/{SUMMARY,STRATIFIED}   S1-S3
       research/fresh_tests_20261101/S4_scores/S4_F*_SCORES.jsonl, S4_statistics/{SUMMARY,STRATIFIED}  S4
  C  codex/junction-decision-20261028
       raw run records named by each B score (source_file / source_record) and their diagnostic_log_path
       tools/eval/truth/{hospital,office}_truth.npz        S2 building occupancy (0.1 m)
  D  codex/isaac-video-20261029
       research/isaac_video_20261029/mechanism_20261031/{selection.json,series_selection.json,frames/}

Writes only under the web directory:
  data/meta.js, data/index.js, data/cases/<shard>.js (scores), data/traj/<shard>__<n>.js (encoded trajectories), data/maps/<scene>.js, frames/*.png

Fetch the refs first (read-only):
  git fetch origin +refs/heads/<branch>:refs/remotes/origin/<branch>
or pass --fetch.

Usage:
  python3 tools/build_data.py                    # every trajectory (default)
  python3 tools/build_data.py --s-traj 30        # only 30 cases per (set, kind, building / c / family) in S1-S4
"""
import argparse, base64, gzip, io, json, os, subprocess, time
from collections import Counter, defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)

B_REF = 'origin/codex/kappa-facts-20261028'
C_REF = 'origin/codex/junction-decision-20261028'
D_REF = 'origin/codex/isaac-video-20261029'
LIB = 'research/scenario_library/library_index.json'
LIB_MANIFEST = 'research/scenario_library/LIBRARY_MANIFEST.json'
LOCK_DIR = 'research/locked_eval_stats_20261104/CP_B3_20261030'
FRESH = 'research/fresh_tests_20261101'
D_DIR = 'research/isaac_video_20261029/mechanism_20261031'
TRUTH = 'tools/eval/truth/{}_truth.npz'

# display order; every arm that appears in any B score file
ARMS = ['v16', 'fixed', 'goal_point', 'nearest', 'snap', 'method', 'no_keep', 'no_speed', 'always_slow',
        'method_v2', 'method_v2_k', 'oracle', 'oracle_belief']
FAMILIES = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6']


def set_of(dataset):
    """library dataset -> (web set key, B score dataset name or None)."""
    if dataset == 'locked_holdout_original':
        return 'HO', 'holdout_original'
    if dataset == 'locked_holdout_supplement':
        return 'HS', 'holdout_supplement'
    if dataset == 'S1_development':
        return 'S1D', None
    if dataset.startswith('S4_') and dataset.endswith('_development'):
        return 'S4D', None
    if dataset.startswith('S4_F'):
        return 'S4', dataset
    if dataset in ('S1', 'S2', 'S3'):
        return dataset, dataset
    raise KeyError(dataset)


# mechanism video clip name per kind (D VIDEO_SELECTION.md table; selected case ids are read from D json files)
CLIP_BY_KIND = {'01': 'door', '07': 'uturn', '14': 'correction', '02': 'encounter', '06': 'continuation', '05': 'corridor_end'}


def sh(*args, **kw):
    return subprocess.check_output(args, cwd=kw.get('cwd'), text=True)


class Git:
    """Batch blob reader over `git cat-file --batch`."""

    def __init__(self, repo):
        self.repo = repo
        self.p = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=repo, stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    def read(self, ref, path):
        self.p.stdin.write(f'{ref}:{path}\n'.encode()); self.p.stdin.flush()
        header = self.p.stdout.readline().decode()
        if header.endswith('missing\n'):
            return None
        size = int(header.split()[2])
        data = self.p.stdout.read(size); self.p.stdout.read(1)
        return data

    def jsonl(self, ref, path):
        blob = self.read(ref, path)
        return [json.loads(l) for l in blob.decode().splitlines() if l.strip()] if blob else []

    def commit(self, ref):
        return sh('git', 'rev-parse', ref, cwd=self.repo).strip()


def rdp(pts, eps):
    """Iterative Ramer-Douglas-Peucker on an (n, d) array; returns kept indices."""
    n = len(pts)
    if n < 3:
        return list(range(n))
    keep = np.zeros(n, bool); keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        seg = pts[b] - pts[a]
        L = np.dot(seg, seg)
        rel = pts[a + 1:b] - pts[a]
        if L == 0:
            d = np.sqrt((rel ** 2).sum(1))
        else:
            t = np.clip(rel @ seg / L, 0, 1)
            d = np.sqrt(((rel - np.outer(t, seg)) ** 2).sum(1))
        i = int(np.argmax(d))
        if d[i] > eps:
            m = a + 1 + i
            keep[m] = True
            stack += [(a, m), (m, b)]
    return list(np.nonzero(keep)[0])


def pack_traj(tr):
    """[t,x,y,yaw,...] samples -> flat ints [t_cs, x_cm, y_cm, yaw_crad, ...].
    Simplified in (x, y, 1.0*t, 0.15*yaw) with eps 0.005: time-aligned position error < 1 cm on checked cases."""
    a = np.array([[p[0], p[1], p[2], p[3]] for p in tr], float)
    if len(a) == 0:
        return []
    a[:, 3] = np.unwrap(a[:, 3])
    feat = np.column_stack([a[:, 1], a[:, 2], a[:, 0] * 1.0, a[:, 3] * 0.15])
    out = []
    for i in rdp(feat, 0.005):
        t, x, y, yaw = a[i]
        out += [int(round(t * 100)), int(round(x * 100)), int(round(y * 100)), int(round(yaw * 100))]
    return out


def encode_traj(flat):
    """Flat ints [t_cs, x_cm, y_cm, yaw_crad, ...] -> base64 string of zigzag varints of the deltas between consecutive samples
    (lossless; decoded by trajDecode() in assets/app.js)."""
    out, prev = bytearray(), [0, 0, 0, 0]
    for i in range(0, len(flat), 4):
        for j in range(4):
            d = flat[i + j] - prev[j]
            prev[j] = flat[i + j]
            n = (d << 1) ^ (d >> 63)
            while True:
                b = n & 0x7F
                n >>= 7
                if n:
                    out.append(b | 0x80)
                else:
                    out.append(b)
                    break
    return base64.b64encode(bytes(out)).decode()


CHUNK = 40   # cases per trajectory chunk file (data/traj/<shard>__<n>.js), loaded when a card scrolls into view


def r3(v):
    return None if v is None else round(float(v), 3)


def compact_case(r):
    m = r['map']
    cands = [[c['id'], r3(c['center'][0]), r3(c['center'][1]), r3(c['tangent'][0]), r3(c['tangent'][1]),
              r3(c['inward'][0]), r3(c['inward'][1]), r3(c['width_m']), r3(c.get('depth_m'))] for c in r['candidates']]
    out = {'b': [r3(v) for v in m['bounds']], 'r': [[r3(v) for v in q] for q in m.get('free_rectangles') or []],
           'o': [[r3(v) for v in q] for q in (r.get('obstacles') or [])], 's': [r3(v) for v in r['start']], 'c': cands}
    if m.get('scene'):
        out['img'] = m['scene']
    return out


def s2_view(entry, pts, scene_bounds):
    """Crop window for a building case: start, candidates, target and any recorded trajectory points, padded."""
    xs = [entry['m']['s'][0]] + [c[1] for c in entry['m']['c']] + [p[0] for p in pts]
    ys = [entry['m']['s'][1]] + [c[2] for c in entry['m']['c']] + [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs) - 3, max(xs) + 3, min(ys) - 3, max(ys) + 3
    for lo, hi, i in ((x0, x1, 0), (y0, y1, 1)):
        if hi - lo < 10:
            c = (hi + lo) / 2
            lo, hi = c - 5, c + 5
        if i == 0:
            x0, x1 = lo, hi
        else:
            y0, y1 = lo, hi
    bx0, by0, bx1, by1 = scene_bounds
    return [r3(max(bx0, x0)), r3(max(by0, y0)), r3(min(bx1, x1)), r3(min(by1, y1))]


def raster_js(npz_bytes, name):
    """Truth occupancy -> run-length codes (0 unknown, 1 free, 2 occupied), rows from the bottom (y = origin)."""
    z = np.load(io.BytesIO(npz_bytes), allow_pickle=False)
    occ, free = z['occupied'], z['free']
    code = np.zeros(occ.shape, np.uint8); code[free] = 1; code[occ] = 2
    flat = code.ravel()
    runs, i, n = [], 0, len(flat)
    change = np.flatnonzero(np.diff(flat)) + 1
    starts = np.concatenate([[0], change]); ends = np.concatenate([change, [n]])
    for s, e in zip(starts, ends):
        runs += [int(flat[s]), int(e - s)]
    obj = {'w': int(code.shape[1]), 'h': int(code.shape[0]), 'ox': float(z['origin'][0]), 'oy': float(z['origin'][1]),
           'res': float(z['resolution']), 'bounds': [float(v) for v in z['bounds']], 'rle': runs}
    return obj


def rate_row(dataset, category, scope, src, row):
    keep = ('arm', 'slots', 'applicable', 'not_applicable', 'run_statuses', 'intent_success', 'literal_success')
    out = {'dataset': dataset, 'category': category, 'scope': scope, 'src': src}
    out.update({k: row.get(k) for k in keep})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default=None)
    ap.add_argument('--b-ref', default=B_REF)
    ap.add_argument('--c-ref', default=C_REF)
    ap.add_argument('--d-ref', default=D_REF)
    ap.add_argument('--fetch', action='store_true', help='git fetch the three read-only branches first')
    ap.add_argument('--lock-traj', type=int, default=0, help='locked holdout: 0 = every case; N = N cases per (set, kind)')
    ap.add_argument('--s-traj', type=int, default=0, help='S1-S4: trajectories for N cases per (set, kind, building/c/family); 0 = all')
    args = ap.parse_args()
    repo = args.repo or sh('git', 'rev-parse', '--show-toplevel', cwd=HERE).strip()
    if args.fetch:
        for ref in (args.b_ref, args.c_ref, args.d_ref):
            br = ref.split('origin/', 1)[1]
            subprocess.check_call(['git', 'fetch', 'origin', f'+refs/heads/{br}:refs/remotes/origin/{br}'], cwd=repo)
    g = Git(repo)
    commits = {k: g.commit(v) for k, v in (('B', args.b_ref), ('C', args.c_ref), ('D', args.d_ref))}
    Bs = commits['B'][:9]
    t_start = time.time()

    # ---------- B: cases + scores ----------
    lib = g.jsonl(args.b_ref, LIB)
    manifest = json.loads(g.read(args.b_ref, LIB_MANIFEST))
    score_files = [f'{LOCK_DIR}/scores.jsonl'] + [f'{FRESH}/scores/{s}_SCORES.jsonl' for s in ('S1', 'S2', 'S3')] + \
                  [f'{FRESH}/S4_scores/S4_{f}_SCORES.jsonl' for f in FAMILIES]
    scores, strata = {}, {}
    for path in score_files:
        for s in g.jsonl(args.b_ref, path):
            scores[(s['dataset'], s['case_id'], s['arm'])] = s
            if s.get('strata'):
                strata[(s['dataset'], s['case_id'])] = s['strata']
    lock_stats = json.loads(g.read(args.b_ref, f'{LOCK_DIR}/statistics.json'))
    fresh_sum = json.loads(g.read(args.b_ref, f'{FRESH}/statistics/SUMMARY.json'))
    fresh_str = g.jsonl(args.b_ref, f'{FRESH}/statistics/STRATIFIED.jsonl')
    s4_sum = json.loads(g.read(args.b_ref, f'{FRESH}/S4_statistics/SUMMARY.json'))
    s4_str = g.jsonl(args.b_ref, f'{FRESH}/S4_statistics/STRATIFIED.jsonl')

    # ---------- C: building rasters for S2 ----------
    os.makedirs(os.path.join(WEB, 'data', 'maps'), exist_ok=True)
    scene_bounds = {}
    for scene in ('hospital', 'office'):
        blob = g.read(args.c_ref, TRUTH.format(scene))
        obj = raster_js(blob, scene)
        scene_bounds[scene] = obj['bounds']
        open(os.path.join(WEB, 'data', 'maps', f'{scene}.js'), 'w').write(
            f'SL_RASTER({json.dumps(scene)},' + json.dumps(obj, separators=(',', ':')) + ');\n')

    # ---------- D: mechanism video selections ----------
    videos = {}
    sel = json.loads(g.read(args.d_ref, f'{D_DIR}/selection.json'))
    ser = json.loads(g.read(args.d_ref, f'{D_DIR}/series_selection.json'))
    door = next(c for c in sel['candidates'] if c['case_id'] == 'holdout:01:0070:matched')  # D VIDEO_SELECTION.md: "选中 原0070"
    videos[door['case_id']] = {'clip': 'door', 'kind': '01'}
    for kind, v in ser.items():
        if isinstance(v, dict) and v.get('selected'):
            videos[v['selected']['case_id']] = {'clip': CLIP_BY_KIND.get(kind), 'kind': kind}
    os.makedirs(os.path.join(WEB, 'frames'), exist_ok=True)
    for cid, v in videos.items():
        for lang in ('zh', 'en'):
            blob = g.read(args.d_ref, f"{D_DIR}/frames/{v['clip']}_{lang}.png")
            if blob:
                open(os.path.join(WEB, 'frames', f"{v['clip']}_{lang}.png"), 'wb').write(blob)
                v[lang] = f"frames/{v['clip']}_{lang}.png"

    # ---------- per case ----------
    index, shards = [], defaultdict(dict)
    chunks, chunk_cases, hero_src = defaultdict(dict), defaultdict(list), {}
    per_group = Counter()
    n_traj = n_diag = 0
    for r in lib:
        dkey, sds = set_of(r['dataset'])
        cid, kind = r['case_id'], r['kind']
        fam = r.get('family')
        scene = r['map'].get('scene')
        st = strata.get((sds, cid)) or {}
        sub = scene or fam or (f"c={st['c']}" if dkey == 'S3' and st.get('c') is not None else None)
        shard = f'{dkey}_{kind}' + (f'_{sub.replace("=", "").replace(".", "")}' if sub and dkey in ('S2', 'S3', 'S4', 'S4D') else '')
        ans = r.get('answers') or {}
        answer_public = ans.get('status') in ('scoring_complete_locked', 'development_public', 'independently_scored_fresh_S')
        limit = args.lock_traj if dkey in ('HO', 'HS') else args.s_traj
        keep_traj = limit == 0 or per_group[shard] < limit
        per_group[shard] += 1
        outcome, arms, pts, trs = '', {}, [], {}
        detail = {'answers': ans if answer_public else None}
        for arm in ARMS:
            s = scores.get((sds, cid, arm)) if sds else None
            if not s:
                outcome += ' '
                continue
            sc = s.get('score') or {}
            if not s['applicable']:
                outcome += '-'
            elif s['intent_success'] is True:
                outcome += '1'
            elif s['intent_success'] is False:
                outcome += '0'
            else:
                outcome += '?'
            src = s.get('source_file') or s.get('source_record')
            # the raw-record path is not shipped: it is in B's score row (source_file / source_record) for this case and arm
            e = {'i': s['intent_success'], 'l': s['literal_success'], 'c': sc.get('no_contact'), 'na': not s['applicable'],
                 'rs': s['run_status'], 'fs': s.get('final_state'), 't': r3(s.get('time_s', s.get('simulation_duration_s')))}
            if keep_traj and src:
                blob = g.read(args.c_ref, src)
                if blob:
                    raw = json.loads(gzip.decompress(blob))
                    if raw.get('trajectory'):
                        flat = pack_traj(raw['trajectory'])
                        trs[arm] = flat
                        pts += [(flat[i + 1] / 100, flat[i + 2] / 100) for i in range(0, len(flat), 4)]
                        n_traj += 1
                    t0 = raw.get('command_sent_s')
                    e['t0'] = float(t0) if t0 is not None else None
                    if arm == 'method' and raw.get('diagnostic_log_path'):
                        dblob = g.read(args.c_ref, raw['diagnostic_log_path'])
                        if dblob:
                            dg = json.loads(gzip.decompress(dblob))
                            cyc = dg.get('cycles') or []
                            com = [c for c in cyc if c.get('action') == 'COMMIT']
                            cy = com[0] if com else (cyc[-1] if cyc else None)
                            if cy:
                                post = cy.get('posterior') or {}
                                detail['cand'] = {
                                    'commit_t': r3(cy.get('t')) if com else None,
                                    'list': [[k['id'], k.get('kind'), r3(k['goal'][0]), r3(k['goal'][1]), r3(post.get(k['id'], 0))]
                                             for k in cy.get('candidates', []) if k.get('goal')],
                                    'unseen': r3(post.get('UNSEEN')), 'cycles': len(cyc), 'commits': len(com)}
                            ev = dg.get('execution_events') or []
                            if ev and ev[-1].get('t') is not None:
                                detail['done_t'] = r3(ev[-1].get('t'))
                            n_diag += 1
            arms[arm] = e
        detail['arms'] = arms
        shards[shard][cid] = detail
        if trs:
            ch = f'{shard}__{len(chunk_cases[shard]) // CHUNK}'
            chunk_cases[shard].append(cid)
            chunks[ch][cid] = {a: encode_traj(f) for a, f in trs.items()}
            hero_src[cid] = trs.get('method')
        entry = {'id': cid, 'd': dkey, 'k': kind, 'tx': r['instruction_text'], 'u': r['public_utterance'],
                 'm': compact_case(r), 'o': outcome, 'sh': shard, 'ans': answer_public}
        if fam:
            entry['f'] = fam
        if scene:
            entry['bd'] = scene
            entry['m']['b'] = s2_view(entry, pts, scene_bounds[scene])
        if dkey in ('S1', 'S3', 'S4') and st.get('c') is not None:
            entry['c'] = st['c']
        if trs:
            entry['t'] = 1
            entry['ch'] = ch
        if cid in videos:
            entry['v'] = videos[cid]['clip']
        index.append(entry)
        if len(index) % 500 == 0:
            print(f'{len(index)}/{len(lib)} cases, {n_traj} trajectories, {time.time() - t_start:.0f}s', flush=True)

    # ---------- hero: real method trajectories of locked-holdout cases (first 30 per kind, coarse) ----------
    hero, per_kind = [], Counter()
    for e in index:
        if e['d'] not in ('HO', 'HS') or per_kind[e['k']] >= 30:
            continue
        m = shards[e['sh']][e['id']]['arms'].get('method') or {}
        tr = hero_src.get(e['id'])
        if not tr:
            continue
        p = [[tr[i + 1], tr[i + 2]] for i in range(0, len(tr), 4)]
        step = max(1, len(p) // 40)
        hero.append({'id': e['id'], 'k': e['k'], 'i': m.get('i'), 'p': sum(p[::step] + [p[-1]], [])})
        per_kind[e['k']] += 1

    # ---------- rates straight from B statistics files ----------
    src_lock = f'B {Bs} · {LOCK_DIR}/statistics.json'
    src_fs, src_fst = f'B {Bs} · {FRESH}/statistics/SUMMARY.json', f'B {Bs} · {FRESH}/statistics/STRATIFIED.jsonl'
    src_4s, src_4st = f'B {Bs} · {FRESH}/S4_statistics/SUMMARY.json', f'B {Bs} · {FRESH}/S4_statistics/STRATIFIED.jsonl'
    rates = []
    keep_ds = {'holdout', 'holdout_original', 'holdout_supplement', 'mismatch', 'night_primary', 'night_D_exposed'}
    for row in lock_stats['rates']:
        if row['dataset'] in keep_ds:
            rates.append(rate_row(row['dataset'], row['category'], f"{row['dataset']}/{row['category']}", src_lock, row))
    for summ, strat, s_src, t_src in ((fresh_sum, fresh_str, src_fs, src_fst), (s4_sum, s4_str, src_4s, src_4st)):
        for ds, v in summ['datasets'].items():
            if ds.startswith('locked'):
                continue  # v2 rerun on the locked holdout: B labels it reference only; not shown here
            for row in v['rates']:
                rates.append(rate_row(ds, 'ALL', row['scope'], s_src, row))
        for row in strat:
            ds, _, cond = row['scope'].partition('/')
            if ds.startswith('locked'):
                continue
            if not all('=' in p for p in cond.split(';')):
                continue  # e.g. S1/passive: not a kind / building / c view
            parts = dict(p.split('=', 1) for p in cond.split(';'))
            if set(parts) == {'kind'}:
                rates.append(rate_row(ds, parts['kind'], row['scope'], t_src, row))
            elif ds == 'S2' and 'building' in parts and set(parts) <= {'building', 'kind'}:
                rates.append(rate_row(f"S2:{parts['building']}", parts.get('kind', 'ALL'), row['scope'], t_src, row))
            elif ds == 'S3' and 'c' in parts and set(parts) <= {'c', 'kind'}:
                rates.append(rate_row(f"S3:c={parts['c']}", parts.get('kind', 'ALL'), row['scope'], t_src, row))

    meta = {
        'built_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'commits': commits,
        'sources': {
            'cases': f'B {Bs} · {LIB}',
            'manifest': f'B {Bs} · {LIB_MANIFEST}',
            'scores_lock': f'B {Bs} · {LOCK_DIR}/scores.jsonl',
            'scores_S': f'B {Bs} · {FRESH}/scores/S{{1,2,3}}_SCORES.jsonl, S4_scores/S4_F{{0..6}}_SCORES.jsonl',
            'rates_lock': f'{src_lock} (rates; same numbers as rates.csv)',
            'rates_S': f'{src_fs}, STRATIFIED.jsonl',
            'rates_S4': f'{src_4s}, STRATIFIED.jsonl',
            'trajectories': f'C {commits["C"][:9]} · raw records named in each B score (source_file / source_record) and their diagnostic_log_path',
            'raster': f'C {commits["C"][:9]} · {TRUTH.format("{hospital,office}")}',
            'videos': f'D {commits["D"][:9]} · {D_DIR}/selection.json, series_selection.json, frames/',
        },
        'manifest': manifest,
        'arms': ARMS,
        'rates': rates,
        'stats_meta': {'evaluator_commit': lock_stats.get('evaluator_commit'), 'fresh_notes': fresh_sum.get('notes'),
                       'fresh_C': fresh_sum.get('source_C_commit'), 's4_notes': s4_sum.get('notes')},
        'traj_policy': {'locked': args.lock_traj, 'S': args.s_traj},
        'videos': videos,
        'hero': hero,
        'counts': {'cases': len(index), 'by_set': Counter(e['d'] for e in index), 'trajectories': n_traj, 'method_diagnostics': n_diag},
    }

    for sub in ('cases', 'traj'):
        os.makedirs(os.path.join(WEB, 'data', sub), exist_ok=True)
        for f in os.listdir(os.path.join(WEB, 'data', sub)):
            os.remove(os.path.join(WEB, 'data', sub, f))
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(WEB, 'data', 'meta.js'), 'w').write('window.SL_META=' + dump(meta) + ';\n')
    open(os.path.join(WEB, 'data', 'index.js'), 'w').write('window.SL_INDEX=' + dump(index) + ';\n')
    for name, obj in shards.items():
        open(os.path.join(WEB, 'data', 'cases', f'{name}.js'), 'w').write(f'SL_SHARD({json.dumps(name)},' + dump(obj) + ');\n')
    for name, obj in chunks.items():
        open(os.path.join(WEB, 'data', 'traj', f'{name}.js'), 'w').write(f'SL_TRAJ({json.dumps(name)},' + dump(obj) + ');\n')
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(os.path.join(WEB, 'data')) for f in fs)
    print(f'done: {len(index)} cases, {n_traj} trajectories, {n_diag} diagnostics, data {total / 1e6:.1f} MB, {time.time() - t_start:.0f}s')


if __name__ == '__main__':
    main()
