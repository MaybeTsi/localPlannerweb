#!/usr/bin/env python3
"""Right rates for the S11 summary: B's formal table (CP-B-R).

Reads (never writes) through git objects:
  B  codex/kappa-facts-20261028 @ --b-ref (default 985016bceac)
       research/s11_20261106/RIGHT_RATE_RATES_20261108.csv   scope x arm x metric: eligible_total, numerator, known_denominator, UNKNOWN,
                                                              known_rate, adverse (all unknown wrong) / favorable (all unknown right) rates
       research/s11_20261106/RIGHT_RATE_SUMMARY_20261108.json partition (13,130 = 9,912 completable + 3,218 should-stop)
  and, only for the real-map note "stopped to report although a door was reachable", B's published per-case answers
       research/public_answers_20261107/ (intent) with the per-case outcomes shipped in data/s11/cases.

Writes data/s11/rightrate.js  window.SL_RR = {commit, partition, rows: {scope: {arm: {c: [x, K, N], s: [...], t: [...]}}}, rep: {scope: {arm: [reported_n, completable_n]}}}
"""
import csv, io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); WEB = os.path.dirname(HERE); REPO = os.path.abspath(os.path.join(WEB, '..', '..', '..'))
import importlib.util
_s = importlib.util.spec_from_file_location('bd', os.path.join(HERE, 'build_data.py')); bd = importlib.util.module_from_spec(_s); _s.loader.exec_module(bd)
D = 'research/s11_20261106'
ARMS = ['method_R13', 'literal_if_feasible', 'nearest', 'v16']
KEY = {'completion_rate': 'c', 'correct_stop_rate': 's', 'total_right_rate': 't'}


def load(p):
    t = open(p).read(); i = t.index('('); j = t[i + 1:t.rindex(')')]; k = j.index(',')
    return json.loads(j[:k]), json.loads(j[k + 1:])


def main():
    ref = sys.argv[1] if len(sys.argv) > 1 else '985016bceac'
    g = bd.Git(REPO); commit = g.commit(ref)
    rows = {}
    for r in csv.DictReader(io.StringIO(g.read(ref, f'{D}/RIGHT_RATE_RATES_20261108.csv').decode())):
        if r['arm'] not in ARMS:
            continue
        rows.setdefault(r['scope'], {}).setdefault(r['arm'], {})[KEY[r['metric']]] = [int(r['numerator']), int(r['known_denominator']), int(r['eligible_total'])]
    part = json.loads(g.read(ref, f'{D}/RIGHT_RATE_SUMMARY_20261108.json'))['partition']
    # real-map note: completable cases where the method stopped and reported
    mt = open(os.path.join(WEB, 'data/s11/meta.js')).read(); meta = json.loads(mt[mt.index('=') + 1:mt.rindex(';')]); WHY = meta['why']
    STOP = {WHY.index(w) for w in ('safe_report', 'correct_report_absent_intent') if w in WHY}
    cases = load(os.path.join(WEB, 'data/s11/cases/real.js'))[1]
    intent = {r['case_id']: r['intent'] for r in g.jsonl('b61a7ca8ca0', 'research/public_answers_20261107/S11_REAL.answers.jsonl')}
    rep = {}
    for cid, c in cases.items():
        if intent.get(cid) == 'absent':
            continue
        for sc in ('S11_REAL', 'S11_REAL/' + c['w']['scene']):
            for a in ARMS:
                q = c['a'].get(a)
                if not q or q[1] is None:
                    continue
                v = rep.setdefault(sc, {}).setdefault(a, [0, 0]); v[1] += 1; v[0] += 1 if q[4] in STOP else 0
    open(os.path.join(WEB, 'data/s11/rightrate.js'), 'w').write('window.SL_RR=' + json.dumps({'commit': commit, 'partition': part, 'rows': rows, 'rep': rep}, separators=(',', ':')) + ';\n')
    for sc in ('S11_MAIN_SYNTH', 'S11_REAL', 'ALL_LOGICAL'):
        print(sc, {a: [rows[sc][a][k] for k in 'cst'] for a in ARMS[:1]})
    print('rep real', rep['S11_REAL']['method_R13'])


if __name__ == '__main__':
    main()
