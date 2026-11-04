#!/usr/bin/env python3
"""Append the v4 reruns on the earlier sealed sets as two library sets, next to the synthetic / real-map test sets:

  V4O  obstacles and scenario families (S4 F0–F6), v4 / nearest / v16
  V4R  robustness, one merged set with four parts: locked 2,160, speaker mismatch 792, speech error c = 0.15 / 0.35

Reads (never writes) through git objects:
  B  codex/kappa-facts-20261028 @ --b-ref
       research/legacy_v4_B_20261104/scores/{S3_S4,LOCKED_2160,MISMATCH_792}/*_reference_SCORES.jsonl   reference route
       research/legacy_v4_B_20261104/scores/*/RATES_BY_SCOPE_ARM_ROUTE.csv                              leaderboard rows
       research/fresh_tests_20261101/export_public_library.py                                           text(): display command
  B  @ b34eff000 (pinned in B's INPUT_BINDINGS.json)
       research/sets_general_20261031/release_20261030/mismatch.jsonl                                  public mismatch inputs
  C  codex/junction-decision-20261028 @ --c-ref  (B's final delivery commit db5b85d41)
       raw run records named by each B score (source_record)

Locked / S3 / S4 inputs (map, command, candidates, answers) are copied from the entries the web already holds for those
cases. Mismatch inputs come from the public release; the stress sub-category is not exported and mismatch case ids are
renumbered per kind, because the web shows the mismatch set only as a whole. Night replay is not included.
Writes only under data/: index.js, meta.js (V4O / V4R entries and rates replaced), cases/V4[OR]_*.js, traj/V4[OR]_*.js.

Usage:
  python3 tools/build_v4_legacy.py --b-ref f13fdcdb5e30b2f364a7a4b844c5550b23f8c816 --c-ref db5b85d417e597acc97e3e13aeb1544e609a3ccf
  python3 tools/public_filter.py
"""
import argparse, gzip, json, os, re, time
from collections import Counter, defaultdict

from build_data import CHUNK, WEB, Git, encode_traj, pack_traj, r3, sh
from build_s5_s6 import b_text_fn, load_js

LEG = 'research/legacy_v4_B_20261104/scores'
BIND_REF = 'b34eff0007c734953e5d707d2e3f56647cec76a1'
MISMATCH = 'research/sets_general_20261031/release_20261030/mismatch.jsonl'
ARMS3 = ['method_v4', 'nearest', 'v16']
KEYS = ('V4O', 'V4R')
GROUP_LABEL = {'lock': 'locked', 'mm': 'mismatch', 'c=0.15': 'c=0.15', 'c=0.35': 'c=0.35'}


def score_files():
    yield 'V4R', 'lock', f'{LEG}/LOCKED_2160/locked_original_reference_SCORES.jsonl'
    yield 'V4R', 'lock', f'{LEG}/LOCKED_2160/locked_supplement_reference_SCORES.jsonl'
    yield 'V4R', 'mm', f'{LEG}/MISMATCH_792/mismatch_reference_SCORES.jsonl'
    yield 'V4R', 'S3', f'{LEG}/S3_S4/S3_reference_SCORES.jsonl'
    for f in range(7):
        yield 'V4O', f'F{f}', f'{LEG}/S3_S4/S4_F{f}_reference_SCORES.jsonl'


