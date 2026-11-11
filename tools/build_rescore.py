#!/usr/bin/env python3
"""Rescoring by the actual turn point (B, research/physical_rescore_20261108).

Reads (never writes) through git objects:
  B  codex/kappa-facts-20261028 @ --b-ref (default e88e502e38e)  research/physical_rescore_20261108/
       PHYSICAL_PER_CASE.csv (12,248 audited arm records: old / new score, turn point, tolerance, checks)
       TABLE2_PAIRED.csv (paired comparisons old vs physical), COMPUTATION_CHECKS.json (A / B counts)
Writes
  data/rescore/<dataset>.js   SL_RESCORE(dataset, {caseId: {d, t, o, a: {arm: [old, new, turn_x, turn_y, flags, endpoint_reason, AB]}}})
        only cases in which at least one arm's old and new score differ; every audited arm of such a case is kept so the map can show all turn points
  data/rescore/summary.js     SL_RESCORE_SUMMARY({...counts and paired comparisons copied from B})
Nothing is computed here except re-indexing and counting rows; numbers are copied as exported.
"""
import argparse, csv, io, json, os, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__)); WEB = os.path.dirname(HERE); REPO = os.path.abspath(os.path.join(WEB, '..', '..', '..'))
_s = importlib.util.spec_from_file_location('bd', os.path.join(HERE, 'build_data.py')); bd = importlib.util.module_from_spec(_s); _s.loader.exec_module(bd)
DIR = 'research/physical_rescore_20261108'
ER = ['NO_FOLLOW_LEG_KIND01', 'WHOLE_CAR_IN_FROZEN_LITERAL_OPENING', 'OUTSIDE_FROZEN_LITERAL_REGION', 'NO_CACHED_LITERAL_REGION']


def num(v):
    return None if v in ('', None) else float(v)


def r3(v):
    return None if v is None else round(v, 3)


def tf(v):
    return 1 if v == 'True' else 0 if v == 'False' else None


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--b-ref', default='e88e502e38e'); args = ap.parse_args()
    g = bd.Git(REPO); bc = g.commit(args.b_ref)
    rows = list(csv.DictReader(io.StringIO(g.read(args.b_ref, f'{DIR}/PHYSICAL_PER_CASE.csv').decode())))
    t2 = list(csv.DictReader(io.StringIO(g.read(args.b_ref, f'{DIR}/TABLE2_PAIRED.csv').decode())))
    chk = json.loads(g.read(args.b_ref, f'{DIR}/COMPUTATION_CHECKS.json').decode())
    changed = {(x['case_id']) for x in rows if num(x['old_utility']) != num(x['new_utility'])}
    by_ds = {}
    for x in rows:
        if x['case_id'] not in changed:
            continue
        ds = x['dataset']; c = by_ds.setdefault(ds, {}).setdefault(x['case_id'], {'d': r3(num(x['uttered_distance_m'])), 't': r3(num(x['tolerance_m'])), 'o': [r3(v) for v in json.loads(x['origin_pose'])], 'k': x['kind'], 'a': {}})
        ab = 'A' if x['A_old_plus1_physical_false'] == 'True' else 'B' if x['B_old_minus1_physical_true'] == 'True' else ''
        er = ER.index(x['endpoint_reason']) if x['endpoint_reason'] in ER else None
        c['a'][x['arm']] = [r3(num(x['old_utility'])), r3(num(x['new_utility'])), r3(num(x['turn_x'])), r3(num(x['turn_y'])), r3(num(x['turn_axis_m'])), [tf(x['distance_ok']), tf(x['direction_ok']), tf(x['endpoint_ok']), tf(x['turn_found'])], er, ab, x['intent_type']]
    out = os.path.join(WEB, 'data', 'rescore'); os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith('.js'):
            os.remove(os.path.join(out, f))
    for ds, cs in by_ds.items():
        open(os.path.join(out, f'{ds}.js'), 'w').write('SL_RESCORE(' + json.dumps(ds) + ',' + json.dumps(cs, separators=(',', ':')) + ');\n')
    # summary: counts of audited records, A / B per set, transitions, and the paired comparisons exactly as B lists them
    aud, ab = {}, {}
    for x in rows:
        ds = x['dataset']; aud[ds] = aud.get(ds, 0) + 1
        for k, f in (('A', 'A_old_plus1_physical_false'), ('B', 'B_old_minus1_physical_true')):
            if x[f] == 'True':
                ab.setdefault(ds, {'A': 0, 'B': 0})[k] += 1
    trans = {}
    for x in rows:
        o, n = num(x['old_utility']), num(x['new_utility'])
        if o != n:
            k = f"{'U' if o is None else int(o) if o in (-1, 0, 1) else o}>{'U' if n is None else int(n) if n in (-1, 0, 1) else n}"
            trans[k] = trans.get(k, 0) + 1
    pair = []
    for x in t2:
        if x['metric'] == 'utility' and x['cohort'] == 'COMMON_FOUR_KNOWN':
            pair.append({'scope': x['scope'], 'pop': x['population'], 'l': x['left'], 'r': x['right'], 'n': int(x['n']), 'od': r3(float(x['old_difference'])), 'oc': [r3(v) for v in json.loads(x['old_CI'])], 'nd': r3(float(x['new_difference'])), 'nc': [r3(v) for v in json.loads(x['new_CI'])], 'flip': x['sign_flipped'] == 'True', 'o0': x['old_CI_excludes_zero'] == 'True', 'n0': x['new_CI_excludes_zero'] == 'True'})
    summ = {'commit_b': bc, 'dir': DIR, 'audited': aud, 'AB': ab, 'checks': {k: chk[k] for k in ('audited_cases', 'audited_arm_records', 'all_parent_score_rows', 'changed_score_rows', 'A', 'B', 'different_turn_pairs', 'R13_later_pairs', 'missing_turn_pairs')}, 'transitions': trans, 'paired': pair,
            'cases': {ds: len(cs) for ds, cs in by_ds.items()}}
    open(os.path.join(out, 'summary.js'), 'w').write('SL_RESCORE_SUMMARY(' + json.dumps(summ, ensure_ascii=False, separators=(',', ':')) + ');\n')
    size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    print('cases with a changed arm:', {ds: len(cs) for ds, cs in by_ds.items()}, f'{size / 1e3:.0f} KB', 'A', chk['A'], 'B', chk['B'], 'changed rows', sum(trans.values()))


if __name__ == '__main__':
    main()
