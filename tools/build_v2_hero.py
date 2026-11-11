#!/usr/bin/env python3
"""Example cases for the live replay on the v2 home page (index_v2.html).

Reads the data files this site already ships (written by tools/build_s11.py): data/s11/cases/main.js and data/s11/traj/<chunk>.js.
Selection rule: these are showcase examples, chosen on purpose among the cases OUR METHOD COMPLETED (score +1): in the main synthetic set,
for every instruction kind, the completed case with the smallest case id for which all four public methods have a recorded trajectory.
They are not a representative sample; the page says so next to the replay, and the overall rates are shown right below it.
Writes data/v2/hero.js   SL_V2_HERO({rule, cases: [{id, k, u, w, a: {arm: score row}, tr: {arm: encoded trajectory}, t0: {arm: t}}]})
Nothing is computed; the rows and trajectories are copied as they are.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); WEB = os.path.dirname(HERE)
ARMS = ['method_R13', 'literal_if_feasible', 'nearest', 'v16']


def call(path):
    s = open(path, encoding='utf-8').read(); return json.loads(s[s.index('{', s.index(',')):s.rindex(')')])


def main():
    C = call(os.path.join(WEB, 'data', 's11', 'cases', 'main.js')); chunks = {}; out = []; seen = set()
    for cid in sorted(C):
        c = C[cid]
        if c['k'] in seen or not c.get('t') or not c.get('ch'):
            continue
        ch = chunks.get(c['ch']) or chunks.setdefault(c['ch'], call(os.path.join(WEB, 'data', 's11', 'traj', c['ch'] + '.js')))
        ent = ch.get(c.get('tk') or cid) or {}; tr = ent.get('tr') or {}
        if not all(tr.get(a) and c['a'].get(a) for a in ARMS):
            continue
        q = c['a']['method_R13']
        if q[1] is None or q[1] < 10:   # showcase: only cases our method completed
            continue
        seen.add(c['k'])
        out.append({'id': cid, 'k': c['k'], 'u': c['u'], 'w': {k: c['w'][k] for k in ('b', 'r', 'o', 's')}, 'a': {a: c['a'][a] for a in ARMS}, 'tr': {a: tr[a] for a in ARMS}, 't0': {a: (ent.get('t0') or {}).get(a) for a in ARMS}})
    os.makedirs(os.path.join(WEB, 'data', 'v2'), exist_ok=True); p = os.path.join(WEB, 'data', 'v2', 'hero.js')
    open(p, 'w', encoding='utf-8').write('SL_V2_HERO(' + json.dumps({'rule': 'showcase: main set, per instruction kind, the smallest case id among the cases our method completed (score +1) with trajectories of all four public methods; not a representative sample', 'cases': out}, ensure_ascii=False, separators=(',', ':')) + ');\n')
    print(len(out), 'cases', [o['id'] for o in out], f'{os.path.getsize(p) / 1e3:.0f} KB')


if __name__ == '__main__':
    main()
