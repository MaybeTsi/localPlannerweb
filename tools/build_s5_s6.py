#!/usr/bin/env python3
"""Append the S5 sets (S1′, S2′; validate method_v3) and S6 sets (S1″, S2″; validate method_v4) to the existing web data
without touching earlier entries.

Reads (never writes) other branches through git objects:
  B  codex/kappa-facts-20261028 @ --b-ref
       research/fresh_tests_20261101/S6/release/runtime/S{1,2}doubleprime_runtime.jsonl      public inputs
       research/fresh_tests_20261101/S6/scores/S{1,2}doubleprime_SCORES.jsonl                 nearest, method_v3, method_v4, v4_only_* (5 arms)
       research/fresh_tests_20261101/S6_table_arms_20261103/scores/S{1,2}doubleprime_reference_SCORES.jsonl
                                                                                               v16, method, v4_no_speed, v4_no_keep, always_slow_fixed, snap, oracle_due
       research/fresh_tests_20261101/S5/release/runtime/S{1,2}prime_runtime.jsonl, S5/scores/S{1,2}prime_SCORES.jsonl (5 arms)
       research/fresh_tests_20261101/S5/PAPER_RATES.csv, S6_table_arms_20261103/analysis/{MAIN_TABLE,BY_TYPE}.csv   leaderboard rates
       research/fresh_tests_20261101/export_public_library.py                                 text(): Chinese display command, used as is
  C  codex/junction-decision-20261028 @ --c-ref
       raw run records named by each B score (source_record / source_public_record)

The instruction text comes from B's own text() function (read from the blob, not re-written here). B has not published S6
answers (target / passability) to the scenario library, so candidates are empty and answers stay hidden. Reference route only
(the transport route is B's companion check with the same inputs). Every trajectory is kept (same encoding as build_data.py).

Writes only under the web directory: data/index.js and data/meta.js (S5/S6 entries and their rates replaced / appended),
data/cases/{S1P,S2P,S1PP,S2PP}_*.js, data/traj/{S1P,S2P,S1PP,S2PP}_*.js.

Usage:
  git fetch origin +refs/heads/codex/kappa-facts-20261028:refs/remotes/origin/codex/kappa-facts-20261028
  git fetch origin +refs/heads/codex/junction-decision-20261028:refs/remotes/origin/codex/junction-decision-20261028
  python3 tools/build_s5_s6.py --b-ref 2b0c659a051fc071e1a4652312b824dab702b37e --c-ref 416202ce432d13f755201b805f317418f95e547b
"""
import argparse, ast, gzip, json, os, time
from collections import Counter, defaultdict

import csv, io

from build_data import CHUNK, WEB, Git, encode_traj, pack_traj, r3, s2_view, sh

Git.csv = lambda self, ref, path: list(csv.DictReader(io.StringIO(self.read(ref, path).decode())))

FRESH = 'research/fresh_tests_20261101'
S6 = f'{FRESH}/S6'
TABLE = f'{FRESH}/S6_table_arms_20261103'
NEW_ARMS = ['method_v3', 'method_v4', 'v4_no_speed', 'v4_no_keep', 'v4_only_nownext', 'v4_only_correction', 'always_slow_fixed', 'oracle_due']
S5 = f'{FRESH}/S5'
# dataset -> (web set key, rate-dataset label, runtime file, score files)
SETS = {'S1prime': ('S1P', 'S1′', f'{S5}/release/runtime/S1prime_runtime.jsonl', [f'{S5}/scores/S1prime_SCORES.jsonl']),
        'S2prime': ('S2P', 'S2′', f'{S5}/release/runtime/S2prime_runtime.jsonl', [f'{S5}/scores/S2prime_SCORES.jsonl']),
        'S1doubleprime': ('S1PP', 'S1″', f'{S6}/release/runtime/S1doubleprime_runtime.jsonl',
                          [f'{S6}/scores/S1doubleprime_SCORES.jsonl', f'{TABLE}/scores/S1doubleprime_reference_SCORES.jsonl']),
        'S2doubleprime': ('S2PP', 'S2″', f'{S6}/release/runtime/S2doubleprime_runtime.jsonl',
                          [f'{S6}/scores/S2doubleprime_SCORES.jsonl', f'{TABLE}/scores/S2doubleprime_reference_SCORES.jsonl'])}
KEYS = tuple(v[0] for v in SETS.values())
RATE_DS = tuple(v[1] for v in SETS.values())


def rate(dataset, category, scope, src, arm, slots, succ, unk=0, est=None, ci=None, groups=None):
    return {'dataset': dataset, 'category': category, 'scope': scope, 'src': src, 'arm': arm, 'slots': slots, 'applicable': slots,
            'intent_success': {'success': succ, 'failure': slots - succ - unk, 'known': slots - unk, 'unknown': unk,
                               'estimate': est, 'ci95': ci, 'groups': groups}}


