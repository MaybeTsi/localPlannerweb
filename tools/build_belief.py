#!/usr/bin/env python3
"""Probabilities for the "how the method thinks" panel.

Reads (never writes) through git objects:
  C  codex/junction-decision-20261028 @ --c-ref (default 22be5a8c105)  research/method_v6_20261105/v612/online_belief_export/<dataset>.jsonl  (CP-C-B)
       one row per case and arm: hypotheses, trace (t, progress_m, pose_xy, posterior, admitted, expected_score, action, slow), decision, id_map
       S11 five base sets x {method_R13, method_v6}, S10 main set x {method_v6, method_v4}
  B  codex/kappa-facts-20261028 @ --b-ref (default a6b41931fb7)  research/public_answers_20261107/reference_belief/<dataset>.reference_belief.jsonl  (CP-B-RB)
       the scorer's full POMDP: posterior at the decision, expected scores, available actions, decision, candidate catalogue

Writes
  data/belief/<dataset>__<arm>__<k>.js   SL_BELIEF(name, {caseId: record})   k = crc32(caseId) % chunks
  data/belief/ref/<dataset>__<k>.js      SL_BELIEF_REF(name, {caseId: record})
  data/belief/index.js                   SL_BELIEF_INDEX({commit_c, commit_b, chunks: {...}, ref_chunks: {...}, arms: {dataset: [arm...]}})
Nothing is computed here except rounding and re-indexing; probabilities are copied as exported (not normalised).
"""
import argparse, json, math, os, sys, time, zlib
HERE = os.path.dirname(os.path.abspath(__file__)); WEB = os.path.dirname(HERE); REPO = os.path.abspath(os.path.join(WEB, '..', '..', '..'))
import importlib.util
_s = importlib.util.spec_from_file_location('bd', os.path.join(HERE, 'build_data.py')); bd = importlib.util.module_from_spec(_s); _s.loader.exec_module(bd)
ON = 'research/method_v6_20261105/v612/online_belief_export'
RF = 'research/public_answers_20261107/reference_belief'
DATASETS = ['S11_MAIN_SYNTH', 'S11_CLUTTER', 'S11_DIVERSITY_F1', 'S11_DIVERSITY_F2', 'S11_REAL', 'S10_MAIN_SYNTH']
PER = 40


def r4(v):
    return None if v is None else round(v, 4)


def online(r):
    hyp = r['hypotheses']; ids = [h['id'] for h in hyp]; ix = {h: i for i, h in enumerate(ids)}
    def arr(d, n=len(ids)):
        out = [None] * n
        for k, v in (d or {}).items():
            if k in ix and v is not None:
                out[ix[k]] = r4(v)
        return out
    tr = [[r4(p['t']), r4(p['progress_m']), arr(p['posterior']), arr(p['admitted']), arr(p['expected_score']), p['action'], 1 if p.get('slow') else 0] for p in r['trace']]
    d = r['decision'] or {}
    out = {'h': [[h['id'], h['kind'], r4(h['center_xy'][0]) if h.get('center_xy') else None, r4(h['center_xy'][1]) if h.get('center_xy') else None, h.get('side'), r4(h.get('first_seen_t'))] for h in hyp],
           't': tr, 'd': [r4(d.get('t')), r4(d.get('progress_m')), d.get('action'), ix.get(d.get('chosen_id'))] if d.get('action') else None,
           'm': {str(ix[k]): v['candidate_k'] for k, v in (r.get('id_map') or {}).items() if k in ix and v.get('status') == 'MATCHED'}}
    cov = r.get('coverage') or {}
    if not tr:
        out['e'] = cov.get('empty_reason') or 'EMPTY'
    flags = [k for k in ('weights_not_normalized', 'unnormalized_posterior', 'posterior_weights_not_normalized') if cov.get(k)]
    if flags:
        out['u'] = 1
    return out


