#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARCHIVE of the first run (8 cakes x 200, 2026-01-01 .. 2026-01-31, reproduces cake1_plan_json.json). The current generator is cake_v1_optimization.py
CAKE1 - manufacturing plan of the "ecology supercakes", 2026-01-01 .. 2026-01-31  (documentation/CAKE1/INIT_STAGE.html)

What it does (one run, ~5-10 minutes):
  1. data      8 eco cakes (list of the shared chat), 5 kg size (x5 of the home cake), 200 cakes per cake, made in
               batches of 10 cakes; every cake has a routing of <= 10 WORKER operations + passive steps (bake, cool, chill).
  2. OR-Tools  CP-SAT model of the whole month at 5-minute resolution: finds the SMALLEST number of workers (and the split
               Early / Late shift) that makes all 1 600 cakes, with  - shift windows without the breaks (rest 15 min, lunch 30 min,
               rest 15 min every 4 h), - one day off per worker per week + the plant closed on Sunday and on 1 January,
               - capacity of mixers / kettles / benches / pack lines / ovens / cooling racks / chiller, - weekly due dates.
  3. workers   names the people (fake), gives every operation a worker and every machine step a machine unit.
  4. purchase  lots of ingredients with the cover days and the shelf life; ORDER = DELIVERY - 2 days (or more); goods receipt.
  5. WBS       cake1_plan_json.json = ready for  Project settings -> Import / Export -> Import  (format kit8.pm.project, version 1:
               tasks + dependencies + the project settings + the TASK LINES (Time and Material lines = what Post takes: hours x rate for
               every worker operation, quantity x price for every ingredient and packaging of a batch)).
  6. checks    an independent verification of every rule; the script stops with an error when one fails.

Install (global for the Mac, nothing is installed in this folder):   python3 -m pip install --upgrade ortools
Run:                                                                python3 cake_v1_optimization.py
Quick try (1 minute, may use more workers):                         python3 cake_v1_optimization.py --quick
Only the task lines of an existing file (no search, seconds):         python3 cake_v1_optimization.py --lines-only
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import math
import os
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from ortools.sat.python import cp_model
except ImportError:  # pragma: no cover
    sys.exit('OR-Tools is missing. Install it once for the whole Mac:  python3 -m pip install --upgrade ortools')

HERE = Path(__file__).resolve().parent
PROJECT_GUID = '8e3e5544-5d86-4831-b116-420e6f9bde87'      # the appPM80 project the file is made for
OWNER_PLACEHOLDER = '00000000-0000-4000-8000-000000000000'  # the import writes the real owner
OUT_JSON = HERE / 'cake1_plan_json.json'
NS = uuid.UUID('6f1e0c3a-5b7d-4c21-9a43-0d1c2b3a4e5f')    # namespace of the deterministic row ids (same name -> same GUID)

# =====================================================================================================================
# 1. CALENDAR AND TIME GRID
# =====================================================================================================================
DAY0 = dt.date(2026, 1, 1)
NDAYS = 31                      # 2026-01-01 .. 2026-01-31
SLOT = 5                        # minutes in one grid step
SPD = 24 * 60 // SLOT           # slots per day (288)
DT0 = dt.datetime(2026, 1, 1)
HOLIDAYS = {dt.date(2026, 1, 1)}  # plant closed (New Year); the buyer still sends the first orders online
FIRST_DELIVERY = dt.date(2026, 1, 3)   # orders of 1 Jan + 2 days; the plant has no stock before
LAST_PROD = dt.date(2026, 1, 30)       # 31 Jan = dispatch + reserve day (no new batches)
FIRST_DAY_RELEASE_MIN = 10 * 60        # on 3 Jan the first batch starts after the goods receipt (checked)
LEAD_DAYS = 2                          # purchase order delay (calendar days, order -> delivery)

BATCH_CAKES = 10                # cakes per batch (10 x 5 kg = 50 kg)
CAKES_PER_POSITION = 200
BATCHES_PER_POSITION = CAKES_PER_POSITION // BATCH_CAKES   # 20
CAKE_KG = 5.0
WASTE = 1.02                    # 2 % of spillage in the purchase quantities
MAX_WORKER_OPS = 10             # per cake (rule of the task)
MAX_WORKER_OP_MIN = 80

# shifts: windows of continuous work (minutes of the day). Between the windows: breaks (rest 15, lunch 30, rest 15).
SHIFTS = {
    'E': [(360, 480), (495, 600), (630, 720), (735, 840)],      # Early 06:00-14:00, breaks 08:00 10:00 12:00
    'L': [(840, 960), (975, 1080), (1110, 1200), (1215, 1320)],  # Late  14:00-22:00, breaks 16:00 18:00 20:00
}
SHIFT_NAME = {'E': 'Early 06:00-14:00', 'L': 'Late 14:00-22:00'}
SHIFT_BREAKS = {
    'E': ['08:00-08:15 rest', '10:00-10:30 lunch', '12:00-12:15 rest'],
    'L': ['16:00-16:15 rest', '18:00-18:30 lunch', '20:00-20:15 rest'],
}
SHIFT_NET_MIN = 435             # 8 h - 45 min of breaks
BUYER_DAYS = lambda d: d.weekday() < 5                   # Mon-Fri (+ 1 Jan on duty)
PLANT_DAY = lambda d: d.weekday() != 6 and d not in HOLIDAYS   # Mon-Sat except holidays

WEEKS_BATCHES = [6, 5, 5, 4]    # batches of every cake per production week (7 + 6 + 6 + 5 plant days)


def day_idx(d: dt.date) -> int:
    return (d - DAY0).days


def date_of(idx: int) -> dt.date:
    return DAY0 + dt.timedelta(days=idx)


def weekday(idx: int) -> int:
    return date_of(idx).weekday()   # Mon = 0 .. Sun = 6


def slot_of(idx: int, minute: int) -> int:
    return idx * SPD + minute // SLOT


def dt_of(slot: int) -> dt.datetime:
    return DT0 + dt.timedelta(minutes=slot * SLOT)


def hhmm(t: dt.datetime) -> str:
    return t.strftime('%H:%M')


def production_weeks() -> List[List[int]]:
    """Plant days of the four production weeks (day indexes): 3 Jan + 5-10 Jan | 12-17 | 19-24 | 26-30."""
    spans = [(dt.date(2026, 1, 3), dt.date(2026, 1, 10)), (dt.date(2026, 1, 12), dt.date(2026, 1, 17)),
             (dt.date(2026, 1, 19), dt.date(2026, 1, 24)), (dt.date(2026, 1, 26), LAST_PROD)]
    weeks = []
    for a, b in spans:
        days = [day_idx(a + dt.timedelta(days=i)) for i in range((b - a).days + 1) if PLANT_DAY(a + dt.timedelta(days=i))]
        weeks.append(days)
    return weeks


# =====================================================================================================================
# 2. ECO INGREDIENTS, SUPPLIERS (fictional), RECIPES (kg / l per ONE 5 kg cake) AND ROUTINGS
# =====================================================================================================================
SUPPLIERS = {
    'GM': 'GreenMill Organic Mills',
    'SE': 'Sweet Earth Fairtrade Trading',
    'VO': 'Valley Orchard Growers Co-op',
    'NW': 'Nutwood Organic Nuts & Fruit',
    'OL': 'OatLand Plant Drinks',
    'PP': 'Pressed & Pure Oils',
    'PM': 'Pantry Minerals & Baking Aids',
    'EP': 'EcoPack Compostables',
}
# code: (name, unit, EUR per unit, supplier, pack (order step), shelf life days, cover days (one delivery covers this many days), origin / certificate)
ING = {
    'spelt':     ('Organic wholegrain spelt flour', 'kg', 1.80, 'GM', 25, 180, 14, 'EU organic, regional mill'),
    'oats':      ('Organic rolled oats', 'kg', 1.60, 'GM', 25, 270, 14, 'EU organic, regional'),
    'sugar':     ('Organic Fairtrade cane sugar', 'kg', 2.30, 'SE', 25, 365, 14, 'EU organic + Fairtrade'),
    'cocoa':     ('Organic Fairtrade cocoa powder', 'kg', 11.50, 'SE', 5, 365, 14, 'EU organic + Fairtrade'),
    'darkchoc':  ('Organic Fairtrade dark chocolate 70 %', 'kg', 14.50, 'SE', 5, 270, 14, 'EU organic + Fairtrade, palm-oil free'),
    'vanilla':   ('Organic Fairtrade vanilla powder', 'kg', 420.00, 'SE', 0.1, 730, 31, 'EU organic + Fairtrade'),
    'dates':     ('Organic Fairtrade dates, pitted', 'kg', 6.80, 'SE', 5, 270, 14, 'EU organic + Fairtrade'),
    'coconutcr': ('Organic Fairtrade coconut cream', 'kg', 6.20, 'SE', 5, 540, 14, 'EU organic + Fairtrade'),
    'coconutoil': ('Organic Fairtrade virgin coconut oil', 'kg', 9.20, 'SE', 5, 540, 14, 'EU organic + Fairtrade'),
    'coffee':    ('Organic Fairtrade espresso coffee, ground', 'kg', 19.00, 'SE', 1, 180, 14, 'EU organic + Fairtrade'),
    'cinnamon':  ('Organic Fairtrade Ceylon cinnamon, ground', 'kg', 19.00, 'SE', 1, 540, 31, 'EU organic + Fairtrade'),
    'bananas':   ('Organic Fairtrade bananas', 'kg', 2.20, 'NW', 18, 6, 3, 'EU organic + Fairtrade, sea freight'),
    'lemons':    ('Organic lemons (Naturland, Spain / Italy)', 'kg', 3.20, 'NW', 10, 21, 7, 'EU organic, Mediterranean'),
    'cashews':   ('Organic Fairtrade cashew nuts', 'kg', 16.50, 'NW', 10, 270, 14, 'EU organic + Fairtrade'),
    'walnuts':   ('Organic walnuts, shelled', 'kg', 13.50, 'NW', 5, 180, 14, 'EU organic, regional'),
    'almonds':   ('Organic ground almonds', 'kg', 13.00, 'NW', 5, 180, 14, 'EU organic'),
    'carrots':   ('Organic carrots', 'kg', 1.45, 'VO', 10, 21, 7, 'EU organic, regional'),
    'apples':    ('Organic apples (stored)', 'kg', 2.30, 'VO', 12, 30, 7, 'EU organic, regional'),
    'beetroot':  ('Organic cooked beetroot, vacuum-packed', 'kg', 2.40, 'VO', 5, 21, 7, 'EU organic, regional'),
    'applepur':  ('Organic apple purée, unsweetened', 'kg', 2.10, 'VO', 10, 365, 14, 'EU organic, regional'),
    'oatdrink':  ('Organic oat drink (barista)', 'l', 1.65, 'OL', 12, 270, 7, 'EU organic, regional'),
    'sunoil':    ('Organic cold-pressed sunflower oil', 'l', 4.40, 'PP', 10, 270, 14, 'EU organic, regional'),
    'oliveoil':  ('Organic extra-virgin olive oil', 'l', 11.50, 'PP', 5, 365, 14, 'EU organic'),
    'acv':       ('Organic apple cider vinegar', 'l', 3.60, 'PP', 5, 365, 31, 'EU organic'),
    'baking':    ('Organic baking powder (tartrate, phosphate-free)', 'kg', 8.50, 'PM', 1, 365, 31, 'EU organic'),
    'salt':      ('Unrefined sea salt (solar evaporated)', 'kg', 1.20, 'PM', 5, 730, 31, 'natural'),
    'agar':      ('Organic agar-agar powder', 'kg', 95.00, 'PM', 0.5, 730, 31, 'EU organic'),
    # packaging (per cake): compostable, FSC
    'box':       ('Compostable cake box 5 kg (FSC kraft, EN 13432)', 'pcs', 1.40, 'EP', 50, 1000, 14, 'compostable EN 13432, FSC'),
    'board':     ('Compostable cake board (bagasse)', 'pcs', 0.55, 'EP', 100, 1000, 14, 'compostable EN 13432'),
    'label':     ('FSC recycled-paper label, plant-based ink', 'pcs', 0.04, 'EP', 500, 1000, 14, 'FSC recycled'),
}
PACKAGING = ['box', 'board', 'label']

