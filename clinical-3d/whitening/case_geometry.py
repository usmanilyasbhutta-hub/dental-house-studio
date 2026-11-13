# Shared case geometry and instrument poses (v9). Pure Python, no imports from
# Blender or Pillow: the Blender build scripts and render.py both read this.
# Coordinates are in the 960-px-wide space of the supplied initial photograph.
import math

# Gingival margin traced on a 19x enlargement of the initial photograph, left to
# right, zenith and papilla of each of the six illustrated upper anterior crowns.
MARGIN = [(372.5, 226), (373.5, 216), (375, 207), (378, 203), (382, 201), (389, 203), (395, 207), (400, 212), (405, 218),
          (410, 220), (413, 212), (418, 206), (424, 203.5), (431, 204), (437, 208), (442, 213), (446, 219),
          (452, 223), (456, 217), (460, 211), (466, 205), (472, 201.5), (480, 200.5), (488, 201), (495, 203.5), (501, 208),
          (506, 213), (510, 218), (514, 223),
          (519, 225.5), (522, 219), (526, 213), (531, 207), (538, 202.5), (546, 200), (555, 200), (562, 201.5), (568, 206),
          (573, 212), (577, 218),
          (580, 223), (583, 217), (586, 211), (590, 203), (594, 195), (599, 190.5), (604, 191), (608, 196), (610, 202),
          (611.5, 208),
          (613, 213.7), (616, 208), (620, 202), (625, 197), (630, 195), (634, 196), (636, 202), (637, 210)]
# Index range of the margin belonging to each crown, then the proximal and incisal
# outline continuing clockwise (distal/mesial side, incisal edge, other side).
_CROWN_PARTS = [
    (1, 9, [(409, 235), (408, 250), (403, 256), (396, 260), (389, 261.5), (382, 258), (377, 252), (374, 240), (374, 225)]),
    (9, 17, [(452.5, 240), (452, 252), (449, 257), (440, 261), (428, 261.5), (417, 258), (411, 252), (410, 236)]),
    (17, 29, [(519.5, 245), (520, 260), (510, 262), (480, 262), (462, 261), (455, 258), (453, 250), (452.5, 236)]),
    (29, 40, [(580.5, 240), (580, 252), (577, 258), (570, 261.5), (550, 262), (530, 262), (521, 261), (520, 245)]),
    (40, 50, [(613, 230), (612.5, 249), (606, 254.5), (596, 257), (586, 256.5), (581, 252), (580.5, 238)]),
    (50, 57, [(637, 230), (636, 246), (633, 251), (629, 254.5), (622, 255), (615, 251), (613.5, 235)])]
CROWNS = [MARGIN[a:b + 1] + rest for a, b, rest in _CROWN_PARTS]


def margin_y(x):
    """Margin height at source x (the traced margin is single-valued in x)."""
    if x <= MARGIN[0][0]: return MARGIN[0][1]
    for (x0, y0), (x1, y1) in zip(MARGIN, MARGIN[1:]):
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return MARGIN[-1][1]


def barrier_edges(x):
    """Coronal and apical edge of the gingival barrier at source x.

    Coronal edge seals about 0.2 mm onto enamel. The apical edge is a low-pass
    of the margin, so papillae are filled and the band is about 2-6 mm tall,
    as in the inspected clinical photograph, rather than a constant-width
    ribbon that mirrors every scallop."""
    m = margin_y(x)
    avg = sum(margin_y(x + d) for d in range(-22, 23, 2)) / 23
    lump = 1.6 * math.sin(x * .21) + 1.1 * math.sin(x * .087 + 1.3) + .7 * math.sin(x * .53 + .4)
    top = min(avg - 20 + lump, m - 13 + .5 * lump)
    return m + 1.3, top


# Instrument working poses. Euler XYZ in degrees, as Blender applies them:
# (tilt about X, roll about Y, in-plane Z). Negative X tilt lifts the handle
# towards the camera/operator, never into the patient. Five depth views per
# instrument: index i = 0..4 across the arch.
POSES = {
    'barrier_syringe': lambda i: (-32, -14 + 7 * i, -30 + 15 * i),
    'syringe': lambda i: (-30, -12 + 6 * i, -30 + 15 * i),
    'polisher': lambda i: (-16, 52, -30 + 15 * i),
    'curing_light': lambda i: (22, -10 + 5 * i, -30 + 15 * i),
    'suction': lambda i: (-38, -12 + 6 * i, -30 + 15 * i),
}
SCALER_POSES = [(0, -10, 10), (0, 8, -12)]
# Model-space point (mm) that is pinned to the treatment path.
CONTACT = {
    'barrier_syringe': (0, 0, .15),   # cannula outlet
    'syringe': (0, 0, .15),           # delivery outlet
    'polisher': (2.0, 0, .2),         # flexed bristle edge on enamel
    'curing_light': (0, 0, 0),        # surface point under the lens centre
    'suction': (0, 0, .15),           # distal opening
}
PLUNGER_TRAVEL = {'barrier_syringe': 2.8, 'syringe': 4.0}
ASSET_SPAN_MM = 80


def rotate(v, angles):
    """Blender Euler XYZ rotation of a model-space vector."""
    ax, ay, az = [math.radians(a) for a in angles]
    x, y, z = v
    y, z = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
    x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
    x, y = x * math.cos(az) - y * math.sin(az), x * math.sin(az) + y * math.cos(az)
    return x, y, z
