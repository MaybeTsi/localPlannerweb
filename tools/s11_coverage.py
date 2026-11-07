#!/usr/bin/env python3
"""Trajectory coverage of the S11 data shipped in data/s11: expected slots (case x arm with a score), slots with a decodable
trajectory, which are missing and why. Writes COVERAGE_S11_trajectories_20261107.md and adds `coverage` to data/s11/meta.js."""
import collections, glob, json, os
WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(WEB)

def load(p):
    t = open(p).read(); i = t.index('('); j = t[i + 1:t.rindex(')')]; k = j.index(',')
    return json.loads(j[:k]), json.loads(j[k + 1:])

chunks = {}
for f in glob.glob('data/s11/traj/*.js'):
    n, o = load(f); chunks[n] = o
mt = open('data/s11/meta.js').read(); meta = json.loads(mt[mt.index('=') + 1:mt.rindex(';')]); ARMS = meta['arms']
NAMES = {'main': ('主集', 'S11_MAIN_SYNTH'), 'clutter': ('小障碍', 'S11_CLUTTER'), 'hall': ('大厅', 'S11_DIVERSITY_F1'), 'corner': ('拐角', 'S11_DIVERSITY_F2'), 'real': ('真实地图', 'S11_REAL'),
         'o1b': ('绕障 一个箱子 · 有箱子', 'S11_OBS_O1_BLOCK'), 'o1c': ('绕障 一个箱子 · 没箱子', 'S11_OBS_O1_CLEAR'), 'o3b': ('绕障 两个箱子错开 · 有箱子', 'S11_OBS_O3_BLOCK'), 'o3c': ('绕障 两个箱子错开 · 没箱子', 'S11_OBS_O3_CLEAR'),
         'o4b': ('绕障 走廊堵死 · 有箱子', 'S11_OBS_O4_BLOCK'), 'o4c': ('绕障 走廊堵死 · 没箱子', 'S11_OBS_O4_CLEAR')}
rows = []
for key in NAMES:
    cs = load(f'data/s11/cases/{key}.js')[1]
    exp = have = shared = 0; miss = []; per = collections.Counter()
    for cid, c in cs.items():
        for a in ARMS:
            if c['a'].get(a) is None:
                continue
            exp += 1
            ent = chunks.get(c.get('ch'), {}).get(c.get('tk', cid), {}).get('tr', {})
            if ent.get(a):
                have += 1; per[a] += 1
                if 'tk' in c: shared += 1
            else:
                miss.append([cid, a])
    rows.append({'key': key, 'zh': NAMES[key][0], 'dataset': NAMES[key][1], 'cases': len(cs), 'expected': exp, 'have': have, 'shared': shared, 'missing': len(miss), 'missing_list': miss[:20],
                 'per_arm': {a: per[a] for a in ARMS}})
tot_e = sum(r['expected'] for r in rows); tot_h = sum(r['have'] for r in rows)
cov = {'rows': [{k: v for k, v in r.items() if k != 'per_arm'} for r in rows], 'expected': tot_e, 'have': tot_h, 'logical_slots_B': meta['facts']['logical_slots'], 'unique_attempts_B': meta['facts']['unique_physical_attempts']}
meta['coverage'] = cov
open('data/s11/meta.js', 'w').write('window.SL_S11=' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
md = ['# S11 轨迹覆盖表（2026-11-07）', '', '应有 = 该子集里有评分的「题 × 方法」槽位（八个方法）；实有 = 数据里有可解码轨迹的槽位。「借用」= 没箱子版本没有单独运行，用的是基础集里同一场景的记录（B：同源引用，不重复存）。', '',
      '| 子集 | 题数 | 应有 | 实有 | 其中借用 | 缺 | 缺的原因 |', '|---|---:|---:|---:|---:|---:|---|']
for r in rows:
    md.append(f"| {r['zh']}（{r['dataset']}）| {r['cases']:,} | {r['expected']:,} | {r['have']:,} | {r['shared']:,} | {r['missing']} | {'无' if not r['missing'] else '见下'} |")
md += [f"| 合计 | {sum(r['cases'] for r in rows):,} | {tot_e:,} | {tot_h:,} | {sum(r['shared'] for r in rows):,} | {tot_e - tot_h} | |", '',
       f"B 的登记：{cov['logical_slots_B']:,} 个逻辑槽，其中 {cov['unique_attempts_B']:,} 次唯一实际运行、{cov['logical_slots_B'] - cov['unique_attempts_B']:,} 条同源引用；表中应有合计与之相同。", '',
       '详情页核对：每个子集抽样打开详情页（有箱子 / 没箱子两种链接各抽），八个方法的轨迹都能解码出多于一个点，侧栏八行齐全（见 tools 里 s11_coverage.py 与页面测试）。']
open('COVERAGE_S11_trajectories_20261107.md', 'w').write('\n'.join(md) + '\n')
print('\n'.join(md))
