"""Printable 1:1 string maps for the bench layouts (reports/bench/bench-strings.json, written by the export step).
Each layout gets a front page (LED side, as in the app) and a back page (mirrored, for wiring behind the board).
Usage: python checks/string-maps.py   -> reports/bench/bench-string-maps.pdf (print at 100 % / actual size)"""
import json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import Polygon, Circle, Rectangle

here = os.path.dirname(os.path.abspath(__file__))
rep = os.path.join(here, '..', 'reports', 'bench')
D = json.load(open(os.path.join(rep, 'bench-strings.json'), encoding='utf-8'))
COL = ['#d62728', '#1f77b4', '#2ca02c', '#9467bd']        # string 1..4
NAMES = {'hex': 'BASELINE and A: hex grid (20 LEDs, 23.3 mm pitch)', 'B': 'VARIATION B: optimized (20 LEDs, 22 mm min pitch)'}
W, H = 210, 297                                           # A4 in mm; 1 data mm = 1 paper mm

def page(pdf, name, strings, back):
    fig = plt.figure(figsize=(W / 25.4, H / 25.4))
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(-W / 2, W / 2); ax.set_ylim(-170, H - 170); ax.set_aspect('equal'); ax.axis('off')
    m = -1 if back else 1
    P = lambda x, y: (m * x, y)
    ax.add_patch(Polygon([P(x, y) for x, y in D['outline']], closed=True, fill=False, lw=1.2, ec='k'))
    if len(D['zone']) > 2:
        ax.add_patch(Polygon([P(x, y) for x, y in D['zone']], closed=True, fc='#dddddd', ec='#888', hatch='///', lw=0.6))
        zx = [P(x, y)[0] for x, y in D['zone']]; zy = [y for x, y in D['zone']]
        ax.text(sum(zx) / len(zx), max(zy) - 5, 'camera keepout\n(no LEDs)', ha='center', va='top', fontsize=7, color='#555')
    cx, cy = P(D['cam']['x'], D['cam']['y']); ax.add_patch(Circle((cx, cy), D['cam']['holeR'], fill=False, ec='#555', lw=0.8)); ax.text(cx, cy, 'lens', ha='center', va='center', fontsize=6, color='#555')
    for h in D['holes']:
        hx, hy = P(h['x'], h['y']); ax.add_patch(Circle((hx, hy), 1.3, fc='w', ec='k', lw=0.6)); ax.add_patch(Circle((hx, hy), h.get('clear', 3.5), fill=False, ec='#999', ls=':', lw=0.6))
    for q, st in enumerate(strings):
        c = COL[q]
        for a, b in zip(st, st[1:]):
            (x1, y1), (x2, y2) = P(a['x'], a['y']), P(b['x'], b['y'])
            ax.plot([x1, x2], [y1, y2], color=c, lw=1.6, alpha=0.75, zorder=2)
            L = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
            ax.text((x1 + x2) / 2, (y1 + y2) / 2, f'{L:.0f}', fontsize=5.5, color=c, ha='center', va='center', zorder=4, bbox=dict(fc='w', ec='none', pad=0.3))
        for k, p in enumerate(st):
            x, y = P(p['x'], p['y'])
            ax.add_patch(Rectangle((x - 1.79, y - 1.485), 3.58, 2.97, fc=c, ec='k', lw=0.5, zorder=3))   # JB2835 body, to scale
            ax.text(x, y + 3.2, f'S{q + 1}.{k + 1}', fontsize=6.5, fontweight='bold', color=c, ha='center', va='bottom', zorder=4)
            if k == 0: ax.text(x, y - 3.2, 'start', fontsize=5, color=c, ha='center', va='top', zorder=4)
    side = 'BACK (mirrored, wiring side)' if back else 'FRONT (LED side, as in the app)'
    ax.text(-W / 2 + 12, H - 170 - 14, f'{NAMES[name]}\n{side}', fontsize=11, fontweight='bold', va='top')
    ax.text(-W / 2 + 12, H - 170 - 30, 'Print at 100 % / actual size: the bar below must measure 50 mm. Colour = string (5 LEDs in series);\n'
            'S2.3 = string 2, 3rd LED along the chain, starting at "start". Numbers on the lines = centre-to-centre distance (mm).\n'
            'LED bodies drawn to scale (3.58 × 2.97 mm). Ballpark guide: the exact coordinates are in the CSV.', fontsize=7, va='top')
    ax.plot([-W / 2 + 12, -W / 2 + 62], [-150, -150], 'k', lw=2); ax.text(-W / 2 + 37, -147, '50 mm', ha='center', fontsize=7)
    leg = '   '.join(f'S{q + 1}: ' + '-'.join(str(p['led']) for p in st) for q, st in enumerate(strings))
    ax.text(-W / 2 + 12, -160, 'Series order by CSV LED number:  ' + leg, fontsize=6.5)
    for q in range(len(strings)): ax.add_patch(Rectangle((W / 2 - 60 + q * 13, -153), 4, 4, fc=COL[q], ec='k', lw=0.4)); ax.text(W / 2 - 54 + q * 13, -151, f'S{q + 1}', fontsize=6.5, va='center')
    pdf.savefig(fig); fig.savefig(os.path.join(rep, f'bench-strings-{name}-{"back" if back else "front"}.png'), dpi=110); plt.close(fig)

with PdfPages(os.path.join(rep, 'bench-string-maps.pdf')) as pdf:
    for name in ['hex', 'B']:
        for back in (False, True):
            page(pdf, name, D['layouts'][name], back)
print('written reports/bench/bench-string-maps.pdf')