def leaderboard_rates(g, ref):
    """Rows in the web's rate format, copied from B's tables (no recomputation)."""
    out = []
    src5 = f'{S5}/PAPER_RATES.csv'
    for r in g.csv(ref, src5):
        if r['metric'] != 'intent_success':
            continue
        ds, _, cond = r['scope'].partition('/')[2].partition('/')
        lab = {'S1prime': 'S1′', 'S2prime': 'S2′'}[ds]
        parts = dict(p.split('=', 1) for p in cond.split(';')) if cond != 'ALL' else {}
        if set(parts) - {'kind', 'building'}:
            continue
        d = lab + (':' + parts['building'] if 'building' in parts else '')
        row = rate(d, parts.get('kind', 'ALL'), r['scope'], src5, r['arm'], int(r['applicable']), int(r['success']), int(r['unknown']),
                   float(r['equal_group_rate']), [float(r['ci95_lower']), float(r['ci95_upper'])], int(r['groups']))
        if not any(x['dataset'] == row['dataset'] and x['category'] == row['category'] and x['arm'] == row['arm'] for x in out):
            out.append(row)
    lab6 = {'S1doubleprime': 'S1″', 'S2doubleprime': 'S2″'}
    srcm = f'{TABLE}/analysis/MAIN_TABLE.csv'
    for r in g.csv(ref, srcm):
        if r['route'] != 'reference':
            continue
        d = lab6[r['dataset']] + ('' if r['building'] == 'ALL' else ':' + r['building'])
        out.append(rate(d, 'ALL', f"{r['dataset']}/{r['building']}/reference", srcm, r['arm'], int(r['cases']), int(r['intent_success']),
                        int(r.get('intent_unknown') or 0), float(r['estimate']), json.loads(r['ci95']), int(r['groups'])))
    srct = f'{TABLE}/analysis/BY_TYPE.csv'
    for r in g.csv(ref, srct):
        if r['route'] != 'reference':
            continue
        d = lab6[r['dataset']] + ('' if r['building'] == 'ALL' else ':' + r['building'])
        out.append(rate(d, r['kind'], f"{r['dataset']}/{r['building']}/kind={r['kind']}/reference", srct, r['arm'], int(r['cases']),
                        int(r['intent_success']), int(r['intent_unknown'] or 0)))
    return out


def b_text_fn(g, ref):
    """B's text(u) from export_public_library.py, executed as written."""
    src = g.read(ref, f'{FRESH}/export_public_library.py').decode()
    fn = next(n for n in ast.parse(src).body if isinstance(n, ast.FunctionDef) and n.name == 'text')
    ns = {}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), 'export_public_library.py', 'exec'), ns)
    return ns['text']


