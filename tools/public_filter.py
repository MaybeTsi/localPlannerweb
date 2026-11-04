#!/usr/bin/env python3
"""Remove from the published web data what is not shown to outside readers (user decision 2026-11-04):

  - night replay rates (night_primary, night_D_exposed);
  - speaker-mismatch rates below the overall level (only mismatch/ALL is kept);
  - instruction kind ⑭ (correction) on the real floors: rate rows of S2 / S2′ / S2″ (and their building views) with
    category 14, and the real-floor ⑭ cases themselves (index entries, score shards, trajectory chunks).

Run after build_data.py / build_s5_s6.py. Idempotent. Only edits files under data/.
"""
import json
import os

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(WEB, 'data')
REAL = ('S2', 'S2′', 'S2″')
REAL_SETS = ('S2', 'S2P', 'S2PP')


def load(path, prefix, suffix=';'):
    s = open(path, encoding='utf-8').read().rstrip()
    assert s.startswith(prefix) and s.endswith(suffix), path
    return json.loads(s[len(prefix):-len(suffix)])


def save(path, prefix, obj, suffix=';'):
    open(path, 'w', encoding='utf-8').write(prefix + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + suffix + '\n')


def keep_rate(r):
    ds = r['dataset']
    if ds.startswith('night'):
        return False
    if ds == 'mismatch' and r['category'] != 'ALL':
        return False
    if ds.split(':')[0] in REAL and r['category'] == '14':
        return False
    return True


def main():
    meta = load(os.path.join(D, 'meta.js'), 'window.SL_META=')
    n0 = len(meta['rates'])
    meta['rates'] = [r for r in meta['rates'] if keep_rate(r)]
    index = load(os.path.join(D, 'index.js'), 'window.SL_INDEX=')
    drop = {e['id']: e for e in index if e['d'] in REAL_SETS and e['k'] == '14'}
    index = [e for e in index if e['id'] not in drop]
    meta['counts']['cases'] = len(index)
    by = {}
    for e in index:
        by[e['d']] = by.get(e['d'], 0) + 1
    meta['counts']['by_set'] = by
    save(os.path.join(D, 'meta.js'), 'window.SL_META=', meta)
    save(os.path.join(D, 'index.js'), 'window.SL_INDEX=', index)
    shards = {e['sh'] for e in drop.values()}
    chunks = {e['ch'] for e in drop.values() if e.get('ch')}
    for name in shards:
        p = os.path.join(D, 'cases', f'{name}.js')
        if os.path.exists(p):
            os.remove(p)       # real-floor ⑭ shards hold only ⑭ cases
    for name in chunks:
        p = os.path.join(D, 'traj', f'{name}.js')
        if os.path.exists(p):
            os.remove(p)
    print(f'rates {n0} -> {len(meta["rates"])}; removed {len(drop)} real-floor ⑭ cases, {len(shards)} score shards, {len(chunks)} trajectory chunks')


if __name__ == '__main__':
    main()
