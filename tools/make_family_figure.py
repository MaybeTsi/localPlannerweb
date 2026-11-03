#!/usr/bin/env python3
"""S4 scenario families F1-F6, one released case per family.

Each panel draws the first S4 development case of the family from
B codex/kappa-facts-20261028:research/scenario_library/library_index.json
(development answers are public): free rectangles, boxes, numbered candidate
openings, start pose, and the target structure from `answers` (orange).
F5 also marks B's `fake_structures` (non-traversable gap between boxes).

Writes scenario_families_F1-F6.{png,pdf,svg} into the web directory.
Usage: python3 tools/make_family_figure.py [--b-ref origin/codex/kappa-facts-20261028]
"""
import argparse, json, logging, math, os, subprocess
import matplotlib
matplotlib.use('Agg')
logging.getLogger('matplotlib').setLevel(logging.ERROR)
import matplotlib.pyplot as plt
import matplotlib.transforms as T
from matplotlib.patches import Rectangle, FancyArrowPatch

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
LIB = 'research/scenario_library/library_index.json'

# palette "Signal" (web page tokens)
INK, MUTED, UNK, FREE, WALL = '#17181C', '#6B6B6B', '#EDEDEA', '#FFFFFF', '#17181C'
ORANGE, BLUE, BOX, FAKE = '#FF4F00', '#0090FF', '#8A8D93', '#E0245E'
plt.rcParams.update({'font.family': 'sans-serif', 'font.sans-serif': ['DejaVu Sans'], 'font.size': 7,
                     'pdf.fonttype': 42, 'svg.fonttype': 'none'})

TITLES = {
    'F1': ('F1  hall on one side', 'open hall opposite the doors'),
    'F2': ('F2  90° corner / T junction', 'doors near the junction'),
    'F3': ('F3  box narrows the window', 'box beside the target door'),
    'F4': ('F4  box hides the opening', 'box occludes a door until close'),
    'F5': ('F5  boxes form a false opening', 'gap between boxes is not passable'),
    'F6': ('F6  direction instruction + box', 'no reference structure'),
}
EN_TEXT = {'01': lambda u: f"go {u['distance_m']} m, turn {u['direction']}",
           '02': lambda u: f"first passable opening, {u['direction']}",
           '15': lambda u: None}


def utter(r):
    f = EN_TEXT.get(r['kind'])
    s = f(r['public_utterance']) if f else None
    if s is None:  # kind 15: "向左前方行驶 8 米"
        t = r['instruction_text']
        s = f"drive ahead-{'left' if '左' in t else 'right'} {''.join(ch for ch in t if ch.isdigit() or ch == '.')} m"
    return f'“{s}”'


