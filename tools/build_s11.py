#!/usr/bin/env python3
"""S11 data for the scenario-library web page (main method R13).

Reads (never writes) other branches through git objects:
  B  codex/kappa-facts-20261028 @ --b-ref (default 5248ac7ef23)  research/s11_20261106/
       summary/{RATES_BY_SUBSET,PAIRED_BY_SUBSET,PAIRED_COMPLETION_TIMES,OBSTACLE_FUNNELS,PRIMARY_ARMS}.csv, summary/GATE_REVIEW.json, summary/SUMMARY.json
       runtime/S11_*_runtime.jsonl      the public inputs: world, start, utterance
       formal_scores/S11_*_SCORES.jsonl per slot: behaviour, utility, severe error, contact, funnel flags, source raw record
  C  codex/junction-decision-20261028 @ origin  research/method_v6_20261105/v612/release_r13_20261107/formal/captures/raw/**
       the raw captures named in each score (source_path): trajectory and command time.

NOT published by B (so not shipped, the page says "not published"): the true intent of a case, candidate lists / posteriors,
the finite POMDP reference per case (only aggregate counts), per-case forward-obligation flags of the obstacle cases.

Writes under the web directory:
  data/s11/meta.js                    window.SL_S11
  data/s11/cases/<key>.js             SL_S11_CASES(key, {caseId: {...}})   every slot of every case (13,130 cases x 8 arms)
  data/s11/traj/<key>__<n>.js         SL_S11_TRAJ(name, {sourceCaseId: {tr: {arm: b64}, t0: {arm: s}}})   trajectories (82,896 unique attempts)
  data/s11/trindex.js                 SL_S11_TRI({sourceCaseId: chunk})
"""
import argparse, csv, gzip, io, json, os, sys, time
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(WEB, '..', '..', '..'))
import importlib.util
_spec = importlib.util.spec_from_file_location('bd', os.path.join(HERE, 'build_data.py'))
bd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bd)

D = 'research/s11_20261106'
ARMS = ['method_R13', 'literal_if_feasible', 'nearest', 'v16', 'method_v6', 'literal_if_feasible_exec612', 'nearest_exec612', 'method_v6_exec612']
KEYS = {'S11_MAIN_SYNTH': 'main', 'S11_REAL': 'real', 'S11_CLUTTER': 'clutter', 'S11_DIVERSITY_F1': 'hall', 'S11_DIVERSITY_F2': 'corner',
        'S11_OBS_O1_BLOCK': 'o1b', 'S11_OBS_O1_CLEAR': 'o1c', 'S11_OBS_O3_BLOCK': 'o3b', 'S11_OBS_O3_CLEAR': 'o3c', 'S11_OBS_O4_BLOCK': 'o4b', 'S11_OBS_O4_CLEAR': 'o4c'}
BEH = {'LITERAL_COMPLETED': 'L', 'STRUCTURE': 'S', 'STOP_REPORT': 'R', 'INCOMPLETE': 'I', 'COLLISION': 'C', 'UNKNOWN': '?', 'UNKNOWN_MULTIPLE_STRUCTURES': 'M'}
RATE_COLS = ['n', 'physical_groups', 'confirmed_completed', 'completion_known', 'completion_UNKNOWN', 'completion_per_known', 'literal_intent_completed', 'structure_intent_completed',
             'severe', 'severe_known', 'severe_UNKNOWN', 'contact_positive', 'wrong_structure', 'safe_report', 'intent_exists_n', 'intent_exists_safe_report', 'intent_exists_report_rate',
             'absent_intent_n', 'absent_intent_safe_report', 'safe_incomplete', 'compile_rejected', 'simulation_limit', 'resource_timeout', 'all_duration_median_s', 'all_duration_p90_s']
PAIR_COLS = ['scope', 'left', 'right', 'metric', 'n', 'known_pairs', 'unknown_pairs', 'known_left_numerator', 'known_right_numerator', 'known_pair_difference', 'known_pair_CI',
             'confidence', 'lower_completion_CI', 'upper_completion_CI', 'gains', 'regressions', 'both_one', 'both_zero']