# recipes: kg (l) per ONE 5 kg cake  -> the number of food components equals the table of the shared chat
RECIPES = {
    'choc': dict(title='Vegan chocolate cake', color='#7c3f1d', comps=9, price='6-8', ing={'spelt': 1.0, 'sugar': 0.9, 'cocoa': 0.35, 'sunoil': 0.5, 'oatdrink': 1.3, 'acv': 0.1, 'baking': 0.05, 'salt': 0.01, 'darkchoc': 0.8}),
    'carrot': dict(title='Carrot cake (whole-grain, local carrots)', color='#ea580c', comps=11, price='6-9', ing={'spelt': 0.8, 'carrots': 1.2, 'walnuts': 0.4, 'sugar': 0.7, 'sunoil': 0.45, 'oatdrink': 0.5, 'applepur': 0.3, 'cinnamon': 0.02, 'baking': 0.04, 'salt': 0.01, 'cashews': 0.6}),
    'lemon': dict(title='Lemon-olive oil cake', color='#ca8a04', comps=8, price='7-10', ing={'spelt': 1.2, 'sugar': 1.0, 'oliveoil': 0.6, 'lemons': 0.8, 'oatdrink': 1.0, 'almonds': 0.3, 'baking': 0.05, 'salt': 0.01}),
    'banana': dict(title='Banana-oat cake', color='#a16207', comps=7, price='4-6', ing={'oats': 1.2, 'bananas': 2.0, 'sugar': 0.5, 'sunoil': 0.4, 'oatdrink': 0.8, 'baking': 0.05, 'cinnamon': 0.02}),
    'cheese': dict(title='Plant-based cheesecake (cashew, no-bake)', color='#0d9488', comps=8, price='10-14', ing={'cashews': 1.7, 'coconutcr': 0.8, 'lemons': 0.6, 'sugar': 0.5, 'dates': 0.6, 'oats': 0.5, 'coconutoil': 0.3, 'agar': 0.03}),
    'beet': dict(title='Beetroot "red velvet" cake', color='#be123c', comps=12, price='7-10', ing={'spelt': 0.9, 'beetroot': 1.2, 'sugar': 0.8, 'cocoa': 0.12, 'sunoil': 0.4, 'oatdrink': 0.5, 'acv': 0.08, 'baking': 0.04, 'salt': 0.01, 'vanilla': 0.01, 'cashews': 0.8, 'coconutoil': 0.2}),
    'tira': dict(title='Vegan tiramisu', color='#6d28d9', comps=9, price='9-12', ing={'spelt': 0.7, 'sugar': 0.6, 'sunoil': 0.2, 'oatdrink': 0.7, 'coffee': 0.1, 'cashews': 1.1, 'coconutcr': 1.5, 'cocoa': 0.1, 'baking': 0.03}),
    'apple': dict(title='Apple-cinnamon cake (local apples)', color='#15803d', comps=8, price='5-7', ing={'spelt': 1.0, 'apples': 2.1, 'sugar': 0.7, 'sunoil': 0.4, 'oatdrink': 0.7, 'cinnamon': 0.03, 'baking': 0.05, 'salt': 0.01}),
}
CAKE_ORDER = ['choc', 'carrot', 'lemon', 'banana', 'cheese', 'beet', 'tira', 'apple']


@dataclass
class Op:
    id: str
    name: str
    kind: str                   # 'W' = a worker does it (time of the worker) | 'P' = passive (machine only)
    dmin: int                   # minutes (W: the duration; P: the minimum)
    dmax: int = 0               # P only: the longest the batch may wait
    res: Optional[str] = None   # Mixer | Kettle | Bench | PackLine (W)   Oven | Rack | Chiller (P)
    after: Tuple[str, ...] = ()
    note: str = ''


def W(i, name, m, res=None, after=(), note=''):
    return Op(i, name, 'W', m, 0, res, tuple(after), note)


def P(i, name, mn, mx, res, after, note=''):
    return Op(i, name, 'P', mn, mx, res, tuple(after), note)


