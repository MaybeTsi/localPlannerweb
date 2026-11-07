#!/usr/bin/env python3
"""Per-case public answers (S10 and S11) for the "show the intended meaning" / "guess first" features.

Reads (never writes) B's public export through git objects:
  B  codex/kappa-facts-20261028 @ --b-ref (default b61a7ca8ca0)  research/public_answers_20261107/
       INDEX.json, <dataset>.answers.jsonl      one row per case (S10 8,915 + S11 13,130)
Keeps only the fields the page shows: intent, target (id, centre, width, side, longitudinal position, tangent / inward, depth,
finite-reference window and deadline), literal (anchor point, feasibility category), reference decision and expected scores,
obstacle flags. Strings such as "UNKNOWN" are kept as they are. Seeds, posteriors and witness routes are not in the export.

Writes data/answers/<dataset>__<k>.js  SL_ANS(name, {caseId: record})   chunk k = crc32(caseId) % ceil(n / 40)
       data/answers/index.js          SL_ANS_INDEX({dataset: n_chunks}), plus the source commit.
The page loads a chunk only when the reader asks for the answer (switch / reveal), never together with the case input.
"""
import argparse, json, os, sys, time, zlib, math
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(WEB, '..', '..', '..'))
import importlib.util
_spec = importlib.util.spec_from_file_location('bd', os.path.join(HERE, 'build_data.py'))
bd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bd)
D = 'research/public_answers_20261107'


def rnd(v, d=5):
    if isinstance(v, float):
        return round(v, d)
    if isinstance(v, list):
        return [rnd(x, d) for x in v]
    if isinstance(v, dict):
        return {k: rnd(x, d) for k, x in v.items()}
    return v


def compact(r):
    t = r.get('target')
    lit = r.get('literal') or {}
    ref = r.get('reference') or {}
    ob = r.get('obstacle')
    out = {'i': r['intent']}
    if t:
        out['t'] = rnd({'id': t.get('id'), 'c': t.get('center_xy'), 'w': t.get('width_m'), 's': t.get('side'), 'l': t.get('longitudinal_m'), 'tg': t.get('tangent'), 'in': t.get('inward'),
                        'd': t.get('depth_m'), 'k': t.get('kind'), 'fw': t.get('finite_reference_window_progress_m'), 'fd': t.get('finite_reference_deadline_progress_m'),
                        'fp': t.get('finite_reference_deadline_position_xy'), 'sf': t.get('side_frame')})
    out['l'] = rnd({'a': lit.get('action_anchor_xy'), 'f': lit.get('exact_action_feasibility'), 'c': lit.get('category'), 'r': lit.get('reason')})
    out['r'] = rnd({'st': ref.get('status'), 'rs': ref.get('reason'), 'd': ref.get('decision'), 'sc': ref.get('expected_scores'), 'p': ref.get('decision_progress_m')})
    if ob:
        out['o'] = {'f': ob.get('family'), 'c': ob.get('condition'), 'm': ob.get('must_pass_boxes'), 'w': ob.get('witness_exists')}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--b-ref', default='b61a7ca8ca0')
    args = ap.parse_args()
    t0 = time.time()
    g = bd.Git(REPO)
    Bc = g.commit(args.b_ref)
    idx = json.loads(g.read(args.b_ref, f'{D}/INDEX.json'))
    names = [d['dataset'] for d in idx['datasets'] if d.get('cases')]
    base = os.path.join(WEB, 'data', 'answers')
    os.makedirs(base, exist_ok=True)
    for f in os.listdir(base):
        os.remove(os.path.join(base, f))
    index = {}
    total = 0
    for ds in names:
        rows = g.jsonl(args.b_ref, f'{D}/{ds}.answers.jsonl')
        nch = max(1, math.ceil(len(rows) / 40))
        chunks = {}
        for r in rows:
            chunks.setdefault(zlib.crc32(r['case_id'].encode()) % nch, {})[r['case_id']] = compact(r)
        for k, obj in chunks.items():
            open(os.path.join(base, f'{ds}__{k}.js'), 'w').write(f'SL_ANS({json.dumps(ds + "__" + str(k))},' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ');\n')
        index[ds] = nch
        total += len(rows)
        print(f'{ds}: {len(rows)} cases, {nch} chunks, {time.time() - t0:.0f}s', flush=True)
    open(os.path.join(base, 'index.js'), 'w').write('SL_ANS_INDEX(' + json.dumps({'commit': Bc, 'chunks': index, 'path': D, 'cases': total}, separators=(',', ':')) + ');\n')
    size = sum(os.path.getsize(os.path.join(base, f)) for f in os.listdir(base))
    print(f'done: {total} cases, data/answers {size / 1e6:.1f} MB, {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