def num(v):
    if v in ('', None):
        return None
    if v in ('True', 'False'):
        return v == 'True'
    try:
        f = float(v)
        return int(f) if f == int(f) and all(c not in str(v) for c in '.eE') else f
    except ValueError:
        return v


def csvrows(g, ref, name, cols=None):
    blob = g.read(ref, f'{D}/summary/{name}.csv').decode()
    out = []
    for r in csv.DictReader(io.StringIO(blob)):
        row = {}
        for k, v in r.items():
            if cols and k not in cols:
                continue
            row[k] = json.loads(v) if v.startswith('[') else num(v)
        out.append(row)
    return out


def paper_tables(g, ref):
    out = {}
    for key, name in (('severe', 'SEVERE_ERROR_DECOMPOSITION'), ('blockclear', 'T_obstacle_R13_BLOCK_minus_CLEAR')):
        blob = g.read(ref, f'{D}/paper_tables/{name}.csv').decode()
        out[key] = [{k: (json.loads(v) if v.startswith('[') else num(v)) for k, v in r.items()} for r in csv.DictReader(io.StringIO(blob))]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--b-ref', default='5248ac7ef23')
    ap.add_argument('--c-ref', default='origin/codex/junction-decision-20261028')
    ap.add_argument('--no-traj', action='store_true')
    ap.add_argument('--paper-ref', default='945f10b4e2d', help='B commit with paper_tables/ (CP-B-N); scores and summary/ are identical to --b-ref')
    ap.add_argument('--paper-only', action='store_true', help='only refresh the paper tables inside the existing data/s11/meta.js')
    args = ap.parse_args()
    t0 = time.time()
    g = bd.Git(REPO)
    Bc = g.commit(args.b_ref); Cc = g.commit(args.c_ref)
    Pc = g.commit(args.paper_ref)
    if args.paper_only:
        mp = os.path.join(WEB, 'data', 's11', 'meta.js')
        txt = open(mp).read()
        meta = json.loads(txt[txt.index('=') + 1:txt.rindex(';')])
        meta['paper'] = paper_tables(g, args.paper_ref); meta['paper_commit'] = Pc
        meta['sources']['paper'] = f'B {Pc[:11]} · {D}/paper_tables/SEVERE_ERROR_DECOMPOSITION.csv, T_obstacle_R13_BLOCK_minus_CLEAR.csv (CP-B-N)'
        open(mp, 'w').write('window.SL_S11=' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
        print('paper tables refreshed')
        return

    # ---------- B summary tables ----------
    rates = csvrows(g, args.b_ref, 'RATES_BY_SUBSET', ['scope', 'arm'] + RATE_COLS)
    paired = [r for r in csvrows(g, args.b_ref, 'PAIRED_BY_SUBSET', PAIR_COLS) if r['metric'] in ('completion', 'severe')]
    times = csvrows(g, args.b_ref, 'PAIRED_COMPLETION_TIMES')
    funnels = csvrows(g, args.b_ref, 'OBSTACLE_FUNNELS')
    primary_arms = csvrows(g, args.b_ref, 'PRIMARY_ARMS')
    primary_desc = [r for r in csvrows(g, args.b_ref, 'PRIMARY_DESCRIPTIVE', PAIR_COLS) if r['metric'] in ('completion', 'severe')]
    gates = json.loads(g.read(args.b_ref, f'{D}/summary/GATE_REVIEW.json'))
    summ = json.loads(g.read(args.b_ref, f'{D}/summary/SUMMARY.json'))
    keep = ['status', 'fixed_C_ref', 'logical_cases', 'logical_slots', 'unique_physical_attempts', 'reused_references', 'primary_positive_cases', 'primary_source_groups',
            'O2_qualified', 'physical_groups', 'real_physical_doors', 'bootstrap_replicates', 'seed', 'safe_report_other_completion_categories', 'finite_POMDP_reference']
    facts = {k: summ[k] for k in keep if k in summ}

    # ---------- per case: public inputs + scores ----------
    WHY = []
    def why_code(w):
        if w not in WHY:
            WHY.append(w)
        return WHY.index(w)
    cases = {}          # key -> {case_id: entry}
    sources = {}        # (src dataset, src case) -> {arm: source_path}
    own_order = {}      # key -> [case ids in runtime order]
    util_sum = defaultdict(lambda: [0.0, 0])   # (scope, arm) -> [sum utility, known]
    scope_of = lambda ds, c: [ds] + (['S11_REAL/' + c['w']['scene']] if ds == 'S11_REAL' else []) + ['ALL_LOGICAL']
    for ds, key in KEYS.items():
        runtime = g.jsonl(args.b_ref, f'{D}/runtime/{ds}_runtime.jsonl')
        scores = defaultdict(dict)
        for s in g.jsonl(args.b_ref, f'{D}/formal_scores/{ds}_SCORES.jsonl'):
            scores[s['case_id']][s['arm']] = s
        out = {}
        for r in runtime:
            cid = r['case_id']; w = r['world']; u = r['utterance']
            slot = {}; src = set()
            for arm in ARMS:
                s = scores[cid].get(arm)
                if not s:
                    slot[arm] = None
                    continue
                f = s.get('funnel') or {}
                fun = ''.join('?' if f.get(k) is None else '1' if f.get(k) else '0' for k in ('encountered_longitudinal_zone', 'no_contact_whole_car_pass', 'returned_to_axis_before_public_boundary'))
                u10 = None if s['utility'] is None else int(round(s['utility'] * 10))
                sev = None if s['severe_error'] is None else int(bool(s['severe_error']))
                ct = None if s['contact'] is None else int(bool(s['contact']))
                slot[arm] = [BEH.get(s['behavior'], '?'), u10, sev, ct, why_code(s['utility_reason']), fun,
                             s['final_state'], s['execution_duration_s']]
                src.add((s['source_dataset'], s['source_case_id'])); sources.setdefault((s['source_dataset'], s['source_case_id']), {})[arm] = s['source_path']
                if s['utility'] is not None:
                    for sc in (ds, 'ALL_LOGICAL') + (('S11_REAL/' + w['scene'],) if ds == 'S11_REAL' else ()):
                        z = util_sum[(sc, arm)]; z[0] += s['utility']; z[1] += 1
            assert len(src) == 1, (cid, src)
            sk = next(iter(src))
            e = {'k': r['kind'], 'u': {k: v for k, v in u.items() if k != 'corrected_target'}, 'a': slot,
                 'w': {'b': [bd.r3(v) for v in w['bounds']], 'r': [[bd.r3(v) for v in q] for q in w.get('free_rectangles') or []],
                       'o': [[bd.r3(v) for v in q] for q in (w.get('blocked_rectangles') or [])], 's': [bd.r3(v) for v in w['initial_pose']]}}
            if w.get('scene'):
                e['w']['scene'] = w['scene']
            if r.get('events'):
                e['ev'] = r['events']
            if sk != (ds, cid):
                e['sr'] = [KEYS[sk[0]], sk[1]]
            out[cid] = e
        cases[key] = out
        print(f'{ds}: {len(out)} cases {time.time() - t0:.0f}s', flush=True)

    # ---------- trajectories ----------
    tri = {}
    chunks = defaultdict(dict)
    n_traj = 0
    if not args.no_traj:
        for ds, key in KEYS.items():
            todo = [(sd, sc) for (sd, sc) in sources if sd == ds]
            order = {c: i for i, c in enumerate(cases[key])}
            todo.sort(key=lambda x: order.get(x[1], 1 << 30))
            nsrc = 0
            for sd, sc in todo:
                ch = f'{key}__{nsrc // 40}'; nsrc += 1
                tri[sc] = ch
                ent = {'tr': {}, 't0': {}}
                for arm, path in sources[(sd, sc)].items():
                    blob = g.read(args.c_ref, path)
                    if not blob:
                        continue
                    raw = json.loads(gzip.decompress(blob))
                    if raw.get('trajectory'):
                        ent['tr'][arm] = bd.encode_traj(bd.pack_traj(raw['trajectory'])); n_traj += 1
                    ent['t0'][arm] = raw.get('command_sent_s')
                chunks[ch][sc] = ent
            print(f'{ds}: trajectories so far {n_traj} {time.time() - t0:.0f}s', flush=True)
    for key, cs in cases.items():
        for cid, e in cs.items():
            sc = e['sr'][1] if 'sr' in e else cid
            if sc in tri:
                e['ch'] = tri[sc]
                if 'sr' in e:
                    e['tk'] = sc
                    del e['sr']
                e['t'] = 1
            else:
                e.pop('sr', None)

    # ---------- mean utility (B's per-slot utility, averaged here; UNKNOWN excluded) ----------
    for r in rates:
        z = util_sum.get((r['scope'], r['arm']))
        r['mean_utility'] = (z[0] / z[1]) if z and z[1] else None
        r['mean_utility_n'] = z[1] if z else 0

    meta = {'built_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'b': Bc, 'c': Cc, 'arms': ARMS, 'why': WHY,
            'datasets': {ds: {'key': k, 'n': len(cases[k])} for ds, k in KEYS.items()},
            'rates': rates, 'paired': paired, 'times': times, 'funnels': funnels, 'primary_arms': primary_arms, 'primary_desc': primary_desc, 'gates': gates, 'facts': facts, 'paper': paper_tables(g, args.paper_ref), 'paper_commit': Pc,
            'sources': {'rates': f'B {Bc[:11]} · {D}/summary/RATES_BY_SUBSET.csv', 'paired': f'B {Bc[:11]} · {D}/summary/PAIRED_BY_SUBSET.csv',
                        'times': f'B {Bc[:11]} · {D}/summary/PAIRED_COMPLETION_TIMES.csv', 'funnels': f'B {Bc[:11]} · {D}/summary/OBSTACLE_FUNNELS.csv',
                        'gates': f'B {Bc[:11]} · {D}/summary/GATE_REVIEW.json, {D}/REPORT.md', 'primary': f'B {Bc[:11]} · {D}/summary/PRIMARY_ARMS.csv',
                        'mean': f'average of the per-slot utility in B {Bc[:11]} · {D}/formal_scores/*_SCORES.jsonl, UNKNOWN excluded (B does not publish this average)',
                        'paper': f'B {Pc[:11]} · {D}/paper_tables/SEVERE_ERROR_DECOMPOSITION.csv, T_obstacle_R13_BLOCK_minus_CLEAR.csv (CP-B-N)',
                        'cases': f'B {Bc[:11]} · {D}/runtime/*, {D}/formal_scores/*', 'traj': f'C {Cc[:9]} · research/method_v6_20261105/v612/release_r13_20261107/formal/captures/raw/**'}}
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    base = os.path.join(WEB, 'data', 's11')
    for sub in ('cases', 'traj'):
        p = os.path.join(base, sub)
        os.makedirs(p, exist_ok=True)
        for f in os.listdir(p):
            os.remove(os.path.join(p, f))
    open(os.path.join(base, 'meta.js'), 'w').write('window.SL_S11=' + dump(meta) + ';\n')
    open(os.path.join(base, 'trindex.js'), 'w').write('SL_S11_TRI(' + dump(tri) + ');\n')
    for key, cs in cases.items():
        open(os.path.join(base, 'cases', f'{key}.js'), 'w').write(f'SL_S11_CASES({json.dumps(key)},' + dump(cs) + ');\n')
    for name, obj in chunks.items():
        open(os.path.join(base, 'traj', f'{name}.js'), 'w').write(f'SL_S11_TRAJ({json.dumps(name)},' + dump(obj) + ');\n')
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(base) for f in fs)
    print(f'done: {sum(len(v) for v in cases.values())} cases, {n_traj} trajectories, data/s11 {total / 1e6:.1f} MB, {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