def rate_rows(g, ref):
    import csv, io
    out = []
    for batch, keep in (('LOCKED_2160', r'^LOCKED_2160(?:_kind(\d\d))?$'), ('MISMATCH_792', r'^MISMATCH_792$'),
                        ('S3_S4', r'^(S3_c0\.15|S3_c0\.35|S4_F\d)(?:_kind(\d\d))?$')):
        src = f'{LEG}/{batch}/RATES_BY_SCOPE_ARM_ROUTE.csv'
        for r in csv.DictReader(io.StringIO(g.read(ref, src).decode())):
            if r['route'] != 'reference' or r['metric'] != 'intent_success' or r['arm'] not in ARMS3:
                continue
            m = re.match(keep, r['scope'])
            if not m:
                continue
            if batch == 'LOCKED_2160':
                ds, cat = 'V4R:lock', m.group(1) or 'ALL'
            elif batch == 'MISMATCH_792':
                ds, cat = 'V4R:mm', 'ALL'
            else:
                base, cat = m.group(1), m.group(2) or 'ALL'
                ds = {'S3_c0.15': 'V4R:c=0.15', 'S3_c0.35': 'V4R:c=0.35'}.get(base) or f'V4O:{base[3:]}'
            ci = json.loads(r['ci95']) if r.get('ci95') else None
            k, n, unk = int(r['success']), int(r['slots']), int(r['unknown'] or 0)
            out.append({'dataset': ds, 'category': cat, 'scope': f"{r['scope']}/reference", 'src': src, 'arm': r['arm'], 'slots': n, 'applicable': n,
                        'intent_success': {'success': k, 'failure': n - k - unk, 'known': n - unk, 'unknown': unk,
                                           'estimate': float(r['estimate']) if r.get('estimate') else None, 'ci95': ci,
                                           'groups': int(r['groups']) if r.get('groups') else None}})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--b-ref', default='origin/codex/kappa-facts-20261028')
    ap.add_argument('--c-ref', default='db5b85d417e597acc97e3e13aeb1544e609a3ccf')
    args = ap.parse_args()
    repo = sh('git', 'rev-parse', '--show-toplevel', cwd=os.path.dirname(os.path.abspath(__file__))).strip()
    g = Git(repo)
    Bc, Cc = g.commit(args.b_ref), g.commit(args.c_ref)
    text = b_text_fn(g, args.b_ref)
    t0 = time.time()
    meta = load_js(os.path.join(WEB, 'data', 'meta.js'), 'window.SL_META=')
    index = load_js(os.path.join(WEB, 'data', 'index.js'), 'window.SL_INDEX=')
    index = [e for e in index if e['d'] not in KEYS]
    old = {(e['d'], e['id']): e for e in index}
    shard_cache = {}

    def old_answers(e):
        if e['sh'] not in shard_cache:
            shard_cache[e['sh']] = load_js(os.path.join(WEB, 'data', 'cases', f"{e['sh']}.js"), f'SL_SHARD({json.dumps(e["sh"])},')
        return (shard_cache[e['sh']].get(e['id']) or {}).get('answers')

    mm_inputs = {r['case_id']: r for r in g.jsonl(BIND_REF, MISMATCH)}
    for sub in ('cases', 'traj'):
        d = os.path.join(WEB, 'data', sub)
        for f in os.listdir(d):
            if f.startswith(tuple(k + '_' for k in KEYS)):
                os.remove(os.path.join(d, f))
    meta['rates'] = [r for r in meta['rates'] if r['dataset'].split(':')[0] not in KEYS] + rate_rows(g, args.b_ref)

    arms = meta['arms']
    cases = defaultdict(dict)       # (key, case_id) -> arm -> score
    groups = {}
    for key, grp, path in score_files():
        for s in g.jsonl(args.b_ref, path):
            assert s['route'] == 'reference'
            if s['arm'] in ARMS3:
                cases[(key, s['case_id'])][s['arm']] = s
                gg = grp if grp != 'S3' else f"c={s['c']}"
                groups[(key, s['case_id'])] = (gg, s['dataset'])

    shards, chunks, chunk_cases = defaultdict(dict), defaultdict(dict), defaultdict(list)
    new, n_traj, n_missing, mm_no = [], 0, 0, Counter()
    for (key, cid), sc in cases.items():
        grp, ds = groups[(key, cid)]
        kind = next(iter(sc.values()))['kind']
        if grp == 'mm':
            r = mm_inputs[cid]
            w, u = r['world'], r['utterance']
            tx = text(u) + (f'，再前进{u["follow_forward_m"]:g}米' if kind == '06' and u.get('follow_forward_m') is not None else '')
            cands = [[z['id'], r3(z['center'][0]), r3(z['center'][1]), r3(z['tangent'][0]), r3(z['tangent'][1]), r3(z['inward'][0]),
                      r3(z['inward'][1]), r3(z['width_m']), r3(z.get('depth_m'))] for z in r['truth']['openings']]
            m = {'b': [r3(v) for v in w['bounds']], 'r': [[r3(v) for v in q] for q in w.get('free_rectangles') or []],
                 'o': [[r3(v) for v in q] for q in (w.get('blocked_rectangles') or [])], 's': [r3(v) for v in w['initial_pose']], 'c': cands}
            answers = {'target': r['truth']['target'], 'opening_passability': {z['id']: z['traversable'] for z in r['truth']['openings']},
                       'status': 'scoring_complete_locked'}
            pub = {k: v for k, v in u.items() if k != 'corrected_target'}
            mm_no[kind] += 1
            new_id = f'mismatch:{kind}:{mm_no[kind]:04d}'
            fam = None
        else:
            src_key = {'locked_original': 'HO', 'locked_supplement': 'HS', 'S3': 'S3'}.get(ds) or 'S4'
            e0 = old[(src_key, cid)]
            m, tx, pub, answers, fam = e0['m'], e0['tx'], e0['u'], old_answers(e0), e0.get('f')
            new_id = f'v4:{cid}'
        outcome, det, trs = '', {}, {}
        for arm in arms:
            s = sc.get(arm)
            if not s:
                outcome += ' '
                continue
            outcome += '-' if not s['applicable'] else {True: '1', False: '0'}.get(s['intent_success'], '?')
            e = {'i': s['intent_success'], 'l': s['literal_success'], 'c': s.get('no_contact'), 'na': not s['applicable'],
                 'rs': s['run_status'], 'fs': s.get('final_state'), 't': r3(s.get('simulation_duration_s'))}
            blob = g.read(args.c_ref, s['source_record'])
            if blob:
                raw = json.loads(gzip.decompress(blob))
                if raw.get('trajectory'):
                    trs[arm] = pack_traj(raw['trajectory'])
                    n_traj += 1
                cs = raw.get('command_sent_s')
                e['t0'] = float(cs) if cs is not None else None
            else:
                n_missing += 1
            det[arm] = e
        sub = (fam or grp).replace('=', '').replace('.', '')
        shard = f'{key}_{kind}_{sub}'
        shards[shard][new_id] = {'answers': answers, 'arms': det}
        entry = {'id': new_id, 'd': key, 'k': kind, 'tx': tx, 'u': pub, 'm': m, 'o': outcome, 'sh': shard, 'ans': bool(answers)}
        if fam:
            entry['f'] = fam
        else:
            entry['g'] = grp
        if trs:
            ch = f'{shard}__{len(chunk_cases[shard]) // CHUNK}'
            chunk_cases[shard].append(new_id)
            chunks[ch][new_id] = {a: encode_traj(f) for a, f in trs.items()}
            entry['t'] = 1
            entry['ch'] = ch
        new.append(entry)
        if len(new) % 500 == 0:
            print(f'{len(new)} cases, {n_traj} trajectories, {time.time() - t0:.0f}s', flush=True)

    order = {'V4O': 0, 'V4R': 1}
    new.sort(key=lambda e: (order[e['d']], e.get('f') or e.get('g'), e['k'], e['id']))
    index += new
    meta['counts']['cases'] = len(index)
    meta['counts']['by_set'] = dict(Counter(e['d'] for e in index))
    meta['counts']['trajectories_v4_legacy'] = n_traj
    meta['commits']['B_v4_legacy'] = Bc
    meta['commits']['C_v4_legacy'] = Cc
    meta['sources']['v4_legacy'] = (f'B {Bc[:9]} · {LEG}/{{S3_S4,LOCKED_2160,MISMATCH_792}}/*_reference_SCORES.jsonl, RATES_BY_SCOPE_ARM_ROUTE.csv; '
                                    f'mismatch inputs B {BIND_REF[:9]} · {MISMATCH}; trajectories C {Cc[:9]} · raw records named in each B score')
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(WEB, 'data', 'meta.js'), 'w').write('window.SL_META=' + dump(meta) + ';\n')
    open(os.path.join(WEB, 'data', 'index.js'), 'w').write('window.SL_INDEX=' + dump(index) + ';\n')
    for name, obj in shards.items():
        open(os.path.join(WEB, 'data', 'cases', f'{name}.js'), 'w').write(f'SL_SHARD({json.dumps(name)},' + dump(obj) + ');\n')
    for name, obj in chunks.items():
        open(os.path.join(WEB, 'data', 'traj', f'{name}.js'), 'w').write(f'SL_TRAJ({json.dumps(name)},' + dump(obj) + ');\n')
    print(f'done: {len(new)} cases ({Counter(e["d"] for e in new)}), {n_traj} trajectories, {n_missing} raw missing, {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