H = 60
ROUTING: Dict[str, List[Op]] = {
    'choc': [
        W('w1', 'Weigh & stage ingredients', 45, None, [], 'Weigh the 9 organic components of the batch, check the lot numbers.'),
        W('w2', 'Mix batter', 30, 'Mixer', ['w1'], 'Dry mix, then oil + oat drink + vinegar; 6 min on speed 1, 3 min on speed 2.'),
        W('w3', 'Fill pans & load oven', 40, None, ['w2'], '10 pans of 5 kg; oven 170 C, steam 10 s.'),
        P('p1', 'Bake', 85, 130, 'Oven', ['w3'], 'Core 96 C; the batch may wait max 45 min in the closed oven.'),
        W('w4', 'Unload, demould & rack', 30, None, ['p1'], 'Hot cakes on racks, mould washed.'),
        P('p2', 'Cool on racks', 75, 360, 'Rack', ['w4'], 'Core below 25 C before the cream.'),
        W('w5', 'Prepare ganache (dark chocolate + oat drink)', 45, 'Kettle', ['w1'], 'Ganache at 38 C, 40 kg.'),
        W('w6', 'Assemble: level, fill, coat', 75, 'Bench', ['p2', 'w5'], 'Level, two layers, coat with ganache.'),
        W('w7', 'Decorate with eco toppings', 60, 'Bench', ['w6'], 'Cocoa nibs, dried berries; no plastic decoration.'),
        P('p3', 'Chill & set', 90, 2160, 'Chiller', ['w7'], 'Core 4 C.'),
        W('w8', 'QC, pack in compostable box, label', 60, 'PackLine', ['p3'], 'Weight 5.0 kg +/- 2 %, visual check, FSC label.'),
    ],
    'carrot': [
        W('w1', 'Weigh & stage ingredients', 50, None, [], 'Weigh the 11 organic components.'),
        W('w2', 'Grate carrots, chop walnuts', 45, None, ['w1'], 'Grater 3 mm; walnut pieces 5 mm.'),
        W('w3', 'Mix batter', 35, 'Mixer', ['w2'], 'Fold carrots and walnuts at the end.'),
        W('w4', 'Fill pans & load oven', 40, None, ['w3'], '10 pans of 5 kg; oven 165 C.'),
        P('p1', 'Bake', 95, 140, 'Oven', ['w4'], 'Core 96 C.'),
        W('w5', 'Unload, demould & rack', 30, None, ['p1'], ''),
        P('p2', 'Cool on racks', 75, 360, 'Rack', ['w5'], ''),
        W('w6', 'Prepare cashew-coconut frosting', 50, 'Kettle', ['w1'], 'Soaked cashews, blended smooth.'),
        W('w7', 'Assemble: layer & frost', 75, 'Bench', ['p2', 'w6'], ''),
        W('w8', 'Decorate (walnut halves, carrot curls)', 60, 'Bench', ['w7'], ''),
        P('p3', 'Chill & set', 120, 2160, 'Chiller', ['w8'], ''),
        W('w9', 'QC, pack in compostable box, label', 60, 'PackLine', ['p3'], ''),
    ],
    'lemon': [
        W('w1', 'Weigh & stage ingredients', 40, None, [], 'Weigh the 8 organic components.'),
        W('w2', 'Mix batter (zest and juice of lemons)', 30, 'Mixer', ['w1'], ''),
        W('w3', 'Fill pans & load oven', 40, None, ['w2'], '10 pans of 5 kg; oven 170 C.'),
        P('p1', 'Bake', 75, 120, 'Oven', ['w3'], 'Core 96 C.'),
        W('w4', 'Unload, demould & rack', 30, None, ['p1'], ''),
        P('p2', 'Cool on racks', 60, 360, 'Rack', ['w4'], ''),
        W('w5', 'Prepare lemon glaze', 35, 'Kettle', ['w1'], 'Cane sugar, lemon juice, no artificial colour.'),
        W('w6', 'Glaze the cakes', 50, 'Bench', ['p2', 'w5'], ''),
        W('w7', 'Decorate (zest, almond flakes)', 45, 'Bench', ['w6'], ''),
        P('p3', 'Set the glaze', 60, 2160, 'Chiller', ['w7'], ''),
        W('w8', 'QC, pack in compostable box, label', 60, 'PackLine', ['p3'], ''),
    ],
    'banana': [
        W('w1', 'Weigh & stage ingredients', 35, None, [], 'Weigh the 7 organic components.'),
        W('w2', 'Mash bananas & mix batter', 35, 'Mixer', ['w1'], 'Ripe Fairtrade bananas, no added sugar syrup.'),
        W('w3', 'Fill pans & load oven', 40, None, ['w2'], '10 pans of 5 kg; oven 170 C.'),
        P('p1', 'Bake', 80, 125, 'Oven', ['w3'], 'Core 96 C.'),
        W('w4', 'Unload, demould & rack', 30, None, ['p1'], ''),
        P('p2', 'Cool on racks', 75, 360, 'Rack', ['w4'], ''),
        W('w5', 'Decorate (oat crumble, banana chips)', 45, 'Bench', ['p2'], ''),
        W('w6', 'QC, pack in compostable box, label', 60, 'PackLine', ['w5'], ''),
    ],
    'cheese': [
        W('w1', 'Weigh & stage ingredients', 40, None, [], 'Weigh the 8 organic components; cashews soaked the day before in the warehouse.'),
        W('w2', 'Prepare crust (dates, oats, coconut oil) & press', 55, 'Mixer', ['w1'], ''),
        W('w3', 'Blend cashew-coconut filling', 50, 'Kettle', ['w1'], 'High-shear blender, 50 kg.'),
        W('w4', 'Fill moulds & level', 60, 'Bench', ['w2', 'w3'], ''),
        P('p1', 'Chill & set (agar)', 360, 2400, 'Chiller', ['w4'], 'Core 4 C, at least 6 h.'),
        W('w5', 'Unmould & glaze (agar-lemon)', 55, 'Bench', ['p1'], ''),
        P('p2', 'Set the glaze', 45, 2160, 'Chiller', ['w5'], ''),
        W('w6', 'Decorate (fruit, seeds)', 45, 'Bench', ['p2'], ''),
        W('w7', 'QC, pack in compostable box, label', 60, 'PackLine', ['w6'], ''),
    ],
    'beet': [
        W('w1', 'Weigh & stage ingredients', 55, None, [], 'Weigh the 12 organic components.'),
        W('w2', 'Purée the cooked beetroot', 30, 'Kettle', ['w1'], 'No artificial colour: the beetroot gives the red.'),
        W('w3', 'Mix batter', 35, 'Mixer', ['w2'], ''),
        W('w4', 'Fill pans & load oven', 40, None, ['w3'], '10 pans of 5 kg; oven 170 C.'),
        P('p1', 'Bake', 90, 135, 'Oven', ['w4'], 'Core 96 C.'),
        W('w5', 'Unload, demould & rack', 30, None, ['p1'], ''),
        P('p2', 'Cool on racks', 75, 360, 'Rack', ['w5'], ''),
        W('w6', 'Prepare cashew frosting (vanilla)', 50, 'Kettle', ['w1'], ''),
        W('w7', 'Assemble: layer & frost', 75, 'Bench', ['p2', 'w6'], ''),
        W('w8', 'Decorate (crumb, edible flowers)', 60, 'Bench', ['w7'], ''),
        P('p3', 'Chill & set', 120, 2160, 'Chiller', ['w8'], ''),
        W('w9', 'QC, pack in compostable box, label', 60, 'PackLine', ['p3'], ''),
    ],
    'tira': [
        W('w1', 'Weigh & stage ingredients', 45, None, [], 'Weigh the 9 organic components.'),
        W('w2', 'Mix sponge batter', 25, 'Mixer', ['w1'], ''),
        W('w3', 'Fill sheet pans & load oven', 30, None, ['w2'], 'Thin sponge sheets; oven 180 C.'),
        P('p1', 'Bake', 40, 85, 'Oven', ['w3'], ''),
        W('w4', 'Unload & rack the sponge', 20, None, ['p1'], ''),
        P('p2', 'Cool on racks', 45, 360, 'Rack', ['w4'], ''),
        W('w5', 'Brew coffee & make cashew-coconut cream', 60, 'Kettle', ['w1'], ''),
        W('w6', 'Assemble: dip sponge, two layers of cream', 80, 'Bench', ['p2', 'w5'], ''),
        P('p3', 'Chill & set', 240, 2160, 'Chiller', ['w6'], 'Core 4 C, at least 4 h.'),
        W('w7', 'Dust with cocoa & decorate', 40, 'Bench', ['p3'], ''),
        W('w8', 'QC, pack in compostable box, label', 60, 'PackLine', ['w7'], ''),
    ],
    'apple': [
        W('w1', 'Weigh & stage ingredients', 40, None, [], 'Weigh the 8 organic components.'),
        W('w2', 'Core & slice the apples', 45, None, ['w1'], 'Apples with the peel (organic).'),
        W('w3', 'Mix batter', 30, 'Mixer', ['w2'], ''),
        W('w4', 'Fill pans & load oven', 40, None, ['w3'], '10 pans of 5 kg; oven 170 C.'),
        P('p1', 'Bake', 85, 130, 'Oven', ['w4'], 'Core 96 C.'),
        W('w5', 'Unload, demould & rack', 30, None, ['p1'], ''),
        P('p2', 'Cool on racks', 75, 360, 'Rack', ['w5'], ''),
        W('w6', 'Decorate (cinnamon crumble, apple slices)', 50, 'Bench', ['p2'], ''),
        W('w7', 'QC, pack in compostable box, label', 60, 'PackLine', ['w6'], ''),
    ],
}
CAPACITY = {'Mixer': 2, 'Kettle': 2, 'Bench': 3, 'PackLine': 2, 'Oven': 2, 'Rack': 6, 'Chiller': 4}
RES_UNIT = {'Mixer': 'Mixer', 'Kettle': 'Kettle', 'Bench': 'Bench', 'PackLine': 'Pack line', 'Oven': 'Oven', 'Rack': 'Rack', 'Chiller': 'Chiller'}

FIRST = ['Lena', 'Tomas', 'Ingrid', 'Marco', 'Aiko', 'Priya', 'Jonas', 'Elif', 'Mateo', 'Sofia', 'Nikolai', 'Amara', 'Leon', 'Chiara',
         'Hana', 'Viktor', 'Noor', 'Pablo', 'Greta', 'Yuki', 'Anselm', 'Beatriz', 'Dario', 'Freya', 'Goran', 'Ines']
LAST = ['Marchetti', 'Brandt', 'Okafor', 'Tanaka', 'Novak', 'Haddad', 'Vermeer', 'Castillo', 'Ivanova', 'Kowalski', 'Dubois', 'Larsen',
        'Moreau', 'Petrov', 'Santos', 'Weber', 'Yilmaz', 'Ziegler', 'Aalto', 'Bergstrom', 'Costa', 'Demir', 'Eriksen', 'Fontaine']
BUYER = 'Oskar Veldt'
KEEPERS = ['Marta Lindqvist', 'Ravi Anand']
KEEPER_OFF = {'Marta Lindqvist': 0, 'Ravi Anand': 3}   # weekday of the day off (Mon = 0)


def make_names(n: int) -> List[str]:
    names, i = [], 0
    reserved = {BUYER, *KEEPERS}
    while len(names) < n:
        nm = f'{FIRST[i % len(FIRST)]} {LAST[(i * 7 + 3) % len(LAST)]}'
        if nm not in names and nm not in reserved:
            names.append(nm)
        i += 1
    return names


# =====================================================================================================================
# 3. THE BATCHES AND THE CP-SAT MODEL
# =====================================================================================================================
@dataclass
class Batch:
    bid: int
    cake: str
    no: int          # 1..20 inside the cake
    week: int
    rel: int         # earliest start slot
    due: int         # last end slot


def make_batches() -> List[Batch]:
    weeks = production_weeks()
    out: List[Batch] = []
    for cake in CAKE_ORDER:
        no = 0
        for w, cnt in enumerate(WEEKS_BATCHES):
            first_day = weeks[w][0]
            rel = slot_of(first_day, FIRST_DAY_RELEASE_MIN if w == 0 else 360)
            due = slot_of(weeks[w][-1], 22 * 60)
            for _ in range(cnt):
                no += 1
                out.append(Batch(len(out), cake, no, w, rel, due))
    assert all(sum(1 for b in out if b.cake == c) == BATCHES_PER_POSITION for c in CAKE_ORDER)
    return out


