#!/usr/bin/env python3
"""S10 data for the scenario-library web page (main method v6).

Reads (never writes) other branches through git objects, only B's PUBLIC S10 export:
  B  codex/kappa-facts-20261028 @ --b-ref (default e926eea6)  research/s10_20261105/
       FORMAL_RATES.csv, FORMAL_CONFUSION.csv, FORMAL_POSTERIOR_STRATA.csv, S10_NUMBERS.json (comparisons)
       release/runtime/S10_*_runtime.jsonl            public inputs: world, start, utterance
       formal_scores/*/SCORES_V3.jsonl                per-slot behavior, utility, severe error, entered / completed candidate ids, literal feasibility
       REFERENCE_DECISIONS_PUBLIC.jsonl               actual vs reference decision (LITERAL / REPORT / candidate id) per slot
  C  codex/junction-decision-20261028                 raw records (trajectories) named by each score: only for a sample, see --traj

NOT in B's public S10 export, so NOT shipped and shown as "not exported" on the page:
  true intent, candidate list with geometry / posteriors, the reference's three expected scores (report / literal / best structure).
  B states these are private ("reference_expected_scores", "true_intent", "posterior" are excluded fields; case views are
  Git-external). S6/S8 have such case views under research/s8_20261105/case_view/; S10 has none.

Writes under the web directory:
  data/s10/meta.js        window.SL_S10 = {rates, confusion, strata, diffs, sets, counts, sources}
  data/s10/cases/<dataset>.js    SL_S10_CASES(name, {...})  per-case public fields for every slot (all 8,915 cases x 7 arms)
  data/s10/traj/<dataset>__<n>.js  SL_S10_TRAJ  base64 delta-varint trajectories for the sampled cases
"""
import argparse, base64, csv, gzip, io, json, os, subprocess, sys, time
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import importlib.util
_spec = importlib.util.spec_from_file_location('bd', os.path.join(HERE, 'build_data.py'))
bd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bd)

D = 'research/s10_20261105'
ARMS = ['v16', 'literal_if_feasible', 'nearest', 'method_v4', 'method_v6', 'v6_pi0_zero', 'v6_no_speed']
# dataset -> (web key, runtime file, scores dir)
DATASETS = {
    'S10_MAIN_SYNTH': ('main', 'C_05f75b4cd8d5_FIRST6_COMPLETE_S10_MAIN_SYNTH'),
    'S10_SHIFT_K': ('shiftK', 'C_05f75b4cd8d5_FIRST6_COMPLETE_S10_SHIFT_K'),
    'S10_SHIFT_ROUND': ('shiftR', 'C_05f75b4cd8d5_FIRST6_COMPLETE_S10_SHIFT_ROUND'),
    'S10_SHIFT_PRIOR': ('shiftP', 'C_05f75b4cd8d5_FIRST6_COMPLETE_S10_SHIFT_PRIOR'),
    'S10_CLUTTER': ('clutter', 'C_05f75b4cd8d5_FIRST6_COMPLETE_S10_CLUTTER'),
    'S10_DIVERSITY_F1': ('hall', 'C_05f75b4cd8d5_FIRST6_COMPLETE_S10_DIVERSITY_F1'),
    'S10_DIVERSITY_F2': ('corner', 'C_e523908087ce_DIVERSITY_F2'),
    'S10_REAL': ('real', 'C_38923c059615_REAL_COMPLETE'),
}
BEH = {'LITERAL_COMPLETED': 'L', 'STRUCTURE': 'S', 'STOP_REPORT': 'R', 'INCOMPLETE': 'I', 'COLLISION': 'C', 'UNKNOWN': '?', 'UNKNOWN_MULTIPLE_STRUCTURES': 'M'}
RATE_COLS = ['mean_geometry_equal_score', 'ci95', 'intent_completion_known', 'intent_completion_all_generated', 'intent_completed_plus1', 'known', 'generated', 'unknown',
             'severe_errors', 'severe_known', 'severe_rate_known', 'strict_matches', 'identifiable_reference_comparisons', 'strict_rate_identifiable',
             'action_equivalent_matches', 'action_equivalent_rate_identifiable', 'safe_report_credit']