def panel(ax, r):
    m, ans = r['map'], r['answers']
    t = 0.09
    for x0, y0, x1, y1 in m['free_rectangles']:
        ax.add_patch(Rectangle((x0 - t, y0 - t), x1 - x0 + 2 * t, y1 - y0 + 2 * t, color=WALL, lw=0, zorder=1))
    for x0, y0, x1, y1 in m['free_rectangles']:
        ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, color=FREE, lw=0, zorder=2))
    for x0, y0, x1, y1 in r.get('obstacles') or []:
        ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, color=BOX, lw=0, zorder=4))
    tgt = ans['target']
    for c in r['candidates']:
        (cx, cy), (tx, ty), (ix, iy), h = c['center'], c['tangent'], c['inward'], c['width_m'] / 2
        is_t = tgt.get('target_id') == c['id']
        passable = (ans.get('opening_passability') or {}).get(c['id'], True)
        col = ORANGE if is_t else (BLUE if passable else MUTED)
        ax.plot([cx - tx * h, cx + tx * h], [cy - ty * h, cy + ty * h], color=col, lw=2.2 if is_t else 1.1,
                ls='-' if is_t else (0, (3, 2)), zorder=5, solid_capstyle='butt')
        ax.text(cx - ix * 0.45, cy - iy * 0.45, c['id'], ha='center', va='center', fontsize=5.8, color=col, zorder=7)
        if is_t:
            d = min(c.get('depth_m') or 1.2, 1.6)
            xs = [cx - tx * h, cx + tx * h, cx - tx * h + ix * d, cx + tx * h + ix * d]
            ys = [cy - ty * h, cy + ty * h, cy - ty * h + iy * d, cy + ty * h + iy * d]
            ax.add_patch(Rectangle((min(xs) - .15, min(ys) - .15), max(xs) - min(xs) + .3, max(ys) - min(ys) + .3,
                                   fill=False, ec=ORANGE, lw=1.1, zorder=6))
    for fs in ans.get('fake_structures') or []:
        fx, fy = fs['center']
        ax.plot([fx - fs['gap_width_m'] / 2, fx + fs['gap_width_m'] / 2], [fy, fy], color=FAKE, lw=1.4, ls=(0, (2, 1.5)), zorder=6)
        ax.annotate('false gap', (fx, fy), xytext=(fx - 2.2, fy + math.copysign(1.4, -fy or 1)), fontsize=5.6, color=FAKE, ha='center', va='center', zorder=7,
                    arrowprops=dict(arrowstyle='-', color=FAKE, lw=0.6))
    sx, sy, syaw = r['start']
    if tgt.get('kind') == 'direction':
        a = syaw + tgt['relative_angle_rad']
        ex, ey = sx + tgt['distance_m'] * math.cos(a), sy + tgt['distance_m'] * math.sin(a)
        ax.add_patch(FancyArrowPatch((sx, sy), (ex, ey), arrowstyle='-|>', mutation_scale=8, color=ORANGE, lw=1.3, ls=(0, (4, 2)), zorder=6))
        ax.text(ex + 0.3, ey, f"{round(math.degrees(tgt['relative_angle_rad']))}°, {tgt['distance_m']:g} m", fontsize=5.8, color=ORANGE, va='center', zorder=7)
    car = Rectangle((-0.1455, -0.30375), 0.78, 0.6075, color=INK, zorder=8)
    car.set_transform(T.Affine2D().rotate(syaw).translate(sx, sy) + ax.transData)
    ax.add_patch(car)
    x0, y0, x1, y1 = m['bounds']
    ax.set_xlim(x0, x1); ax.set_ylim(y0, y1)
    ax.set_aspect('equal'); ax.set_facecolor(UNK)
    ax.set_xticks([]); ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--b-ref', default='origin/codex/kappa-facts-20261028')
    args = ap.parse_args()
    repo = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=HERE, text=True).strip()
    raw = subprocess.check_output(['git', 'show', f'{args.b_ref}:{LIB}'], cwd=repo)
    commit = subprocess.check_output(['git', 'rev-parse', '--short=9', args.b_ref], cwd=repo, text=True).strip()
    rs = [json.loads(l) for l in raw.decode().splitlines() if l.strip()]
    fig, axs = plt.subplots(2, 3, figsize=(7.2, 4.6))
    for ax, fam in zip(axs.flat, ['F1', 'F2', 'F3', 'F4', 'F5', 'F6']):
        r = next(x for x in rs if x['dataset'] == f'S4_{fam}_development')
        panel(ax, r)
        title, sub = TITLES[fam]
        ax.set_title(title, loc='left', fontsize=8.2, fontweight='bold', color=INK, pad=3)
        ax.text(0, -0.03, f"{sub}\n{utter(r)} · {r['case_id']}", transform=ax.transAxes, fontsize=5.6, color=MUTED, va='top', linespacing=1.4)
    fig.text(0.01, 0.006, f'First S4 development case per family (B {commit}, {LIB}).\nOrange: target structure (public development answer); '
             'blue dashed: other candidates; grey dashed: not passable; grey: boxes; black: start pose.', fontsize=5.4, color=MUTED, linespacing=1.4)
    fig.tight_layout(rect=(0, 0.04, 1, 1), h_pad=2.6, w_pad=1.0)
    for ext in ('png', 'pdf', 'svg'):
        fig.savefig(os.path.join(WEB, f'scenario_families_F1-F6.{ext}'), dpi=300 if ext == 'png' else None, facecolor='white')
    # drop the XML/DOCTYPE preamble so the SVG can be inlined or used as <img> on file://
    svgp = os.path.join(WEB, 'scenario_families_F1-F6.svg')
    s = open(svgp).read()
    open(svgp, 'w').write(s[s.index('<svg'):])
    print('wrote', [f'scenario_families_F1-F6.{e}' for e in ('png', 'pdf', 'svg')])


if __name__ == '__main__':
    main()