def reference(r):
    q = r['reference']
    cand = [[c['id'], r4(c['center_xy'][0]), r4(c['center_xy'][1]), c.get('side'), r4(c.get('width_m')), 1 if c.get('positive_posterior_support') else 0] for c in (q.get('candidates') or []) if c.get('in_posterior_dictionary')]
    es = q.get('expected_scores')
    es = es if isinstance(es, dict) else None
    return {'st': q.get('status'), 'p': {k: r4(v) for k, v in (q.get('posterior_at_decision') or {}).items()} if isinstance(q.get('posterior_at_decision'), dict) else None,
            'es': ({'l': r4(es.get('literal')), 'r': r4(es.get('report')), 's': {k: r4(v) for k, v in (es.get('structures') or {}).items()}} if es and not isinstance(es.get('structures'), str) else None),
            'av': (q.get('available_actions_at_source_node') or (q.get('posterior_trace') or [{}])[0].get('available_actions_at_source_node')) if isinstance(q.get('posterior_trace'), list) and q['posterior_trace'] else q.get('available_actions_at_source_node'),
            'd': q.get('decision'), 'c': cand}


def dump(path, fn, name, obj):
    open(path, 'w').write(f'{fn}({json.dumps(name)},' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ');\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--c-ref', default='22be5a8c105'); ap.add_argument('--b-ref', default='a6b41931fb7')
    ap.add_argument('--arms', default='all', help='all, or comma list e.g. method_R13,method_v6')
    args = ap.parse_args()
    g = bd.Git(REPO); cc = g.commit(args.c_ref); bc = g.commit(args.b_ref)
    base = os.path.join(WEB, 'data', 'belief'); os.makedirs(os.path.join(base, 'ref'), exist_ok=True)
    for sub in (base, os.path.join(base, 'ref')):
        for f in os.listdir(sub):
            if f.endswith('.js'):
                os.remove(os.path.join(sub, f))
    index = {'commit_c': cc, 'commit_b': bc, 'chunks': {}, 'ref_chunks': {}, 'arms': {}}
    want = None if args.arms == 'all' else set(args.arms.split(','))
    t0 = time.time()
    for ds in DATASETS:
        rows = g.jsonl(args.c_ref, f'{ON}/{ds}.jsonl')
        by_arm = {}
        for r in rows:
            if want and r['arm'] not in want:
                continue
            by_arm.setdefault(r['arm'], {})[r['case_id']] = online(r)
        for arm, cs in by_arm.items():
            n = max(1, math.ceil(len(cs) / PER)); ch = {}
            for cid, rec in cs.items():
                ch.setdefault(zlib.crc32(cid.encode()) % n, {})[cid] = rec
            for k, obj in ch.items():
                dump(os.path.join(base, f'{ds}__{arm}__{k}.js'), 'SL_BELIEF', f'{ds}__{arm}__{k}', obj)
            index['chunks'][f'{ds}__{arm}'] = n
            index['arms'].setdefault(ds, []).append(arm)
        refs = {r['case_id']: reference(r) for r in g.jsonl(args.b_ref, f'{RF}/{ds}.reference_belief.jsonl')}
        n = max(1, math.ceil(len(refs) / PER)); ch = {}
        for cid, rec in refs.items():
            ch.setdefault(zlib.crc32(cid.encode()) % n, {})[cid] = rec
        for k, obj in ch.items():
            dump(os.path.join(base, 'ref', f'{ds}__{k}.js'), 'SL_BELIEF_REF', f'{ds}__{k}', obj)
        index['ref_chunks'][ds] = n
        print(f'{ds}: online arms {list(by_arm)} cases {len(refs)} {time.time() - t0:.0f}s', flush=True)
    open(os.path.join(base, 'index.js'), 'w').write('SL_BELIEF_INDEX(' + json.dumps(index, separators=(',', ':')) + ');\n')
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(base) for f in fs)
    print(f'done: data/belief {size / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