def load_js(path, prefix):
    s = open(path).read()
    assert s.startswith(prefix) and s.rstrip().endswith(';')
    body = s[len(prefix):].rstrip().rstrip(';')
    return json.loads(body[:-1] if prefix.endswith(',') else body)   # SL_RASTER("x",{...}); -> drop the closing ')'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default=None)
    ap.add_argument('--b-ref', default='origin/codex/kappa-facts-20261028')
    ap.add_argument('--c-ref', default='origin/codex/junction-decision-20261028')
    args = ap.parse_args()
    repo = args.repo or sh('git', 'rev-parse', '--show-toplevel', cwd=os.path.dirname(os.path.abspath(__file__))).strip()
    g = Git(repo)
    Bc, Cc = g.commit(args.b_ref), g.commit(args.c_ref)
    text = b_text_fn(g, args.b_ref)
    t0 = time.time()

    meta = load_js(os.path.join(WEB, 'data', 'meta.js'), 'window.SL_META=')
    index = load_js(os.path.join(WEB, 'data', 'index.js'), 'window.SL_INDEX=')
    index = [e for e in index if e['d'] not in KEYS]                   # idempotent: drop earlier S5/S6 entries
    meta['rates'] = [r for r in meta['rates'] if r['dataset'].split(':')[0] not in RATE_DS] + leaderboard_rates(g, args.b_ref)
    arms = list(meta['arms']) + [a for a in NEW_ARMS if a not in meta['arms']]
    meta['arms'] = arms
    scene_bounds = {}
    for scene in ('hospital', 'office'):
        obj = load_js(os.path.join(WEB, 'data', 'maps', f'{scene}.js'), f'SL_RASTER({json.dumps(scene)},')
        scene_bounds[scene] = obj['bounds']
    for sub in ('cases', 'traj'):
        d = os.path.join(WEB, 'data', sub)
        for f in os.listdir(d):
            if f.startswith(tuple(k + '_' for k in KEYS)):
                os.remove(os.path.join(d, f))

    shards, chunks, chunk_cases = defaultdict(dict), defaultdict(dict), defaultdict(list)
    n_traj, n_missing, new = 0, 0, []
    for ds, (key, _, rt_path, score_paths) in SETS.items():
        runtime = g.jsonl(args.b_ref, rt_path)
        scores = {}
        for path in score_paths:
            for s in g.jsonl(args.b_ref, path):
                assert s.get('route', 'reference') == 'reference'
                scores[(s['case_id'], s['arm'])] = s
        for r in runtime:
            cid, kind, w, u = r['case_id'], r['kind'], r['world'], r['utterance']
            scene = w.get('scene')
            shard = f'{key}_{kind}' + (f'_{scene}' if scene else '')
            tx = text(u) + (f'，再前进{u["follow_forward_m"]:g}米' if kind == '06' else '')   # same as B's formal export
            outcome, det_arms, trs, pts = '', {}, {}, []
            for arm in arms:
                s = scores.get((cid, arm))
                if not s:
                    outcome += ' '
                    continue
                outcome += '-' if not s['applicable'] else {True: '1', False: '0'}.get(s['intent_success'], '?')
                sc = s.get('score') or {}
                e = {'i': s['intent_success'], 'l': s['literal_success'], 'c': s.get('no_contact', sc.get('no_contact')), 'na': not s['applicable'],
                     'rs': s['run_status'], 'fs': s.get('final_state'), 't': r3(s.get('time_s', s.get('simulation_duration_s')))}
                src = s.get('source_record') or s.get('source_public_record')
                blob = g.read(args.c_ref, src) if src else None
                if blob:
                    raw = json.loads(gzip.decompress(blob))
                    if raw.get('trajectory'):
                        flat = pack_traj(raw['trajectory'])
                        trs[arm] = flat
                        pts += [(flat[i + 1] / 100, flat[i + 2] / 100) for i in range(0, len(flat), 4)]
                        n_traj += 1
                    cs = raw.get('command_sent_s')
                    e['t0'] = float(cs) if cs is not None else None
                elif src:
                    n_missing += 1
                det_arms[arm] = e
            shards[shard][cid] = {'answers': None, 'arms': det_arms}
            m = {'b': [r3(v) for v in w['bounds']], 'r': [[r3(v) for v in q] for q in w.get('free_rectangles') or []],
                 'o': [[r3(v) for v in q] for q in (w.get('blocked_rectangles') or [])], 's': [r3(v) for v in w['initial_pose']], 'c': []}
            entry = {'id': cid, 'd': key, 'k': kind, 'tx': tx, 'u': {k: v for k, v in u.items() if k != 'corrected_target'},
                     'm': m, 'o': outcome, 'sh': shard, 'ans': False}
            if scene:
                m['img'] = scene
                entry['bd'] = scene
                m['b'] = s2_view(entry, pts, scene_bounds[scene])
            if trs:
                ch = f'{shard}__{len(chunk_cases[shard]) // CHUNK}'
                chunk_cases[shard].append(cid)
                chunks[ch][cid] = {a: encode_traj(f) for a, f in trs.items()}
                entry['t'] = 1
                entry['ch'] = ch
            new.append(entry)
            if len(new) % 250 == 0:
                print(f'{len(new)} S5/S6 cases, {n_traj} trajectories, {time.time() - t0:.0f}s', flush=True)

    index += new
    meta['counts']['cases'] = len(index)
    meta['counts']['by_set'] = dict(Counter(e['d'] for e in index))
    meta['counts'].pop('trajectories_S6', None)
    meta['counts']['trajectories_S5_S6'] = n_traj
    meta['commits']['B_S6'] = Bc
    meta['commits']['C_S6'] = Cc
    meta['sources'].pop('S6', None)
    meta['sources']['S5'] = (f'B {Bc[:9]} · {S5}/release/runtime/S{{1,2}}prime_runtime.jsonl, {S5}/scores/S{{1,2}}prime_SCORES.jsonl, {S5}/PAPER_RATES.csv; '
                             f'trajectories C {Cc[:9]} · raw records named in each B score')
    meta['sources']['S6'] = (f'B {Bc[:9]} · {S6}/release/runtime/S{{1,2}}doubleprime_runtime.jsonl, {S6}/scores/S{{1,2}}doubleprime_SCORES.jsonl, '
                             f'{TABLE}/scores/S{{1,2}}doubleprime_reference_SCORES.jsonl, {TABLE}/analysis/{{MAIN_TABLE,BY_TYPE}}.csv; trajectories C {Cc[:9]} · raw records named in each B score; '
                             f'command text: B {FRESH}/export_public_library.py text(); answers not published by B')
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(WEB, 'data', 'meta.js'), 'w').write('window.SL_META=' + dump(meta) + ';\n')
    open(os.path.join(WEB, 'data', 'index.js'), 'w').write('window.SL_INDEX=' + dump(index) + ';\n')
    for name, obj in shards.items():
        open(os.path.join(WEB, 'data', 'cases', f'{name}.js'), 'w').write(f'SL_SHARD({json.dumps(name)},' + dump(obj) + ');\n')
    for name, obj in chunks.items():
        open(os.path.join(WEB, 'data', 'traj', f'{name}.js'), 'w').write(f'SL_TRAJ({json.dumps(name)},' + dump(obj) + ');\n')
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(os.path.join(WEB, 'data')) for f in fs)
    print(f'done: {len(new)} S5/S6 cases, {n_traj} trajectories, {n_missing} raw records missing, data {total / 1e6:.1f} MB, {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