def worker_minutes(batches: List[Batch]) -> int:
    return sum(op.dmin for b in batches for op in ROUTING[b.cake] if op.kind == 'W')


def window_domain(dur_slots: int, crews: Dict[str, int], days: List[int]) -> cp_model.Domain:
    """All start slots at which a worker operation fits completely into ONE work window (so no break is touched)."""
    ivs = []
    for d in days:
        for c, n in crews.items():
            if n <= 0:
                continue
            for a, b in SHIFTS[c]:
                lo, hi = slot_of(d, a), slot_of(d, b) - dur_slots
                if hi >= lo:
                    ivs.append([lo, hi])
    ivs.sort()
    return cp_model.Domain.FromIntervals(ivs)


def solve(batches: List[Batch], nE: int, nL: int, time_limit: float, optimize: bool, hint: Optional[dict] = None,
          threads: int = 0, log: bool = False) -> Optional[dict]:
    """One CP-SAT run for a given crew size. Returns the schedule or None (infeasible / not found in time)."""
    m = cp_model.CpModel()
    crews = {'E': nE, 'L': nL}
    weeks = production_weeks()
    days = [d for w in weeks for d in w]
    CAP = max(nE, nL)
    horizon = NDAYS * SPD

    # one day off per worker and week: how many workers of a crew are off on each weekday Mon..Sat
    off: Dict[str, List[cp_model.IntVar]] = {}
    for c, n in crews.items():
        if n <= 0:
            continue
        off[c] = [m.NewIntVar(0, math.ceil(n / 6), f'off_{c}{w}') for w in range(6)]
        m.Add(sum(off[c]) == n)

    # the crews' presence as blockers of the worker capacity
    worker_iv, worker_dem = [], []
    for d in days:
        wd = weekday(d)
        for c, n in crews.items():
            if n <= 0:
                continue
            for a, b in SHIFTS[c]:
                dem = CAP - n + off[c][wd]
                worker_iv.append(m.NewFixedSizeIntervalVar(slot_of(d, a), (b - a) // SLOT, f'blk{c}{d}{a}'))
                worker_dem.append(dem)

    res_iv: Dict[str, List[cp_model.IntervalVar]] = collections.defaultdict(list)
    S: Dict[Tuple[int, str], cp_model.IntVar] = {}
    E: Dict[Tuple[int, str], cp_model.LinearExprT] = {}
    SZ: Dict[Tuple[int, str], cp_model.IntVar] = {}
    ends = []
    dom_cache: Dict[int, cp_model.Domain] = {}
    for b in batches:
        ops = ROUTING[b.cake]
        by_id = {o.id: o for o in ops}
        succ: Dict[str, str] = {}
        for o in ops:
            for a in o.after:
                succ.setdefault(a, o.id)
        for o in ops:
            if o.kind == 'W':
                dur = o.dmin // SLOT
                dom = dom_cache.setdefault(dur, window_domain(dur, crews, days))
                s = m.NewIntVarFromDomain(dom, f's{b.bid}{o.id}')
                S[b.bid, o.id] = s
                E[b.bid, o.id] = s + dur
                iv = m.NewFixedSizeIntervalVar(s, dur, f'i{b.bid}{o.id}')
                worker_iv.append(iv)
                worker_dem.append(1)
                if o.res:
                    res_iv[o.res].append(iv)
        for o in ops:
            if o.kind == 'W':
                for a in o.after:
                    p = by_id[a]
                    if p.kind == 'W':
                        m.Add(S[b.bid, o.id] >= E[b.bid, a])
        for o in ops:
            if o.kind != 'P':
                continue
            pred = by_id[o.after[0]]
            nxt = by_id[succ[o.id]]
            start_e = E[b.bid, pred.id]
            end_s = S[b.bid, nxt.id]
            size = m.NewIntVar(o.dmin // SLOT, o.dmax // SLOT, f'z{b.bid}{o.id}')
            SZ[b.bid, o.id] = size
            iv = m.NewIntervalVar(start_e, size, end_s, f'p{b.bid}{o.id}')
            if o.res == 'Chiller' or o.res == 'Rack':
                res_iv[o.res].append(iv)
            elif o.res == 'Oven':
                # the oven is busy from the start of the loading to the start of the unloading
                load_s = S[b.bid, pred.id]
                span = m.NewIntVar(1, horizon, f'oz{b.bid}')
                res_iv['Oven'].append(m.NewIntervalVar(load_s, span, end_s, f'oven{b.bid}'))
            S[b.bid, o.id] = start_e   # (expression) start of the passive step = end of its predecessor
            E[b.bid, o.id] = end_s
        last = ops[-1].id
        m.Add(S[b.bid, ops[0].id] >= b.rel)
        m.Add(E[b.bid, last] <= b.due)
        ends.append(E[b.bid, last])
    # identical batches of one week: the same order (breaks the symmetry)
    for i in range(len(batches) - 1):
        a, c = batches[i], batches[i + 1]
        if a.cake == c.cake and a.week == c.week:
            m.Add(S[a.bid, ROUTING[a.cake][0].id] <= S[c.bid, ROUTING[c.cake][0].id])

    m.AddCumulative(worker_iv, worker_dem, CAP)
    for r, ivs in res_iv.items():
        m.AddCumulative(ivs, [1] * len(ivs), CAPACITY[r])

    if optimize:
        m.Minimize(sum(ends))
    if hint:
        for (bid, oid), v in hint.items():
            var = S.get((bid, oid))
            if var is not None and isinstance(var, cp_model.IntVar):
                m.AddHint(var, v)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = threads or max(1, (os.cpu_count() or 8) - 2)
    solver.parameters.log_search_progress = log
    solver.parameters.random_seed = 20260101
    if not optimize:
        solver.parameters.stop_after_first_solution = True
    st = solver.Solve(m)
    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {'status': solver.StatusName(st)}

    def val(x):
        return int(solver.Value(x))
    start: Dict[Tuple[int, str], int] = {}
    end: Dict[Tuple[int, str], int] = {}
    for b in batches:
        for o in ROUTING[b.cake]:
            start[b.bid, o.id] = val(S[b.bid, o.id])
            end[b.bid, o.id] = val(E[b.bid, o.id])
    return {'status': solver.StatusName(st), 'start': start, 'end': end, 'nE': nE, 'nL': nL,
            'off': {c: [val(v) for v in vs] for c, vs in off.items()},
            'objective': solver.ObjectiveValue() if optimize else None, 'bound': solver.BestObjectiveBound() if optimize else None,
            'wall': solver.WallTime()}


# =====================================================================================================================
# 4. FROM THE SOLUTION TO PEOPLE AND MACHINES
# =====================================================================================================================
@dataclass
class Task:
    batch: Batch
    op: Op
    start: dt.datetime
    end: dt.datetime
    worker: str = ''
    unit: str = ''            # machine unit (Oven 1, Mixer 2 ...)
    crew: str = ''


def crew_of(minute_start: int) -> str:
    return 'E' if minute_start < 840 else 'L'


def assign(batches: List[Batch], sol: dict) -> Tuple[List[Task], Dict[str, dict]]:
    names = make_names(sol['nE'] + sol['nL'])
    workers: Dict[str, dict] = {}
    pos = 0
    for c in ('E', 'L'):
        n = sol['nE'] if c == 'E' else sol['nL']
        offs: List[int] = []
        for w, cnt in enumerate(sol['off'].get(c, [])):
            offs += [w] * cnt
        for k in range(n):
            nm = names[pos]
            pos += 1
            workers[nm] = dict(name=nm, crew=c, off=offs[k], minutes=0, ops=0, days=set(), busy=0)
    tasks: List[Task] = []
    for b in batches:
        for o in ROUTING[b.cake]:
            s, e = sol['start'][b.bid, o.id], sol['end'][b.bid, o.id]
            tasks.append(Task(b, o, dt_of(s), dt_of(e)))
    # --- workers: per day, ops in start order; a worker of the crew who is on duty and free, with the fewest minutes so far
    wops = sorted((t for t in tasks if t.op.kind == 'W'), key=lambda t: (t.start, t.batch.bid))
    free_at: Dict[str, dt.datetime] = {}
    for t in wops:
        c = crew_of(t.start.hour * 60 + t.start.minute)
        wd = t.start.weekday()
        cand = [w for w in workers.values() if w['crew'] == c and w['off'] != wd and free_at.get(w['name'], DT0) <= t.start]
        if not cand:
            raise RuntimeError(f'no free worker for {t.op.name} at {t.start}')
        w = min(cand, key=lambda x: (x['minutes'], x['name']))
        t.worker, t.crew = w['name'], c
        free_at[w['name']] = t.end
        w['minutes'] += int((t.end - t.start).total_seconds() // 60)
        w['ops'] += 1
        w['days'].add(t.start.date())
    # --- machines: the first free unit of the resource (a span = from the start of loading to the start of unloading for the oven)
    spans: Dict[str, List[Tuple[dt.datetime, dt.datetime, Task]]] = collections.defaultdict(list)
    by_batch: Dict[int, Dict[str, Task]] = collections.defaultdict(dict)
    for t in tasks:
        by_batch[t.batch.bid][t.op.id] = t
    for t in tasks:
        if not t.op.res:
            continue
        if t.op.kind == 'W':
            spans[t.op.res].append((t.start, t.end, t))
        elif t.op.res == 'Oven':
            load = by_batch[t.batch.bid][t.op.after[0]]
            spans['Oven'].append((load.start, t.end, t))
        else:
            spans[t.op.res].append((t.start, t.end, t))
    for r, lst in spans.items():
        lst.sort(key=lambda x: (x[0], x[2].batch.bid))
        busy_until = [DT0] * CAPACITY[r]
        for a, b2, t in lst:
            k = next(i for i in range(CAPACITY[r]) if busy_until[i] <= a)
            busy_until[k] = b2
            t.unit = f'{RES_UNIT[r]} {k + 1}'
            if t.op.kind == 'P' and r == 'Oven':
                load = by_batch[t.batch.bid][t.op.after[0]]
                load.unit = t.unit
    return tasks, workers


# =====================================================================================================================
# 5. THE PURCHASE PLAN (order = delivery - 2 days or more) AND THE GOODS RECEIPT
# =====================================================================================================================
@dataclass
class Lot:
    ing: str
    first_use: dt.date
    last_use: dt.date
    qty_need: float
    qty: float
    delivery: dt.date = None
    order: dt.date = None
    uses: List[Tuple[int, str]] = field(default_factory=list)   # (batch id, op id) that draw from the lot
    po: str = ''


@dataclass
class PO:
    no: str
    supplier: str
    order: dt.date
    delivery: dt.date
    lots: List[Lot]
    receipt_start: dt.datetime = None
    receipt_end: dt.datetime = None
    keeper: str = ''
    order_start: dt.datetime = None


def latest(day: dt.date, ok) -> dt.date:
    while not ok(day):
        day -= dt.timedelta(days=1)
    return day


def ceil_pack(q: float, pack: float) -> float:
    n = math.ceil(q / pack - 1e-9)
    return round(n * pack, 3)


def build_purchase(tasks: List[Task]) -> Tuple[List[PO], List[Lot]]:
    # consumption events: food at the weighing, packaging at the last operation
    ev: Dict[str, List[Tuple[dt.date, float, int, str]]] = collections.defaultdict(list)
    for t in tasks:
        r = RECIPES[t.batch.cake]
        if t.op is ROUTING[t.batch.cake][0]:
            for code, q in r['ing'].items():
                ev[code].append((t.start.date(), q * BATCH_CAKES, t.batch.bid, t.op.id))
        if t.op is ROUTING[t.batch.cake][-1]:
            for code in PACKAGING:
                ev[code].append((t.start.date(), 1.0 * BATCH_CAKES, t.batch.bid, t.op.id))
    lots: List[Lot] = []
    for code, lst in ev.items():
        lst.sort()
        cover = ING[code][6]
        cur: Optional[Lot] = None
        for day, q, bid, oid in lst:
            if cur is None or day > cur.first_use + dt.timedelta(days=cover - 1):
                cur = Lot(code, day, day, 0.0, 0.0)
                lots.append(cur)
            cur.qty_need += q
            cur.last_use = max(cur.last_use, day)
            cur.uses.append((bid, oid))
    for lot in lots:
        pack = ING[lot.ing][4]
        lot.qty = ceil_pack(lot.qty_need * WASTE, pack)
        # delivery: the last plant day before the first use (not before 3 Jan); order: the last buyer day <= delivery - 2
        d = latest(lot.first_use - dt.timedelta(days=1), PLANT_DAY)
        if d < FIRST_DELIVERY:
            d = FIRST_DELIVERY
        lot.delivery = d
        lot.order = latest(d - dt.timedelta(days=LEAD_DAYS), BUYER_DAYS)
        assert lot.order >= DAY0, (lot.ing, lot.order)
        shelf = ING[lot.ing][5]
        assert (lot.last_use - lot.delivery).days < shelf, f'{lot.ing}: shelf life {shelf} d is shorter than the cover'
    groups: Dict[Tuple[dt.date, dt.date, str], List[Lot]] = collections.defaultdict(list)
    for lot in lots:
        groups[lot.order, lot.delivery, ING[lot.ing][3]].append(lot)
    pos: List[PO] = []
    for i, ((o, d, sup), ls) in enumerate(sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][2], kv[0][1])), 1):
        po = PO(f'PO-2026-{i:03d}', sup, o, d, sorted(ls, key=lambda l: l.ing))
        for l in po.lots:
            l.po = po.no
        pos.append(po)
    # buyer: orders of one day one after the other from 09:00, 10 minutes a line
    by_order: Dict[dt.date, List[PO]] = collections.defaultdict(list)
    for po in pos:
        by_order[po.order].append(po)
    for day, lst in by_order.items():
        t = dt.datetime.combine(day, dt.time(9, 0))
        for po in lst:
            po.order_start = t
            t += dt.timedelta(minutes=10 * len(po.lots))
    # goods receipt: two warehouse keepers (one day off each), from 06:00, 15 + 5 minutes a line
    by_del: Dict[dt.date, List[PO]] = collections.defaultdict(list)
    for po in pos:
        by_del[po.delivery].append(po)
    for day, lst in by_del.items():
        on = [k for k in KEEPERS if KEEPER_OFF[k] != day.weekday()]
        free = {k: dt.datetime.combine(day, dt.time(6, 0)) for k in on}
        for po in sorted(lst, key=lambda p: -len(p.lots)):
            k = min(on, key=lambda x: (free[x], x))
            mins = 15 + 5 * len(po.lots)
            po.keeper, po.receipt_start = k, free[k]
            po.receipt_end = free[k] + dt.timedelta(minutes=mins)
            free[k] = po.receipt_end
    return pos, lots


# =====================================================================================================================
# 6. VERIFICATION (independent of the solver)
# =====================================================================================================================
def verify(batches, tasks, workers, sol, pos, lots) -> Dict[str, object]:
    stats: Dict[str, object] = {}
    # 6.1 quantities and the number of worker operations per cake
    for c in CAKE_ORDER:
        n = sum(BATCH_CAKES for b in batches if b.cake == c)
        assert n == CAKES_PER_POSITION, (c, n)
        assert sum(1 for o in ROUTING[c] if o.kind == 'W') <= MAX_WORKER_OPS, c
        assert all(o.dmin <= MAX_WORKER_OP_MIN for o in ROUTING[c] if o.kind == 'W'), c
    # 6.2 every worker operation lies inside ONE work window (no break touched), in the shift of its worker
    for t in tasks:
        if t.op.kind != 'W':
            continue
        a, b = t.start.hour * 60 + t.start.minute, t.end.hour * 60 + t.end.minute
        assert t.start.date() == t.end.date() and any(w0 <= a and b <= w1 for c in SHIFTS for (w0, w1) in SHIFTS[c]), (t.op.name, t.start)
        assert workers[t.worker]['crew'] == crew_of(a), (t.worker, t.start)
        assert t.start.weekday() != workers[t.worker]['off'] and PLANT_DAY(t.start.date()), (t.worker, t.start)
        assert (t.end - t.start).total_seconds() / 60 == t.op.dmin
    # 6.3 no overlap of a worker; <= 5 shifts a week; the rest between two shifts >= 11 h; net time of a day <= 7 h 15 min
    per: Dict[str, List[Task]] = collections.defaultdict(list)
    for t in tasks:
        if t.op.kind == 'W':
            per[t.worker].append(t)
    for w, lst in per.items():
        lst.sort(key=lambda x: x.start)
        for x, y in zip(lst, lst[1:]):
            assert x.end <= y.start, (w, x.start, y.start)
        days = sorted({t.start.date() for t in lst})
        weeks = collections.Counter(d - dt.timedelta(days=d.weekday()) for d in days)
        assert max(weeks.values()) <= 5, (w, weeks)
        crew = workers[w]['crew']
        first_start = {'E': 6 * 60, 'L': 14 * 60}[crew]
        last_end = {'E': 14 * 60, 'L': 22 * 60}[crew]
        assert (24 * 60 - last_end) + first_start >= 11 * 60
        mins = collections.Counter()
        for t in lst:
            mins[t.start.date()] += int((t.end - t.start).total_seconds() // 60)
        assert max(mins.values()) <= SHIFT_NET_MIN, (w, max(mins.values()))
    # 6.4 routing: predecessors, passive minimum / maximum, release, due date
    by_batch: Dict[int, Dict[str, Task]] = collections.defaultdict(dict)
    for t in tasks:
        by_batch[t.batch.bid][t.op.id] = t
    for b in batches:
        ts = by_batch[b.bid]
        for o in ROUTING[b.cake]:
            t = ts[o.id]
            for a in o.after:
                assert ts[a].end <= t.start, (b.cake, b.no, a, o.id)
            if o.kind == 'P':
                mins = (t.end - t.start).total_seconds() / 60
                assert o.dmin <= mins <= o.dmax, (b.cake, b.no, o.id, mins)
                assert t.start == ts[o.after[0]].end
        first, last = ts[ROUTING[b.cake][0].id], ts[ROUTING[b.cake][-1].id]
        assert first.start >= dt_of(b.rel) and last.end <= dt_of(b.due), (b.cake, b.no)
    # 6.5 machines: the capacity at every moment
    spans: Dict[str, List[Tuple[dt.datetime, dt.datetime]]] = collections.defaultdict(list)
    for t in tasks:
        if not t.op.res:
            continue
        if t.op.kind == 'P' and t.op.res == 'Oven':
            spans['Oven'].append((by_batch[t.batch.bid][t.op.after[0]].start, t.end))
        else:
            spans[t.op.res].append((t.start, t.end))
    peak = {}
    for r, lst in spans.items():
        pts = sorted([(a, 1) for a, _ in lst] + [(b, -1) for _, b in lst], key=lambda x: (x[0], x[1]))
        cur = mx = 0
        for _, dlt in pts:
            cur += dlt
            mx = max(mx, cur)
        assert mx <= CAPACITY[r], (r, mx)
        peak[r] = mx
    stats['machine_peak'] = peak
    # 6.6 purchase: the delay of every order, the receipts, the stock at every use
    for po in pos:
        assert (po.delivery - po.order).days >= LEAD_DAYS, po.no
        assert BUYER_DAYS(po.order) and PLANT_DAY(po.delivery) and po.order >= DAY0 and po.delivery >= FIRST_DELIVERY, po.no
        assert po.receipt_end.date() == po.delivery and po.receipt_end.hour * 60 + po.receipt_end.minute <= 840
    po_by_no = {p.no: p for p in pos}
    for lot in lots:
        po = po_by_no[lot.po]
        for bid, oid in lot.uses:
            t = by_batch[bid][oid]
            assert t.start >= po.receipt_end, (lot.ing, bid, t.start, po.receipt_end)
    stock = collections.defaultdict(float)
    events = []
    for lot in lots:
        events.append((po_by_no[lot.po].receipt_end, 0, lot.ing, lot.qty))
    for t in tasks:
        r = RECIPES[t.batch.cake]
        if t.op is ROUTING[t.batch.cake][0]:
            for code, q in r['ing'].items():
                events.append((t.start, 1, code, -q * BATCH_CAKES))
        if t.op is ROUTING[t.batch.cake][-1]:
            for code in PACKAGING:
                events.append((t.start, 1, code, -float(BATCH_CAKES)))
    for when, _, code, q in sorted(events):
        stock[code] += q
        assert stock[code] >= -1e-6, ('stock below zero', code, when)
    stats['end_stock'] = {k: round(v, 2) for k, v in stock.items() if v > 1e-6}
    return stats


# =====================================================================================================================
# 7. THE WBS FOR appPM80 (format kit8.pm.project, version 1)
# =====================================================================================================================
CC = {  # custom columns of the project: key -> (name, type)
    'cc_worker': ('Worker', 'text'), 'cc_role': ('Role', 'text'), 'cc_from': ('From', 'text'), 'cc_to': ('To', 'text'),
    'cc_min': ('Minutes', 'integer'), 'cc_res': ('Machine', 'text'), 'cc_cakes': ('Cakes', 'integer'),
    'cc_qty': ('Qty', 'float'), 'cc_unit': ('Unit', 'text'), 'cc_eur': ('EUR', 'float'), 'cc_supplier': ('Supplier', 'text'),
    'cc_order': ('Order date', 'date'), 'cc_deliv': ('Delivery date', 'date'), 'cc_po': ('PO', 'text'),
}
COL_FOOD, COL_PASSIVE, COL_BUY, COL_RECEIPT, COL_PEOPLE = '#2563eb', '#94a3b8', '#d97706', '#0d9488', '#7c3aed'


def gid(key: str) -> str:
    return str(uuid.uuid5(NS, key))


def label(guid: str) -> str:
    return guid.lower().replace('-', '_')


def iso_day(d: dt.date) -> str:
    return f'{d.isoformat()}T00:00:00.000Z'


class Wbs:
    def __init__(self):
        self.tasks: List[dict] = []
        self.deps: List[dict] = []
        self.path: Dict[str, str] = {}
        self.guid: Dict[str, str] = {}
        self.start_day: Dict[str, dt.date] = {}
        self.end_day: Dict[str, dt.date] = {}
        self.order: Dict[str, int] = collections.defaultdict(int)
        self.proj_label = label(PROJECT_GUID)

    def add(self, key: str, parent: Optional[str], kind: str, title: str, *, start: Optional[dt.datetime] = None, end: Optional[dt.datetime] = None,
            notes: str = '', cc: Optional[dict] = None, color: Optional[str] = None) -> str:
        g = gid(key)
        self.guid[key] = g
        parent_path = self.path[parent] if parent else self.proj_label
        self.path[key] = f'{parent_path}.{label(g)}'
        self.order[parent or ''] += 1024
        js: dict = {'rowKind': kind, 'taskDescription': title, 'durationDays': 0}
        if kind != 'stage' and start is not None:
            last = end if end is not None else start
            last_day = (last - dt.timedelta(minutes=1)).date() if (last.hour == 0 and last.minute == 0 and last > start) else last.date()
            self.start_day[key], self.end_day[key] = start.date(), last_day
            js['durationDays'] = 0 if kind == 'milestone' else (last_day - start.date()).days + 1
            js['manualStartAt'] = iso_day(start.date())
            js['startHourStart'], js['planMinuteStart'] = start.hour, start.minute
            js['startHourFinish'], js['planMinuteFinish'] = last.hour, last.minute
        if notes:
            js['notes'] = notes
        if cc:
            js['customColumns'] = cc
        if color:
            js['taskColor'] = color
        self.tasks.append({'rowGUID': g, 'treePath': self.path[key], 'projectGUID': PROJECT_GUID, 'rowOwnerGUID': OWNER_PLACEHOLDER,
                           'rowDuration': None, 'rowProgress': 0, 'orderInList': self.order[parent or ''], 'rowJSON': js})
        return key

    def link(self, pred: str, succ: str):
        """FS when the successor starts on a later day than the predecessor ends, else SS with the day difference."""
        ps, pe, ss = self.start_day[pred], self.end_day[pred], self.start_day[succ]
        if ss > pe:
            typ, lag = 'FS', (ss - pe).days - 1
        else:
            typ, lag = 'SS', (ss - ps).days
        assert lag >= 0, (pred, succ)
        self.deps.append({'rowGUID': self.guid[succ], 'rowDependsOnGUID': self.guid[pred], 'projectGUID': PROJECT_GUID,
                          'rowOwnerGUID': OWNER_PLACEHOLDER, 'linkType': typ, 'lagDays': lag, 'rowJSON': {}})


def fmt_q(q: float) -> str:
    return f'{q:,.2f}'.rstrip('0').rstrip('.') if q < 1000 else f'{q:,.0f}'


def day_label(d: dt.date) -> str:
    return d.strftime('%a %d %b')


def build_wbs(batches, tasks, workers, sol, pos, lots, stats, summary) -> dict:
    w = Wbs()
    nE, nL = sol['nE'], sol['nL']
    # ---------------------------------------------------------------- 1. workforce
    w.add('S_staff', None, 'stage', 'WORKFORCE & ROSTER', notes=(
        f'{nE + nL} confectioners (found by OR-Tools CP-SAT: Early crew {nE}, Late crew {nL}) + 1 purchasing manager + 2 warehouse keepers. '
        f'Shifts: {SHIFT_NAME["E"]} (breaks {", ".join(SHIFT_BREAKS["E"])}) and {SHIFT_NAME["L"]} (breaks {", ".join(SHIFT_BREAKS["L"])}). '
        'Rest rules: one day off a week for everybody (5 shifts), the plant is closed on Sunday and on 1 January, 16 h between two shifts, 45 min of breaks in every shift. Names are fictional.'))
    first, last = dt.datetime(2026, 1, 3, 6, 0), dt.datetime(2026, 1, 30, 22, 0)
    for nm, wk in sorted(workers.items(), key=lambda kv: (kv[1]['crew'], kv[0])):
        days = len(wk['days'])
        w.add(f'staff_{nm}', 'S_staff', 'task', f'{nm} · Confectioner · {SHIFT_NAME[wk["crew"]]} · day off {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][wk["off"]]}',
              start=first, end=last,
              notes=f'{days} shifts, {wk["ops"]} operations, {wk["minutes"] // 60} h {wk["minutes"] % 60} min of work ({wk["minutes"] / (days * SHIFT_NET_MIN) * 100:.0f} % of the net shift time). '
                    f'Breaks: {", ".join(SHIFT_BREAKS[wk["crew"]])}.',
              cc={'cc_worker': nm, 'cc_role': 'Confectioner', 'cc_min': wk['minutes']}, color=COL_PEOPLE)
    w.add('staff_buyer', 'S_staff', 'task', f'{BUYER} · Purchasing manager · Mon-Fri 09:00-17:00 (1 Jan on holiday duty, online orders)', start=dt.datetime(2026, 1, 1, 9, 0), end=dt.datetime(2026, 1, 30, 17, 0),
          cc={'cc_worker': BUYER, 'cc_role': 'Purchasing manager'}, color=COL_PEOPLE)
    for k in KEEPERS:
        w.add(f'staff_{k}', 'S_staff', 'task', f'{k} · Warehouse keeper · from 06:00 · day off {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][KEEPER_OFF[k]]}', start=dt.datetime(2026, 1, 3, 6, 0), end=dt.datetime(2026, 1, 30, 14, 0),
              cc={'cc_worker': k, 'cc_role': 'Warehouse keeper'}, color=COL_PEOPLE)
    # ---------------------------------------------------------------- 2. purchasing
    total_eur = sum(l.qty * ING[l.ing][2] for l in lots)
    w.add('S_buy', None, 'stage', 'PURCHASING & GOODS RECEIPT (order 2 days before delivery)', notes=(
        f'{len(pos)} purchase orders, {len(lots)} order lines, {total_eur:,.0f} EUR of organic ingredients and compostable packaging. '
        'Every order is placed at least 2 calendar days before the delivery (lead time of the suppliers); the first orders go out on 1 January, '
        'the first delivery is 3 January. Goods receipt: two warehouse keepers from 06:00. Quantities include 2 % waste and are rounded up to the pack size.'))
    for po in pos:
        k = f'po_{po.no}'
        w.add(k, 'S_buy', 'stage', f'{po.no} · {SUPPLIERS[po.supplier]} · order {day_label(po.order)} -> delivery {day_label(po.delivery)}',
              notes=f'{len(po.lots)} lines, {sum(l.qty * ING[l.ing][2] for l in po.lots):,.0f} EUR. Delivery is {(po.delivery - po.order).days} calendar days after the order.')
        t = po.order_start
        for l in po.lots:
            nm, unit, price, sup, pack, shelf, cover, origin = ING[l.ing]
            w.add(f'{k}_{l.ing}', k, 'task', f'Order {fmt_q(l.qty)} {unit} {nm}', start=t, end=t + dt.timedelta(minutes=10),
                  notes=f'{origin}. Covers the use {day_label(l.first_use)} - {day_label(l.last_use)} (need {fmt_q(l.qty_need)} {unit}, +2 % waste, pack {fmt_q(pack)} {unit}). Shelf life {shelf} days.',
                  cc={'cc_worker': BUYER, 'cc_role': 'Purchasing manager', 'cc_from': hhmm(t), 'cc_to': hhmm(t + dt.timedelta(minutes=10)), 'cc_min': 10, 'cc_qty': l.qty, 'cc_unit': unit,
                      'cc_eur': round(l.qty * price, 2), 'cc_supplier': SUPPLIERS[sup], 'cc_order': l.order.isoformat(), 'cc_deliv': l.delivery.isoformat(), 'cc_po': po.no},
                  color=COL_BUY)
            t += dt.timedelta(minutes=10)
        w.add(f'{k}_receipt', k, 'task', f'Goods receipt {po.no} · {po.keeper} · {hhmm(po.receipt_start)}-{hhmm(po.receipt_end)}', start=po.receipt_start, end=po.receipt_end,
              notes='Check the organic / Fairtrade certificate, temperature, best-before dates; lot numbers into the batch record.',
              cc={'cc_worker': po.keeper, 'cc_role': 'Warehouse keeper', 'cc_from': hhmm(po.receipt_start), 'cc_to': hhmm(po.receipt_end),
                  'cc_min': int((po.receipt_end - po.receipt_start).total_seconds() // 60), 'cc_supplier': SUPPLIERS[po.supplier], 'cc_deliv': po.delivery.isoformat(), 'cc_po': po.no},
              color=COL_RECEIPT)
        for l in po.lots:
            w.link(f'{k}_{l.ing}', f'{k}_receipt')
    # ---------------------------------------------------------------- 3. cakes
    by_batch: Dict[int, Dict[str, Task]] = collections.defaultdict(dict)
    for t in tasks:
        by_batch[t.batch.bid][t.op.id] = t
    lot_of: Dict[Tuple[int, str], List[Lot]] = collections.defaultdict(list)
    for l in lots:
        for bid, oid in l.uses:
            lot_of[bid, oid].append(l)
    po_by_no = {p.no: p for p in pos}
    for cake in CAKE_ORDER:
        r = RECIPES[cake]
        kcost = sum(q * ING[c][2] for c, q in r['ing'].items())
        pcost = sum(ING[c][2] for c in PACKAGING)
        comp = '; '.join(f'{ING[c][0]} {fmt_q(q)} {ING[c][1]}' for c, q in r['ing'].items())
        sk = f'S_{cake}'
        w.add(sk, None, 'stage', f'{r["title"]} · {CAKES_PER_POSITION} cakes × 5 kg ({BATCHES_PER_POSITION} batches × {BATCH_CAKES})',
              notes=f'Per 5 kg cake ({r["comps"]} organic plant-based components): {comp}. Ingredients {kcost:.2f} EUR + packaging {pcost:.2f} EUR per cake '
                    f'(x5 of the home cake, reference {r["price"]} EUR per small cake). All ingredients organic (EU 2018/848), tropical ones Fairtrade, no palm oil, no eggs / dairy, compostable packaging (EN 13432).',
              color=r['color'])
        for b in [x for x in batches if x.cake == cake]:
            ts = by_batch[b.bid]
            f0, l0 = ts[ROUTING[cake][0].id], ts[ROUTING[cake][-1].id]
            bk = f'b{b.bid}'
            w.add(bk, sk, 'stage', f'Batch {b.no:02d}/{BATCHES_PER_POSITION} · {BATCH_CAKES} cakes · {day_label(f0.start.date())} {hhmm(f0.start)} -> {day_label(l0.end.date())} {hhmm(l0.end)}',
                  notes=f'{BATCH_CAKES} cakes × 5 kg = {BATCH_CAKES * CAKE_KG:.0f} kg. Worker operations: {sum(1 for o in ROUTING[cake] if o.kind == "W")} (max {MAX_WORKER_OPS}), passive steps: {sum(1 for o in ROUTING[cake] if o.kind == "P")}.',
                  color=r['color'])
            prev: Dict[str, str] = {}
            for o in ROUTING[cake]:
                t = ts[o.id]
                key = f'{bk}_{o.id}'
                mins = int((t.end - t.start).total_seconds() // 60)
                notes = o.note
                if o is ROUTING[cake][0]:
                    notes = (notes + ' ' if notes else '') + 'For the batch: ' + '; '.join(f'{ING[c][0]} {fmt_q(q * BATCH_CAKES)} {ING[c][1]}' for c, q in r['ing'].items()) + '.'
                if o is ROUTING[cake][-1]:
                    notes = (notes + ' ' if notes else '') + f'Packaging for the batch: {BATCH_CAKES} boxes, {BATCH_CAKES} boards, {BATCH_CAKES} labels.'
                cc = {'cc_from': hhmm(t.start), 'cc_to': hhmm(t.end), 'cc_min': mins, 'cc_cakes': BATCH_CAKES}
                if o.kind == 'W':
                    cc.update({'cc_worker': t.worker, 'cc_role': 'Confectioner'})
                    if t.unit:
                        cc['cc_res'] = t.unit
                    title = f'{o.name} · {t.worker} · {hhmm(t.start)}-{hhmm(t.end)}'
                else:
                    cc.update({'cc_worker': '(machine)', 'cc_role': 'passive step'})
                    cc['cc_res'] = t.unit or o.res
                    title = f'{o.name} ({fmt_h(mins)}) · {t.unit or o.res}'
                w.add(key, bk, 'task', title, start=t.start, end=t.end, notes=notes, cc=cc, color=(r['color'] if o.kind == 'W' else COL_PASSIVE))
                prev[o.id] = key
            for o in ROUTING[cake]:
                for a in o.after:
                    w.link(prev[a], prev[o.id])
            # the goods receipts the batch draws from
            for (oid_key) in (ROUTING[cake][0].id, ROUTING[cake][-1].id):
                seen = set()
                for l in lot_of[b.bid, oid_key]:
                    if l.po in seen:
                        continue
                    seen.add(l.po)
                    w.link(f'po_{l.po}_receipt', prev[oid_key])
    # ---------------------------------------------------------------- the file
    first_day = DAY0
    project_json = {
        'rowKind': 'project', 'name': 'CAKE1 · Eco supercakes · January 2026', 'durationDays': 0,
        'projectStartAt': iso_day(first_day), 'projectStartDate': first_day.isoformat(), 'skipWeekends': False,
        'planDay': True, 'planHour': True, 'planMinute': True, 'planSecond': False,
        'customColumns': {'columns': [{'key': k, 'name': n, 'type': t, 'createdAt': '2026-11-17T00:00:00.000Z'} for k, (n, t) in CC.items()],
                          'headersBackgroundColors': {}},
        'notes': summary['project_notes'],
    }
    order = ['wbs', 'name', 'cc_worker', 'taskStartDate', 'startHourStart', 'planMinuteStart', 'taskFinishDate', 'startHourFinish', 'planMinuteFinish', 'taskDuration',
             'cc_min', 'cc_res', 'cc_cakes', 'cc_qty', 'cc_unit', 'cc_eur', 'cc_supplier', 'cc_order', 'cc_deliv', 'cc_po', 'cc_role', 'cc_from', 'cc_to', 'progress']
    return {
        'format': 'kit8.pm.project', 'version': 1, 'exportedAt': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z'),
        'project': {'rowGUID': PROJECT_GUID, 'treePath': label(PROJECT_GUID), 'rowOwnerGUID': OWNER_PLACEHOLDER, 'rowDuration': None, 'rowProgress': 0, 'orderInList': 1024,
                    'rowJSON': project_json},
        'tasks': w.tasks, 'dependencies': w.deps,
        'uxuiSettings': {'treeColumnsOrder': order, 'showCriticalPath': False},
    }


def fmt_h(mins: int) -> str:
    h, m = divmod(mins, 60)
    return f'{h} h {m:02d} min' if h else f'{m} min'


# =====================================================================================================================
# 7b. THE TASK LINES (what Post takes) - derived from the WBS itself, so the same code can complete an existing file (--lines-only)
# =====================================================================================================================
# Only what exists in every database after start4 is referenced: the genus, the units, the budget items, the uniform distribution.
# NO roles / persons / products are made (they are catalogs of the organization): a line is priced by hand (priceSourceTaskLine 'manual') and
# its description (the subtitle of the resource column) names the worker or the ingredient. All money in EUR, VAT is not modelled (0 %).
RATES = {'Confectioner': 21.00, 'Purchasing manager': 28.00, 'Warehouse keeper': 18.00}      # EUR per hour, fully loaded (illustrative)
UNIT_OF = {'kg': 'unit_kg', 'l': 'unit_l', 'pcs': 'unit_pcs'}
ITEM_WAGES, ITEM_RAW, ITEM_PACK = 'employeeWagesBudgetItem', 'rawMaterialsBudgetItem', 'consumablesBudgetItem'
CALENDAR_FOR_POST = 'sixDayWeekCalendar'      # Mon-Sat, no holidays: the plant works on Saturdays and the buyer orders on 1 January (workingDaysCalendar = Mon-Fri would refuse those tasks)
PROJECT_SETTINGS = {
    'currencyForBudget': 'EUR', 'currencyForContract': 'EUR', 'currencyForAccounting': 'EUR',
    'budgetScenarioForPlan': 'planScenarioProject1', 'budgetScenarioForFact': 'factScenarioProject1', 'calendarForTaskPlan': CALENDAR_FOR_POST,
    'projectExpenseBudgetNeeded': True, 'projectTimeCostsNeeded': True, 'projectTimeOfPersonNeeded': True, 'projectMaterialCostsNeeded': True,
    'projectExpenseCostsNeeded': False, 'projectRevenueBudgetNeeded': False,
}


def money(q: float, price: float) -> float:
    return round(q * price + 1e-9, 2)


def make_line(task_guid: str, key: str, n: int, genus: str, unit: str, qty: float, price: float, item: str, text: str) -> dict:
    s = money(qty, price)
    return {'rowGUID': gid(f'line:{key}:{n}'), 'rowOwnerGUID': task_guid, 'rowParentGUID': genus, 'orderInList': n * 1024,
            'rowJSON': {'taskManagementGenusLine': genus, 'distributionForBudgetTaskLine': 'uniformDistribution', 'measureUnitTaskLine': unit,
                        'qtyTaskLine': qty, 'priceTaskLine': price, 'priceSourceTaskLine': 'manual', 'vatRatioTaskLine': 0,
                        'sumForContract': s, 'sumVATForContract': 0, 'sumForAccounting': s, 'sumVATForAccounting': 0, 'sumForBudget': s, 'sumVATForBudget': 0,
                        'budgetItemTaskLine': item, 'taskIsPosted': False, 'description': text}}


def add_task_lines(doc: dict) -> dict:
    """Time lines (hours x rate) for every operation of a person, Material lines for the ingredients (on the weighing) and the packaging (on the last operation)
    of every batch. The stages, the passive steps and the month-long rows of the workforce have no lines (no double counting)."""
    tasks = doc['tasks']
    by_path = {t['treePath']: t for t in tasks}
    cake_of = {}
    for code, r in RECIPES.items():
        for t in tasks:
            if t['treePath'].count('.') == 1 and t['rowJSON']['taskDescription'].startswith(r['title'] + ' · '):
                cake_of[t['treePath'].split('.')[-1]] = code
    lines: List[dict] = []
    for t in tasks:
        js, cols = t['rowJSON'], t['rowJSON'].get('customColumns') or {}
        depth = t['treePath'].count('.')
        if js['rowKind'] == 'stage' or depth != 3 or cols.get('cc_role') not in RATES:
            continue
        key, n = t['rowGUID'], 0
        mins = cols['cc_min']
        who, role = cols['cc_worker'], cols['cc_role']
        n += 1
        lines.append(make_line(t['rowGUID'], key, n, 'timeGenus', 'unit_hour', round(mins / 60, 4), RATES[role], ITEM_WAGES, f'{role} · {who} · {cols["cc_from"]}-{cols["cc_to"]}'))
        cake = cake_of.get(t['treePath'].split('.')[1])
        if cake is None:
            continue                                      # an order line or a goods receipt of the purchasing stage
        ops = ROUTING[cake]
        title = js['taskDescription']
        if title.startswith(ops[0].name + ' · '):          # the weighing of the batch: all ingredients of the batch
            for code, q in RECIPES[cake]['ing'].items():
                nm, unit, price, sup = ING[code][0], ING[code][1], ING[code][2], ING[code][3]
                n += 1
                lines.append(make_line(t['rowGUID'], key, n, 'materialGenus', UNIT_OF[unit], round(q * BATCH_CAKES, 4), price, ITEM_RAW, f'{nm} · {SUPPLIERS[sup]}'))
        if title.startswith(ops[-1].name + ' · '):         # the packing of the batch: the packaging of every cake
            for code in PACKAGING:
                nm, unit, price, sup = ING[code][0], ING[code][1], ING[code][2], ING[code][3]
                n += 1
                lines.append(make_line(t['rowGUID'], key, n, 'materialGenus', UNIT_OF[unit], float(BATCH_CAKES), price, ITEM_PACK, f'{nm} · {SUPPLIERS[sup]}'))
    doc['taskLines'] = lines
    doc['project']['rowJSON'].update(PROJECT_SETTINGS)
    return doc


# =====================================================================================================================
# 8. THE MAIN PROGRAM
# =====================================================================================================================
def find_crew(batches: List[Batch], t_search: float, t_final: float, threads: int, log: bool) -> dict:
    wm = worker_minutes(batches)
    days = sum(len(w) for w in production_weeks())
    per_worker = days * 5 / 6 * SHIFT_NET_MIN
    lb = math.ceil(wm / per_worker)
    print(f'worker time {wm} min = {wm / 60:.0f} h; {days} plant days; one worker gives at most {per_worker:.0f} min -> lower bound {lb} workers')
    tried = []
    for total in range(lb, lb + 12):
        for nE, nL in [(total, 0), (math.ceil(total / 2), total // 2), (math.ceil(total * 2 / 3), total // 3)]:
            if (nE, nL) in tried or nL < 0:
                continue
            tried.append((nE, nL))
            t0 = time.time()
            r = solve(batches, nE, nL, t_search, False, threads=threads, log=log)
            ok = r is not None and 'start' in r
            print(f'  try {total:2d} workers = Early {nE} + Late {nL}: {"FEASIBLE" if ok else r["status"]}  ({time.time() - t0:.0f} s)')
            if ok:
                print(f'-> {total} workers; improving the plan for {t_final:.0f} s ...')
                hint = {k: v for k, v in r['start'].items()}
                best = solve(batches, nE, nL, t_final, True, hint=hint, threads=threads, log=log)
                return best if best and 'start' in best else r
    raise SystemExit('no feasible crew found - raise --max-time-search')


def main():
    ap = argparse.ArgumentParser(description='CAKE1 plan: OR-Tools CP-SAT + WBS json for appPM80')
    ap.add_argument('--out', default=str(OUT_JSON), help='the json file to write')
    ap.add_argument('--max-time-search', type=float, default=90, help='seconds for every crew size that is tried')
    ap.add_argument('--max-time-final', type=float, default=240, help='seconds for the final improvement run')
    ap.add_argument('--quick', action='store_true', help='short runs (about 1 minute): good enough to look at the file')
    ap.add_argument('--threads', type=int, default=0, help='CP-SAT workers (default: cpu - 2)')
    ap.add_argument('--log', action='store_true', help='the CP-SAT log')
    ap.add_argument('--lines-only', action='store_true', help='no search: add / replace the task lines + the project settings of the money in the existing json (--out)')
    a = ap.parse_args()
    if a.quick:
        a.max_time_search, a.max_time_final = 25, 30
    if a.lines_only:
        out = Path(a.out)
        doc = add_task_lines(json.loads(out.read_text(encoding='utf-8')))
        out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'{len(doc["taskLines"])} task lines written into {out} ({sum(l["rowJSON"]["sumForBudget"] for l in doc["taskLines"]):,.2f} EUR)')
        return
    t0 = time.time()
    batches = make_batches()
    print(f'{len(batches)} batches of {BATCH_CAKES} cakes = {len(batches) * BATCH_CAKES} cakes of 5 kg = {len(batches) * BATCH_CAKES * CAKE_KG:.0f} kg')
    sol = find_crew(batches, a.max_time_search, a.max_time_final, a.threads, a.log)
    print(f'solution: {sol["status"]}, objective {sol["objective"]}, bound {sol["bound"]}, crews Early {sol["nE"]} Late {sol["nL"]}, off-days {sol["off"]}')
    tasks, workers = assign(batches, sol)
    pos, lots = build_purchase(tasks)
    stats = verify(batches, tasks, workers, sol, pos, lots)
    print('verification: ALL CHECKS OK  machine peak', stats['machine_peak'])

    wm = worker_minutes(batches)
    total_eur = sum(l.qty * ING[l.ing][2] for l in lots)
    finish = max(t.end for t in tasks)
    summary = {
        'workers': sol['nE'] + sol['nL'], 'early': sol['nE'], 'late': sol['nL'], 'worker_minutes': wm,
        'tasks': len(tasks), 'purchase_orders': len(pos), 'order_lines': len(lots), 'purchase_eur': round(total_eur, 2), 'last_end': finish.isoformat(),
    }
    summary['project_notes'] = (
        f'CAKE1: 8 eco cakes × 200 × 5 kg (1 600 cakes, 8 t) in January 2026. {summary["workers"]} confectioners found by OR-Tools CP-SAT '
        f'(Early {sol["nE"]} + Late {sol["nL"]}), {len(pos)} purchase orders ({total_eur:,.0f} EUR), orders 2+ days before delivery, last cake packed {finish:%a %d %b %H:%M}. '
        'Documentation: documentation/CAKE1/INIT_STAGE.html. Times are the local plant time (hours and minutes are in the columns Hour S / Min S / Hour F / Min F and in From / To).')
    doc = add_task_lines(build_wbs(batches, tasks, workers, sol, pos, lots, stats, summary))
    out = Path(a.out)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    summary.update(rows=len(doc['tasks']), dependencies=len(doc['dependencies']), crew_minutes={n: w['minutes'] for n, w in workers.items()},
                   seconds=round(time.time() - t0))
    print(json.dumps({k: v for k, v in summary.items() if k != 'project_notes'}, indent=1, ensure_ascii=False))
    print(f'written {out}  ({out.stat().st_size / 1e6:.2f} MB, {len(doc["tasks"])} rows, {len(doc["dependencies"])} links, {len(doc["taskLines"])} task lines)')


if __name__ == '__main__':
    main()
