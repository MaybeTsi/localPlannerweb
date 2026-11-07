#!/usr/bin/env python3
"""Right-rate numbers for the S11 summary, computed from B's published per-case answers (until B's formal table exists).

Definitions (MAINLINE prompt_web_right_rate_20261108.md):
  completable case  = intent is not "absent" and the case is not in O4 BLOCK
  should-stop case  = every other case (intent absent, or O4 BLOCK); a safe report counts as a correct stop
  UNKNOWN outcomes (no utility) are left out of the denominators
  obstacle sets use the BLOCK version only (BLOCK / CLEAR are two versions of the same case, counted once)
Reads data/s11/cases/*.js (per-slot outcomes, shipped with the page) and B's public_answers_20261107 (intent) through git objects.
Writes data/s11/rightrate.js  window.SL_RR = {...}
"""
import json, os, sys, time, glob
from collections import defaultdict
HERE = os.path.dirname(os.path.abspath(__file__)); WEB = os.path.dirname(HERE); REPO = os.path.abspath(os.path.join(WEB, '..', '..', '..'))
import importlib.util
_s = importlib.util.spec_from_file_location('bd', os.path.join(HERE, 'build_data.py')); bd = importlib.util.module_from_spec(_s); _s.loader.exec_module(bd)
ANS = 'research/public_answers_20261107'
SETS = {'main': 'S11_MAIN_SYNTH', 'clutter': 'S11_CLUTTER', 'hall': 'S11_DIVERSITY_F1', 'corner': 'S11_DIVERSITY_F2', 'real': 'S11_REAL', 'o1b': 'S11_OBS_O1_BLOCK', 'o3b': 'S11_OBS_O3_BLOCK', 'o4b': 'S11_OBS_O4_BLOCK'}
ARMS = ['method_R13', 'literal_if_feasible', 'nearest', 'v16']


def load(p):
    t = open(p).read(); i = t.index('('); j = t[i + 1:t.rindex(')')]; k = j.index(',')
    return json.loads(j[:k]), json.loads(j[k + 1:])


def main():
    ref = sys.argv[1] if len(sys.argv) > 1 else 'b61a7ca8ca0'
    g = bd.Git(REPO); commit = g.commit(ref)
    mt = open(os.path.join(WEB, 'data/s11/meta.js')).read(); meta = json.loads(mt[mt.index('=') + 1:mt.rindex(';')]); WHY = meta['why']
    STOP_WHY = {WHY.index(w) for w in ('safe_report', 'correct_report_absent_intent') if w in WHY}
    acc = defaultdict(lambda: defaultdict(lambda: [0] * 8))   # scope -> arm -> [c_n, c_d, s_n, s_d, rep_n, n_c, n_s, unknown]
    comp_count = defaultdict(lambda: [0, 0])
    for key, ds in SETS.items():
        cases = load(os.path.join(WEB, f'data/s11/cases/{key}.js'))[1]
        intent = {}
        for r in g.jsonl(ref, f'{ANS}/{ds}.answers.jsonl'):
            intent[r['case_id']] = r['intent']
        for cid, c in cases.items():
            it = intent.get(cid)
            should_stop = it == 'absent' or key == 'o4b'
            scopes = [ds] + (['S11_REAL/' + c['w']['scene']] if key == 'real' else []) + ['MIXED']
            for sc in scopes:
                comp_count[sc][1 if should_stop else 0] += 1
            for a in ARMS:
                q = c['a'].get(a)
                if not q:
                    continue
                u10, why = q[1], q[4]
                for sc in scopes:
                    v = acc[sc][a]
                    if u10 is None:
                        v[7] += 1; continue
                    if should_stop:
                        v[3] += 1; v[2] += 1 if (why in STOP_WHY) else 0
                    else:
                        v[1] += 1; v[0] += 1 if u10 >= 10 else 0; v[4] += 1 if (why in STOP_WHY) else 0
    out = {'commit': commit, 'rows': {sc: {a: v for a, v in d.items()} for sc, d in acc.items()}, 'counts': dict(comp_count)}
    open(os.path.join(WEB, 'data/s11/rightrate.js'), 'w').write('window.SL_RR=' + json.dumps(out, separators=(',', ':')) + ';\n')
    for sc in ['S11_MAIN_SYNTH', 'S11_REAL', 'S11_OBS_O1_BLOCK', 'S11_OBS_O4_BLOCK', 'MIXED']:
        print(sc, comp_count[sc], {a: acc[sc][a][:5] for a in ARMS})


if __name__ == '__main__':
    main()
