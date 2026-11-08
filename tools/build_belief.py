#!/usr/bin/env python3
"""Online belief of the method per case, for the "how the method thinks" panel on the case page.

Until the designated exports exist (C: research/method_v6_20261105/v612/online_belief_export/ = CP-C-B; B: research/public_answers_20261107/reference_belief/ = CP-B-RB)
this reads what C already keeps for every run: the per-cycle diagnostic log named by each raw capture (`diagnostic_log_path`):
posterior over {follow the words, each opening seen so far, not seen yet}, whether each action could be carried out, the expected scores
at the decision and the decision itself. Reads only through git objects (read-only).

Usage: build_belief.py [case_id:arm ...]   (default: the three first cases)
Writes data/belief/<safe id>__<arm>.js  SL_BELIEF(key, {...})   and data/belief/index.js  SL_BELIEF_INDEX({caseId: [arm...]})
"""
import csv, gzip, io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); WEB = os.path.dirname(HERE); REPO = os.path.abspath(os.path.join(WEB, '..', '..', '..'))
import importlib.util
_s = importlib.util.spec_from_file_location('bd', os.path.join(HERE, 'build_data.py')); bd = importlib.util.module_from_spec(_s); _s.loader.exec_module(bd)
BS11, BS10, C = '5248ac7ef23', 'e926eea6', 'origin/codex/junction-decision-20261028'
S10DIR = {'S10_MAIN_SYNTH': 'C_05f75b4cd8d5_FIRST6_COMPLETE_S10_MAIN_SYNTH'}
DEFAULT = ['S11_MAIN_SYNTH:06:0049:method_R13', 'S11_MAIN_SYNTH:01:0026:method_R13', 'S10_MAIN_SYNTH:06:0003:method_v6']
UNRES = 'UNRESOLVED_BEYOND_OBSERVED_MAP'


def r4(v):
    return round(v, 4) if isinstance(v, float) else v


def source_path(g, ds, cid, arm, cache={}):
    if ds.startswith('S11'):
        key = (BS11, ds)
        if key not in cache:
            cache[key] = {(s['case_id'], s['arm']): s for s in g.jsonl(BS11, f'research/s11_20261106/formal_scores/{ds}_SCORES.jsonl')}
    else:
        key = (BS10, ds)
        if key not in cache:
            cache[key] = {(s['case_id'], s['arm']): s for s in g.jsonl(BS10, f'research/s10_20261105/formal_scores/{S10DIR[ds]}/SCORES_V3.jsonl')}
    return cache[key][(cid, arm)]['source_path']


def extract(d):
    cyc = d['cycles']
    ids, geo = [], {}
    for c in cyc:
        for x in c['candidates']:
            if x['id'] not in ids:
                ids.append(x['id'])
            if x.get('kind') == 'opening' and x.get('goal'):
                gt = x.get('gate') or {}
                geo[x['id']] = [r4(x['goal'][0]), r4(x['goal'][1]), x.get('side'), r4(gt.get('width') or 1.0)]
        for k in c['posterior']:
            if k not in ids and k != UNRES:
                ids.append(k)
    lit = [i for i in ids if i == 'Z0_LITERAL' or i.startswith('Z0')]
    ops = sorted([i for i in ids if i in geo], key=lambda i: geo[i][0])
    hyp = lit + ops + [UNRES]
    first_dec = next((i for i, c in enumerate(cyc) if c['action'] != 'CONTINUE'), None)
    last = (first_dec + 1) if first_dec is not None else len(cyc)
    rows = []
    for c in cyc[:last]:
        post = c['posterior']
        adm = {}
        for x in c['candidates']:
            ee = x.get('execution_evidence') or {}
            adm[x['id']] = 1 if ee.get('admitted') else 0
        rows.append([r4(c['t']), r4(c.get('progress_m') or 0.0), [r4(post.get(h, 0.0)) for h in hyp], [adm.get(h, 2) if h != UNRES else 2 for h in hyp]])
    dec = None
    if first_dec is not None:
        c = cyc[first_dec]
        ch = c.get('chosen') or {}
        dec = {'i': first_dec, 'a': c['action'], 'why': c.get('reason'), 't': r4(c['t']), 'p': r4(c.get('progress_m') or 0.0), 'id': ch.get('id') if c['action'] == 'COMMIT' else ('Z0_LITERAL' if c['action'] == 'KEEP_LITERAL' else None),
               'sc': {k: r4(v) for k, v in (c.get('expected_score_table') or {}).items()}, 'av': {k: r4(v) for k, v in (c.get('available_expected_scores') or {}).items()},
               'dl': r4(c.get('decision_deadline_m')) if c.get('decision_deadline_m') is not None else None}
    return {'h': hyp, 'geo': geo, 'c': rows, 'd': dec, 'pi0': ((cyc[0].get('v5') or {}).get('pi0'))}


def main():
    cases = sys.argv[1:] or DEFAULT
    g = bd.Git(REPO)
    base = os.path.join(WEB, 'data', 'belief'); os.makedirs(base, exist_ok=True)
    idxp = os.path.join(base, 'index.js')
    index = {}
    if os.path.exists(idxp):
        t = open(idxp).read(); index = json.loads(t[t.index('(') + 1:t.rindex(')')])
    for spec in cases:
        cid, arm = spec.rsplit(':', 1)
        import re
        m = re.search(r':O([134]):(BLOCK|CLEAR)$', cid)
        ds = f'S11_OBS_O{m.group(1)}_{m.group(2)}' if m else cid.split(':')[0]
        sp = source_path(g, ds, cid, arm)
        raw = json.loads(gzip.decompress(g.read(C, sp)))
        diag = json.loads(gzip.decompress(g.read(C, raw['diagnostic_log_path'])))
        out = extract(diag)
        out['arm'] = arm
        safe = cid.replace(':', '_') + '__' + arm
        open(os.path.join(base, safe + '.js'), 'w').write(f'SL_BELIEF({json.dumps(safe)},' + json.dumps(out, separators=(',', ':')) + ');\n')
        index.setdefault(cid, [])
        if arm not in index[cid]:
            index[cid].append(arm)
        print(spec, 'cycles', len(out['c']), 'hyp', out['h'], 'decision', out['d'] and (out['d']['a'], out['d']['id'], out['d']['p']))
    open(idxp, 'w').write('SL_BELIEF_INDEX(' + json.dumps(index, separators=(',', ':')) + ');\n')


if __name__ == '__main__':
    main()