def num(v):
    if v in ('', None):
        return None
    try:
        f = float(v)
        return int(f) if f == int(f) and '.' not in str(v) else f
    except ValueError:
        return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--b-ref', default='e926eea6')
    ap.add_argument('--c-ref', default='origin/codex/junction-decision-20261028')
    ap.add_argument('--traj-per-dataset', type=int, default=-1, help='cases per dataset (and kind) with trajectories; -1 = every case and every arm (default); 0 = none')
    ap.add_argument('--repo', default=None)
    args = ap.parse_args()
    repo = args.repo or bd.sh('git', 'rev-parse', '--show-toplevel', cwd=HERE).strip()
    g = bd.Git(repo)
    Bc, Cc = g.commit(args.b_ref), g.commit(args.c_ref)
    t0 = time.time()
    text = lambda p: g.read(args.b_ref, f'{D}/{p}').decode()

    # ---------- aggregate tables (B's own numbers, copied) ----------
    rates = []
    for r in csv.DictReader(io.StringIO(text('FORMAL_RATES.csv'))):
        row = {'scope': r['scope'], 'arm': r['arm']}
        for c in RATE_COLS:
            v = r[c]
            row[c] = json.loads(v) if c == 'ci95' and v else num(v)
        rates.append(row)
    confusion = [{'ds': r['dataset'], 'arm': r['arm'], 'true': r['true_intent_type'], 'beh': r['behavior'], 'n': int(r['n'])}
                 for r in csv.DictReader(io.StringIO(text('FORMAL_CONFUSION.csv')))]
    strata = []
    for r in csv.DictReader(io.StringIO(text('FORMAL_POSTERIOR_STRATA.csv'))):
        row = {'stratum': r['stratum'], 'scope': r['scope'], 'arm': r['arm']}
        for c in RATE_COLS:
            v = r[c]
            row[c] = json.loads(v) if c == 'ci95' and v else num(v)
        strata.append(row)
    nums = json.loads(text('S10_NUMBERS.json'))
    diffs = [{k: c[k] for k in ('scope', 'dataset', 'left', 'right', 'known_pairs', 'generated_pairs', 'unknown_pairs', 'known_geometry_equal_difference', 'known_ci95',
                                'most_adverse_completion_ci95', 'primary')} for c in nums['comparisons']]

    # ---------- per case (public only) ----------
    runtime_all, case_files, n_traj = {}, {}, 0
    for ds, (key, sdir) in DATASETS.items():
        runtime = g.jsonl(args.b_ref, f'{D}/release/runtime/{ds}_runtime.jsonl')
        scores = {}
        for s in g.jsonl(args.b_ref, f'{D}/formal_scores/{sdir}/SCORES_V3.jsonl'):
            scores[(s['case_id'], s['arm'])] = s
        runtime_all[ds] = (runtime, scores)
    # reference decisions once for all datasets
    ref = {}
    for r in g.jsonl(args.b_ref, f'{D}/REFERENCE_DECISIONS_PUBLIC.jsonl'):
        ref[(r['case_id'], r['arm'])] = [r['actual_decision'], r['reference_decision'], r['strict_match'], r['action_equivalent_match']]

    cases, counts = {}, {}
    for ds, (key, sdir) in DATASETS.items():
        runtime, scores = runtime_all[ds]
        out, picked, per_kind = {}, [], Counter()
        for r in runtime:
            cid, kind = r['case_id'], r['kind']
            w, u = r['world'], r['utterance']
            slot = {}
            for arm in ARMS:
                s = scores.get((cid, arm))
                if not s:
                    slot[arm] = None
                    continue
                u10 = None if s['utility'] is None else int(round(s['utility'] * 10))
                sev = 1 if s['severe_error'] else (0 if s['severe_error'] is False else None)
                done = [c['candidate_id'] for c in (s.get('completed_candidates') or []) if c.get('completed')]
                rf = ref.get((cid, arm))
                slot[arm] = [BEH.get(s['behavior'], '?'), u10, sev, s['entered_candidates'], done, rf[0] if rf else None, rf[1] if rf else None, rf[2] if rf else None]
            lit = None
            s6 = scores.get((cid, 'method_v6'))
            if s6:
                lit = [s6['literal_geometry']['physical']['category'], s6['literal_geometry']['planning']['category']]
            entry = {'k': kind, 'u': {k: v for k, v in u.items() if k != 'corrected_target'}, 'lit': lit, 'a': slot,
                     'w': {'b': [bd.r3(v) for v in w['bounds']], 'r': [[bd.r3(v) for v in q] for q in w.get('free_rectangles') or []],
                           'o': [[bd.r3(v) for v in q] for q in (w.get('blocked_rectangles') or [])], 's': [bd.r3(v) for v in w['initial_pose']]}}
            if w.get('scene'):
                entry['w']['scene'] = w['scene']
            if u.get('follow_forward_m') is not None:
                entry['fw'] = u['follow_forward_m']
            out[cid] = entry
            if args.traj_per_dataset < 0:
                picked.append(cid)
            elif args.traj_per_dataset and per_kind[kind] < max(1, args.traj_per_dataset // 10):
                per_kind[kind] += 1
                picked.append(cid)
        cases[ds] = out
        counts[ds] = len(out)
        # trajectories for a sample: v6 and literal_if_feasible (the comparison of the main result)
        chunks = {}
        for cid in picked:
            row = {}
            for arm in ARMS:
                s = runtime_all[ds][1].get((cid, arm))
                if not s or not s.get('source_path'):
                    continue
                blob = g.read(args.c_ref, s['source_path'])
                if blob:
                    raw = json.loads(gzip.decompress(blob))
                    if raw.get('trajectory'):
                        row[arm] = bd.encode_traj(bd.pack_traj(raw['trajectory']))
                        n_traj += 1
                    out[cid].setdefault('t0', {})[arm] = raw.get('command_sent_s')
            if row:
                n_in = sum(len(v) for v in chunks.values())
                ch = f'{key}__{n_in // 40}'
                chunks.setdefault(ch, {})[cid] = row
                out[cid]['t'] = 1
                out[cid]['ch'] = ch      # the page loads exactly this chunk file
        case_files[key] = (ds, chunks)
        print(f'{ds}: {len(out)} cases, {n_traj} trajectories so far, {time.time() - t0:.0f}s', flush=True)

    meta = {'built_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'b': Bc, 'c': Cc, 'arms': ARMS,
            'datasets': {ds: {'key': k, 'n': counts[ds]} for ds, (k, _) in DATASETS.items()},
            'rates': rates, 'confusion': confusion, 'strata': strata, 'diffs': diffs,
            'status': nums.get('status'), 'primary_gate': nums.get('primary_gate'),
            'generated_inputs': nums.get('generated_inputs'), 'scored_slots': nums.get('scored_slots'), 'not_generated_inputs': nums.get('not_generated_inputs'),
            'sources': {
                'rates': f'B {Bc[:9]} · {D}/FORMAL_RATES.csv', 'confusion': f'B {Bc[:9]} · {D}/FORMAL_CONFUSION.csv',
                'strata': f'B {Bc[:9]} · {D}/FORMAL_POSTERIOR_STRATA.csv', 'diffs': f'B {Bc[:9]} · {D}/S10_NUMBERS.json (comparisons), REPORT.md',
                'cases': f'B {Bc[:9]} · {D}/release/runtime/*, {D}/formal_scores/*/SCORES_V3.jsonl, {D}/REFERENCE_DECISIONS_PUBLIC.jsonl',
                'traj': f'C {Cc[:9]} · raw records named in each B score'},
            'not_exported': ['true_intent', 'candidates', 'posterior', 'expected_scores'], 'traj_per_dataset': args.traj_per_dataset}

    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    for sub in ('cases', 'traj'):
        p = os.path.join(WEB, 'data', 's10', sub)
        os.makedirs(p, exist_ok=True)
        for f in os.listdir(p):
            os.remove(os.path.join(p, f))
    open(os.path.join(WEB, 'data', 's10', 'meta.js'), 'w').write('window.SL_S10=' + dump(meta) + ';\n')
    for key, (ds, chunks) in case_files.items():
        open(os.path.join(WEB, 'data', 's10', 'cases', f'{key}.js'), 'w').write(f'SL_S10_CASES({json.dumps(key)},' + dump(cases[ds]) + ');\n')
        for name, obj in chunks.items():
            open(os.path.join(WEB, 'data', 's10', 'traj', f'{name}.js'), 'w').write(f'SL_S10_TRAJ({json.dumps(name)},' + dump(obj) + ');\n')
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(os.path.join(WEB, 'data', 's10')) for f in fs)
    print(f'done: {sum(counts.values())} cases, {n_traj} trajectories, data/s10 {total / 1e6:.1f} MB, {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
