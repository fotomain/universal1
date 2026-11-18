#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CAKE1 / RUN1 - manufacturing plan of the "ecology supercakes": production 2026-01-01 .. 2026-01-02 (2 days), purchasing before it
(documentation/CAKE1/INIT_STAGE.html;  the first run, 200 cakes a position in January, is archived in cake_v0_month200_optimization.py)

What it does (one run, a few minutes):
  1. data      8 eco cakes (list of the shared chat), 5 kg size (x5 of the home cake), 20 cakes per cake position, made in
               batches of 10 cakes; every cake has a routing of <= 10 WORKER operations + passive steps (bake, cool, chill).
  2. OR-Tools  CP-SAT model of the 2 production days at 5-minute resolution: finds the SMALLEST number of workers (and the split
               Early / Late shift) that makes all 160 cakes, with  - shift windows without the breaks (rest 15 min, lunch 30 min,
               rest 15 min every 4 h), - at most 5 shifts a week per worker (the weekly day off), 16 h between two shifts,
               - capacity of mixers / kettles / benches / pack lines / ovens / cooling racks / chiller, - the last cake packed on 2 Jan 22:00.
  3. workers   names the people (fake), gives every operation a worker and every machine step a machine unit.
  4. purchase  lots of ingredients with the cover days and the shelf life; ORDER = DELIVERY - 2 days (or more); goods receipt.
  5. costs     total_costs.csv = the workers needed + the materials needed (and ordered) + the money per cake. THE WBS IS BUILT FROM THIS CSV.
  6. WBS       cake2_plan_json.json = ready for  Project settings -> Import / Export -> Import  (format kit8.pm.project, version 1:
               tasks + dependencies + the project settings + the TASK LINES (Time and Material lines = what Post takes)).
  7. checks    an independent verification of every rule; the script stops with an error when one fails.

Install (global for the Mac, nothing is installed in this folder):   python3 -m pip install --upgrade ortools
Run:                                                                python3 cake_v1_optimization.py
Quick try (may use more workers):                                    python3 cake_v1_optimization.py --quick
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
PROJECT_GUID = 'c79ba49f-5795-470f-899d-ed412eeb7cb5'      # the appPM80 project the file is made for
OWNER_PLACEHOLDER = '00000000-0000-4000-8000-000000000000'  # the import writes the real owner
OUT_JSON = HERE / 'cake2_plan_json.json'
OUT_CSV = HERE / 'total_costs.csv'
NS = uuid.UUID('6f1e0c3a-5b7d-4c21-9a43-0d1c2b3a4e5f')    # namespace of the deterministic row ids (same name -> same GUID)

# =====================================================================================================================
# 1. CALENDAR AND TIME GRID  (the grid starts on Mon 29 Dec 2025 = the purchasing; the production is Thu 1 Jan + Fri 2 Jan 2026)
# =====================================================================================================================
DAY0 = dt.date(2025, 12, 29)    # Monday: the buyer places the orders (2 days before the delivery)
NDAYS = 5                       # 29 Dec .. 2 Jan
SLOT = 5                        # minutes in one grid step
SPD = 24 * 60 // SLOT           # slots per day (288)
DT0 = dt.datetime(2025, 12, 29)
PROD_FIRST = dt.date(2026, 1, 1)       # the production timeline of the task: from 2026-01-01, 2 days
PROD_LAST = dt.date(2026, 1, 2)
HOLIDAYS: set = set()                  # the owner wants the plant to work on 1 January
FIRST_DELIVERY = dt.date(2025, 12, 31)  # the goods are received the day before the first batch (orders of 29 Dec + 2 days)
LAST_PROD = PROD_LAST
FIRST_DAY_RELEASE_MIN = 6 * 60         # the first batch may start at 06:00 on 1 Jan (the goods were received on 31 Dec)
LEAD_DAYS = 2                          # purchase order delay (calendar days, order -> delivery)

BATCH_CAKES = 10                # cakes per batch (10 x 5 kg = 50 kg)
CAKES_PER_POSITION = 20
BATCHES_PER_POSITION = CAKES_PER_POSITION // BATCH_CAKES   # 2
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
BUYER_DAYS = lambda d: d.weekday() < 5                   # Mon-Fri
PLANT_DAY = lambda d: d.weekday() != 6 and d not in HOLIDAYS   # Mon-Sat except holidays

WEEKS_BATCHES = [2]             # batches of every cake per production week (one week of 2 plant days)
DAY_OFF_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


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
    """Plant days of the production weeks (day indexes): here ONE week = Thu 1 Jan + Fri 2 Jan 2026."""
    spans = [(PROD_FIRST, PROD_LAST)]
    weeks = []
    for a, b in spans:
        days = [day_idx(a + dt.timedelta(days=i)) for i in range((b - a).days + 1) if PLANT_DAY(a + dt.timedelta(days=i))]
        weeks.append(days)
    return weeks


# a worker whose weekly day off is the Sunday (plant closed) is present on every plant day - allowed when no week has more than 5 plant days
SUNDAY_OFF = all(len(w) <= 5 for w in production_weeks())


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
    no: int          # 1..2 inside the cake
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
        off[c] = [m.NewIntVar(0, math.ceil(n / 6), f'off_{c}{w}') for w in range(6)] + [m.NewIntVar(0, n if SUNDAY_OFF else 0, f'off_{c}6')]
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
        po = PO(f'PO-{o.year}-{i:03d}', sup, o, d, sorted(ls, key=lambda l: l.ing))
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
# 6b. total_costs.csv - THE WORKERS AND THE MATERIALS THE PLAN NEEDS, AND WHAT THEY COST (the WBS is built from this file)
# =====================================================================================================================
RATES = {'Confectioner': 21.00, 'Purchasing manager': 28.00, 'Warehouse keeper': 18.00}      # EUR per hour, fully loaded (illustrative)
CSV_COLS = ['section', 'item', 'detail', 'supplier', 'qty_needed', 'qty_ordered', 'unit', 'unit_price_eur', 'cost_needed_eur', 'cost_ordered_eur', 'po', 'order_date', 'delivery_date', 'note']


def write_total_costs(path: Path, batches, tasks, workers, sol, pos, lots) -> None:
    """sections: summary (what is needed: workers, hours, orders), labour (a row per person), material / packaging (a row per order line:
    needed = the recipes, ordered = + 2 % waste + pack size), cake (the money per cake position), total (labour + material + packaging)."""
    import csv
    rows: List[dict] = []

    def add(section, item, detail='', supplier='', qn=None, qo=None, unit='', price=None, cn=None, co=None, po='', od='', dd='', note=''):
        rows.append({'section': section, 'item': item, 'detail': detail, 'supplier': supplier, 'qty_needed': '' if qn is None else qn, 'qty_ordered': '' if qo is None else qo,
                     'unit': unit, 'unit_price_eur': '' if price is None else price, 'cost_needed_eur': '' if cn is None else cn, 'cost_ordered_eur': '' if co is None else co,
                     'po': po, 'order_date': od, 'delivery_date': dd, 'note': note})
    # --- labour
    lab_total = 0.0
    wmin = collections.Counter()
    for t in tasks:
        if t.op.kind == 'W':
            wmin[t.batch.cake] += t.op.dmin
    people = []
    for nm, wk in sorted(workers.items(), key=lambda kv: (kv[1]['crew'], kv[0])):
        people.append((nm, 'Confectioner', SHIFT_NAME[wk['crew']], wk['minutes'], f'{len(wk["days"])} shifts, {wk["ops"]} operations'))
    people.append((BUYER, 'Purchasing manager', 'Mon-Fri 09:00-17:00', 10 * len(lots), f'{len(lots)} order lines x 10 min'))
    for k in KEEPERS:
        mins = sum(int((po.receipt_end - po.receipt_start).total_seconds() // 60) for po in pos if po.keeper == k)
        people.append((k, 'Warehouse keeper', 'from 06:00', mins, f'{sum(1 for po in pos if po.keeper == k)} goods receipts'))
    for nm, role, shift, mins, note in people:
        hours = round(mins / 60, 4)
        cost = round(hours * RATES[role], 2)
        lab_total += cost
        add('labour', nm, f'{role} · {shift}', '', hours, None, 'h', RATES[role], cost, cost, note=note)
    # --- materials: one row per order line
    mat_need = mat_ord = 0.0
    for po in pos:
        for l in po.lots:
            nm, unit, price, sup = ING[l.ing][0], ING[l.ing][1], ING[l.ing][2], ING[l.ing][3]
            cn, co = round(l.qty_need * price, 2), round(l.qty * price, 2)
            mat_need += cn
            mat_ord += co
            add('packaging' if l.ing in PACKAGING else 'material', nm, l.ing, SUPPLIERS[sup], round(l.qty_need, 4), l.qty, unit, price, cn, co, po.no,
                l.order.isoformat(), l.delivery.isoformat(), f'{ING[l.ing][7]}; pack {fmt_q(ING[l.ing][4])} {unit}; +2 % waste; covers the use {l.first_use} - {l.last_use}')
    # --- per cake position
    for c in CAKE_ORDER:
        r = RECIPES[c]
        ing = sum(q * ING[k][2] for k, q in r['ing'].items())
        pack = sum(ING[k][2] for k in PACKAGING)
        lab = wmin[c] / 60 * RATES['Confectioner'] / CAKES_PER_POSITION
        add('cake', r['title'], f'{CAKES_PER_POSITION} cakes x 5 kg in {BATCHES_PER_POSITION} batches', '', CAKES_PER_POSITION, None, 'cakes', round(ing + pack + lab, 2),
            round((ing + pack + lab) * CAKES_PER_POSITION, 2), None, note=f'per cake: ingredients {ing:.2f} + packaging {pack:.2f} + confectioner time {lab:.2f} EUR (purchasing and goods receipt are not shared out)')
    # --- summary + total
    hours_conf = sum(wk['minutes'] for wk in workers.values()) / 60
    add('summary', 'confectioners needed', f'Early {sol["nE"]} + Late {sol["nL"]}', '', sol['nE'] + sol['nL'], None, 'persons')
    add('summary', 'confectioner hours', '', '', round(hours_conf, 4), None, 'h')
    add('summary', 'cakes', f'{len(CAKE_ORDER)} positions x {CAKES_PER_POSITION}', '', len(CAKE_ORDER) * CAKES_PER_POSITION, None, 'cakes')
    add('summary', 'weight', '', '', len(CAKE_ORDER) * CAKES_PER_POSITION * CAKE_KG, None, 'kg')
    add('summary', 'purchase orders', '', '', len(pos), None, 'pcs')
    add('summary', 'order lines', '', '', len(lots), None, 'pcs')
    add('total', 'labour', '', '', None, None, '', None, round(lab_total, 2), round(lab_total, 2))
    add('total', 'materials + packaging', '', '', None, None, '', None, round(mat_need, 2), round(mat_ord, 2))
    add('total', 'TOTAL', '', '', None, None, '', None, round(lab_total + mat_need, 2), round(lab_total + mat_ord, 2), note='needed = what the task lines cost (Post); ordered = what the purchase orders cost (+ waste, pack size)')
    with open(path, 'w', encoding='utf-8', newline='') as f:
        wr = csv.DictWriter(f, fieldnames=CSV_COLS)
        wr.writeheader()
        wr.writerows(rows)
    patch_total_costs_revenue(path)


def patch_total_costs_revenue(path: Path) -> None:
    """Adds / replaces the REVENUE side of total_costs.csv: the deliverables (the cakes sold at the wholesale price of the product), the margin and ROI1 (plan - plan).
    For these rows the money columns are REVENUE (cost_needed_eur = cost_ordered_eur = qty x price)."""
    import csv
    with open(path, encoding='utf-8', newline='') as f:
        rows = [r for r in csv.DictReader(f) if r['section'] != 'revenue' and not (r['section'] == 'total' and r['item'] in ('revenue (deliverables)', 'margin = revenue - TOTAL needed', 'ROI1 plan-plan (%)'))]
    total = next(float(r['cost_needed_eur']) for r in rows if r['section'] == 'total' and r['item'] == 'TOTAL')
    blank = {c: '' for c in CSV_COLS}
    rev = 0.0
    new = []
    for c, v in cake_costs().items():
        amount = round(v['wholesale'] * CAKES_PER_POSITION, 2)
        rev += amount
        new.append({**blank, 'section': 'revenue', 'item': RECIPES[c]['title'].split(' (')[0] + ' 5 kg', 'detail': 'CK2-CAKE-' + c.upper(), 'supplier': CUSTOMER[1], 'qty_needed': CAKES_PER_POSITION, 'unit': 'cakes',
                     'unit_price_eur': v['wholesale'], 'cost_needed_eur': amount, 'cost_ordered_eur': amount,
                     'note': f'wholesale {v["wholesale"]:.0f} EUR = cost {v["cost"]:.2f} (ingredients {v["ing"]:.2f} + packaging {v["pack"]:.2f} + confectioner time {v["lab"]:.2f}) + {MARKUP * 100:.0f} %; retail {v["retail"]:.0f} EUR'})
    rev = round(rev, 2)
    new += [{**blank, 'section': 'total', 'item': 'revenue (deliverables)', 'cost_needed_eur': rev, 'cost_ordered_eur': rev},
            {**blank, 'section': 'total', 'item': 'margin = revenue - TOTAL needed', 'cost_needed_eur': round(rev - total, 2), 'note': 'revenue minus the cost of the task lines (labour + materials needed)'},
            {**blank, 'section': 'total', 'item': 'ROI1 plan-plan (%)', 'unit': '%', 'cost_needed_eur': round((rev - total) / total * 100, 2), 'note': '(R - C) / C'}]
    with open(path, 'w', encoding='utf-8', newline='') as f:
        wr = csv.DictWriter(f, fieldnames=CSV_COLS)
        wr.writeheader()
        wr.writerows(rows + new)


def load_total_costs(path: Path) -> dict:
    """Reads total_costs.csv back: the WBS takes the hours, the quantities and the money from it."""
    import csv
    out = {'labour': {}, 'ordered': {}, 'needed_total': 0.0, 'ordered_total': 0.0, 'revenue': 0.0, 'summary': {}}
    with open(path, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            sec = r['section']
            num = lambda k: float(r[k]) if r[k] != '' else 0.0
            if sec == 'labour':
                out['labour'][r['item']] = {'hours': num('qty_needed'), 'eur': num('cost_needed_eur')}
            elif sec in ('material', 'packaging'):
                out['ordered'][r['po'], r['detail']] = {'qty': num('qty_ordered'), 'eur': num('cost_ordered_eur'), 'need': num('qty_needed')}
            elif sec == 'summary':
                out['summary'][r['item']] = num('qty_needed')
            elif sec == 'total' and r['item'] == 'TOTAL':
                out['needed_total'], out['ordered_total'] = num('cost_needed_eur'), num('cost_ordered_eur')
            elif sec == 'total' and r['item'] == 'revenue (deliverables)':
                out['revenue'] = num('cost_needed_eur')
    return out


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


def build_wbs(batches, tasks, workers, sol, pos, lots, stats, summary, costs) -> dict:
    w = Wbs()
    nE, nL = sol['nE'], sol['nL']
    # ---------------------------------------------------------------- 1. workforce
    w.add('S_staff', None, 'stage', 'WORKFORCE & ROSTER', notes=(
        f'{nE + nL} confectioners (found by OR-Tools CP-SAT: Early crew {nE}, Late crew {nL}) + 1 purchasing manager + 2 warehouse keepers. '
        f'Shifts: {SHIFT_NAME["E"]} (breaks {", ".join(SHIFT_BREAKS["E"])}) and {SHIFT_NAME["L"]} (breaks {", ".join(SHIFT_BREAKS["L"])}). '
        f'Rest rules: at most 5 shifts a week and one day off a week for everybody (the plant is closed on Sunday), 16 h between two shifts, 45 min of breaks in every shift. The plant works on {day_label(PROD_FIRST)} and {day_label(PROD_LAST)}. Names are fictional. Hours and money: total_costs.csv.'))
    p_first = dt.datetime.combine(PROD_FIRST, dt.time(6, 0))
    p_last = {'E': dt.datetime.combine(PROD_LAST, dt.time(14, 0)), 'L': dt.datetime.combine(PROD_LAST, dt.time(22, 0))}
    for nm, wk in sorted(workers.items(), key=lambda kv: (kv[1]['crew'], kv[0])):
        days = len(wk['days'])
        lab = costs['labour'][nm]                       # hours and money come from total_costs.csv
        w.add(f'staff_{nm}', 'S_staff', 'task', f'{nm} · Confectioner · {SHIFT_NAME[wk["crew"]]} · day off {DAY_OFF_NAMES[wk["off"]]}',
              start=p_first if wk['crew'] == 'E' else dt.datetime.combine(PROD_FIRST, dt.time(14, 0)), end=p_last[wk['crew']],
              notes=f'{days} shifts, {wk["ops"]} operations, {lab["hours"]:.2f} h of work = {lab["eur"]:,.2f} EUR (total_costs.csv). '
                    f'Breaks: {", ".join(SHIFT_BREAKS[wk["crew"]])}.',
              cc={'cc_worker': nm, 'cc_role': 'Confectioner', 'cc_min': wk['minutes']}, color=COL_PEOPLE)
    b_first = min(po.order_start for po in pos)
    b_last = max(po.order_start + dt.timedelta(minutes=10 * len(po.lots)) for po in pos)
    w.add('staff_buyer', 'S_staff', 'task', f'{BUYER} · Purchasing manager · Mon-Fri 09:00-17:00', start=b_first, end=max(b_last, b_first.replace(hour=17, minute=0)),
          notes=f'{costs["labour"][BUYER]["hours"]:.2f} h of orders = {costs["labour"][BUYER]["eur"]:,.2f} EUR (total_costs.csv).',
          cc={'cc_worker': BUYER, 'cc_role': 'Purchasing manager'}, color=COL_PEOPLE)
    d_first = min(po.receipt_start for po in pos).replace(hour=6, minute=0)
    for k in KEEPERS:
        w.add(f'staff_{k}', 'S_staff', 'task', f'{k} · Warehouse keeper · from 06:00 · day off {DAY_OFF_NAMES[KEEPER_OFF[k]]}', start=d_first, end=d_first.replace(hour=14, minute=0),
              notes=f'{costs["labour"][k]["hours"]:.2f} h of goods receipt = {costs["labour"][k]["eur"]:,.2f} EUR (total_costs.csv).',
              cc={'cc_worker': k, 'cc_role': 'Warehouse keeper'}, color=COL_PEOPLE)
    # ---------------------------------------------------------------- 2. purchasing
    total_eur = sum(c['eur'] for c in costs['ordered'].values())
    w.add('S_buy', None, 'stage', 'PURCHASING & GOODS RECEIPT (order 2 days before delivery)', notes=(
        f'{len(pos)} purchase orders, {len(lots)} order lines, {total_eur:,.0f} EUR of organic ingredients and compostable packaging. '
        f'Every order is placed at least 2 calendar days before the delivery (lead time of the suppliers); the orders go out on {day_label(min(p.order for p in pos))}, '
        f'the first delivery is {day_label(min(p.delivery for p in pos))}, the production starts on {day_label(PROD_FIRST)}. Goods receipt: two warehouse keepers from 06:00. Quantities (total_costs.csv) include 2 % waste and are rounded up to the pack size.'))
    for po in pos:
        k = f'po_{po.no}'
        w.add(k, 'S_buy', 'stage', f'{po.no} · {SUPPLIERS[po.supplier]} · order {day_label(po.order)} -> delivery {day_label(po.delivery)}',
              notes=f'{len(po.lots)} lines, {sum(costs["ordered"][po.no, l.ing]["eur"] for l in po.lots):,.0f} EUR. Delivery is {(po.delivery - po.order).days} calendar days after the order.')
        t = po.order_start
        for l in po.lots:
            nm, unit, price, sup, pack, shelf, cover, origin = ING[l.ing]
            oq = costs['ordered'][po.no, l.ing]
            w.add(f'{k}_{l.ing}', k, 'task', f'Order {fmt_q(oq["qty"])} {unit} {nm}', start=t, end=t + dt.timedelta(minutes=10),
                  notes=f'{origin}. Covers the use {day_label(l.first_use)} - {day_label(l.last_use)} (need {fmt_q(l.qty_need)} {unit}, +2 % waste, pack {fmt_q(pack)} {unit}). Shelf life {shelf} days.',
                  cc={'cc_worker': BUYER, 'cc_role': 'Purchasing manager', 'cc_from': hhmm(t), 'cc_to': hhmm(t + dt.timedelta(minutes=10)), 'cc_min': 10, 'cc_qty': oq['qty'], 'cc_unit': unit,
                      'cc_eur': oq['eur'], 'cc_supplier': SUPPLIERS[sup], 'cc_order': l.order.isoformat(), 'cc_deliv': l.delivery.isoformat(), 'cc_po': po.no},
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
                    f'(x5 of the home cake, reference {r["price"]} EUR per small cake). All ingredients organic (EU 2018/848), tropical ones Fairtrade, no palm oil, no eggs / dairy, compostable packaging (EN 13432). '
                    f'Deliverable: {BATCH_CAKES} cakes of every batch go to {CUSTOMER[1]} at the wholesale price {cake_costs()[cake]["wholesale"]:.0f} EUR (cost {cake_costs()[cake]["cost"]:.2f} + {MARKUP * 100:.0f} %).',
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
        'rowKind': 'project', 'name': 'CAKE2 · Eco supercakes · 1-2 January 2026', 'durationDays': 0,
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
# 7a. THE CATALOGS the lines book (real persons, material products, deliverable products, suppliers, the customer)
#     They are rows of the shared catalogs of the database (personTable, productTable, partnerTable, resourceRoleTable, contractTable ...), made by the
#     generated SQL  CAKE2_CATALOG_DATA.sql  (idempotent, "paste and run" like BUDGET1_WBS_DATA.sql); the json only REFERENCES them by id.
# =====================================================================================================================
OUT_CATALOG_SQL = HERE / 'CAKE2_CATALOG_DATA.sql'
ROLE_OF = {'Confectioner': 'ck2-role-confectioner', 'Purchasing manager': 'ck2-role-buyer', 'Warehouse keeper': 'ck2-role-keeper'}
ROLE_TITLE = {'Confectioner': 'Confectioner', 'Purchasing manager': 'Purchasing manager (eco bakery)', 'Warehouse keeper': 'Warehouse keeper (eco bakery)'}
DEPARTMENT = {'Confectioner': 'Production', 'Purchasing manager': 'Purchasing', 'Warehouse keeper': 'Warehouse'}
CONTRACT_PERIOD_HOURS = 168          # a Month = 8 h x 21 days: the app divides the contract sum by it (taskLineContractCost.ts)
REVENUE_ROLE = 'ck2-role-cake-sales'
CUSTOMER = ('ck2-ptn-greentable', 'Green Table Catering Co-op', 'Green Table Catering Co-operative eG')
CUSTOMER_CONTRACT = 'ck2-ct-greentable-2026'
MARKUP = 0.30                         # wholesale price = cost of a cake (ingredients + packaging + confectioner time) + 30 %
RETAIL_SHARE = 0.70                   # wholesale = 70 % of the retail price (the retailer keeps 30 %)
MAT_CATEGORY = {                      # ingredient code -> (role id, role title)
    'spelt': 'flour', 'oats': 'flour', 'sugar': 'sweet', 'dates': 'sweet', 'cocoa': 'cocoa', 'darkchoc': 'cocoa', 'vanilla': 'cocoa', 'coconutcr': 'cocoa', 'coconutoil': 'cocoa',
    'cashews': 'nuts', 'walnuts': 'nuts', 'almonds': 'nuts', 'bananas': 'fresh', 'lemons': 'fresh', 'carrots': 'fresh', 'apples': 'fresh', 'beetroot': 'fresh', 'applepur': 'fresh',
    'oatdrink': 'liquid', 'sunoil': 'liquid', 'oliveoil': 'liquid', 'acv': 'liquid', 'baking': 'aids', 'salt': 'aids', 'agar': 'aids', 'cinnamon': 'aids', 'coffee': 'aids',
    'box': 'pack', 'board': 'pack', 'label': 'pack'}
MAT_ROLE_TITLE = {'flour': 'Flour and grains', 'sweet': 'Sugar and sweeteners', 'cocoa': 'Cocoa, chocolate and coconut', 'nuts': 'Nuts', 'fresh': 'Fresh fruit and vegetables',
                  'liquid': 'Plant drinks, oils and vinegar', 'aids': 'Baking aids, spices and coffee', 'pack': 'Compostable packaging'}


def person_guid(name: str) -> str:
    return str(uuid.uuid5(NS, 'person:' + name))


def slug(text: str) -> str:
    return ''.join(ch.lower() if ch.isalnum() else '-' for ch in text).strip('-').replace('--', '-')


def contract_of_person(name: str) -> str:
    return 'ck2-ct-' + slug(name)


def material_product(code: str) -> str:
    return 'ck2-prd-' + code


def material_role(code: str) -> str:
    return 'ck2-role-mat-' + MAT_CATEGORY[code]


def supplier_partner(sup: str) -> str:
    return 'ck2-ptn-' + sup.lower()


def supplier_contract(sup: str) -> str:
    return 'ck2-ct-sup-' + sup.lower()


def cake_product(cake: str) -> str:
    return 'ck2-prd-cake-' + cake


def cake_costs() -> Dict[str, dict]:
    """cost of ONE 5 kg cake and its prices: wholesale = cost + 30 % (whole EUR), retail = wholesale / 0.7 (whole EUR). Cost = ingredients + packaging + confectioner time of the batch / 10."""
    out = {}
    for c in CAKE_ORDER:
        r = RECIPES[c]
        ing = sum(q * ING[k][2] for k, q in r['ing'].items())
        pack = sum(ING[k][2] for k in PACKAGING)
        lab = sum(o.dmin for o in ROUTING[c] if o.kind == 'W') / 60 * RATES['Confectioner'] / BATCH_CAKES
        cost = ing + pack + lab
        wholesale = float(round(cost * (1 + MARKUP)))
        out[c] = {'ing': ing, 'pack': pack, 'lab': lab, 'cost': cost, 'wholesale': wholesale, 'retail': float(round(wholesale / RETAIL_SHARE))}
    return out


def people_of(doc: dict) -> List[dict]:
    """the persons of the WBS (rows of the workforce stage + the buyer + the keepers), in a stable order"""
    seen: Dict[str, dict] = {}
    for t in doc['tasks']:
        cols = t['rowJSON'].get('customColumns') or {}
        if cols.get('cc_role') in ROLE_OF and cols.get('cc_worker') and cols['cc_worker'] not in seen:
            seen[cols['cc_worker']] = {'name': cols['cc_worker'], 'role': cols['cc_role']}
    order = {'Confectioner': 0, 'Purchasing manager': 1, 'Warehouse keeper': 2}
    return sorted(seen.values(), key=lambda p: (order[p['role']], p['name']))


def _sql_str(x) -> str:
    return "'" + json.dumps(x, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def write_catalog_sql(doc: dict, path: Path) -> None:
    """CAKE2_CATALOG_DATA.sql: the catalog rows the task lines refer to. Idempotent (upsert by rowGUID). Needs start1 + start2 + start4 (units, price types, budget items, person types)."""
    rows: List[Tuple[str, str, str, str, float, dict]] = []     # table, guid, owner, parent, order, json

    def add(table, guid, owner, parent, order, js):
        rows.append((table, guid, owner, parent, order, js))
    people = people_of(doc)
    # --- folders and types
    add('resourceRoleFolderTable', 'ck2-fld-role-bakery', 'resourceRoleFolderCatalog', 'empty', 91000, {'title': 'Eco bakery'})
    add('resourceRoleFolderTable', 'ck2-fld-role-materials', 'resourceRoleFolderCatalog', 'empty', 92000, {'title': 'Eco bakery materials'})
    add('resourceRoleTypeTable', 'ck2-roletype-staff', 'resourceRoleTypeCatalog', 'empty', 91000,
        {'title': 'Eco bakery staff', 'baseUnit': 'unit_hour', 'isActive': True, 'variantSet': None, 'description': 'Confectioners, purchasing and warehouse staff of the eco bakery (CAKE2 demo)',
         'propertySet': None, 'variantMode': 'none', 'uniqueVariants': True, 'managementGenus': 'timeGenus', 'roleVATDefaultRate': 'vat_0', 'variantTitleTemplate': None})
    add('resourceRoleTypeTable', 'ck2-roletype-materials', 'resourceRoleTypeCatalog', 'empty', 92000,
        {'title': 'Eco bakery materials', 'baseUnit': 'unit_kg', 'isActive': True, 'variantSet': None, 'description': 'Organic ingredients and compostable packaging (CAKE2 demo)',
         'propertySet': None, 'variantMode': 'none', 'uniqueVariants': True, 'managementGenus': 'materialGenus', 'roleVATDefaultRate': 'vat_0', 'variantTitleTemplate': None})
    # --- roles + their cost rates (rolePriceTable: the hourly cost rate of the role = the rate of the contract)
    for i, (role, rid) in enumerate(ROLE_OF.items(), 1):
        add('resourceRoleTable', rid, 'ck2-roletype-staff', 'ck2-fld-role-bakery', 91000 + i * 1000, {'title': ROLE_TITLE[role], 'isActive': True, 'description': f'{ROLE_TITLE[role]}: the hour is costed {RATES[role]:.2f} EUR (CAKE2 demo)', 'roleVATRate': 'vat_0'})
        add('rolePriceTable', f'ck2-rp-{rid[9:]}', rid, 'empty', 91000 + i, {'price': RATES[role], 'validFrom': '2025-01-01', 'measureUnit': 'unit_hour', 'priceTypeGUID': 'pt_cost'})
    for i, (cat, title) in enumerate(MAT_ROLE_TITLE.items(), 1):
        add('resourceRoleTable', 'ck2-role-mat-' + cat, 'ck2-roletype-materials', 'ck2-fld-role-materials', 92000 + i * 1000,
            {'title': title, 'isActive': True, 'description': f'{title} of the eco bakery (CAKE2 demo)', 'roleVATRate': 'vat_0'})
    add('resourceRoleTable', REVENUE_ROLE, 'revenueResources', 'fld_res_rev', 93000,
        {'title': 'Eco cake sales (5 kg cakes)', 'isActive': True, 'description': 'What the customer is invoiced for the packed 5 kg eco cakes: 1 pcs = 1 cake.', 'roleVATRate': 'vat_0'})
    # --- persons + their employment contracts (the hour = the sum of a month / 168 h)
    for i, pe in enumerate(people, 1):
        nm, role = pe['name'], pe['role']
        first, last = nm.split(' ', 1)
        add('personTable', person_guid(nm), 'personCatalog', 'empty', 91000 + i * 1000,
            {'isActive': True, 'personType': 'personTypeEmployee', 'personEmail': f'{slug(first)}.{slug(last)}@ecocakes.example', 'personPhone': f'+49 555 01{i:02d}', 'personTitle': nm,
             'employeeData': {'position': ROLE_TITLE[role], 'department': DEPARTMENT[role], 'employeeNumber': f'EC-{i:03d}'}, 'personLastName': last, 'personFirstName': first, 'personIsEmployee': True})
        total = round(RATES[role] * CONTRACT_PERIOD_HOURS, 2)
        add('contractTable', contract_of_person(nm), person_guid(nm), 'person', -91000 - i,
            {'notes': f'{RATES[role]:.2f} EUR per working hour = {total:,.2f} EUR per month of {CONTRACT_PERIOD_HOURS} h', 'contractVAT': 0, 'contractType': 'Employment', 'contractTitle': f'Employment Agreement - {ROLE_TITLE[role]}',
             'contractTotal': total, 'contractNumber': f'EC-EMP-{i:03d}', 'contractStatus': 'active', 'contractVATRate': 0, 'contractCurrency': 'EUR', 'contractPartyType': 'person',
             'contractStartDate': '2025-01-01', 'contractFinishDate': None, 'contractSignedDate': '2024-12-15', 'contractSumBeforeVAT': total, 'contractPaymentsPeriod': 'Month'})
    # --- suppliers (partners) + framework supply contracts
    used_sup = sorted({ING[c][3] for c in ING})
    for i, sup in enumerate(used_sup, 1):
        add('partnerTable', supplier_partner(sup), 'partnerCatalog', 'empty', 91000 + i * 1000,
            {'isActive': True, 'partnerKind': 'company', 'partnerTitle': SUPPLIERS[sup], 'partnerLegalName': SUPPLIERS[sup] + ' GmbH', 'partnerIsSupplier': True, 'partnerIsCustomer': False,
             'supplierData': {'notes': 'Organic / Fairtrade certified supplier (fictional)', 'defaultCurrency': 'EUR', 'paymentTermsDays': 14}})
        add('contractTable', supplier_contract(sup), supplier_partner(sup), 'partner', -92000 - i,
            {'notes': 'Framework supply agreement, orders 2 days before the delivery', 'contractVAT': 0, 'contractType': 'Supply', 'contractTitle': f'Framework supply agreement 2026 - {SUPPLIERS[sup]}',
             'contractTotal': 0, 'contractNumber': f'EC-SUP-{i:03d}', 'contractStatus': 'active', 'contractVATRate': 0, 'contractCurrency': 'EUR', 'contractPartyType': 'partner',
             'contractStartDate': '2025-12-01', 'contractFinishDate': '2026-12-31', 'contractSignedDate': '2025-11-20', 'contractSumBeforeVAT': 0, 'contractPaymentsPeriod': 'Month'})
    add('partnerTable', CUSTOMER[0], 'partnerCatalog', 'empty', 99000,
        {'isActive': True, 'partnerKind': 'company', 'partnerTitle': CUSTOMER[1], 'partnerLegalName': CUSTOMER[2], 'partnerIsSupplier': False, 'partnerIsCustomer': True,
         'customerData': {'creditLimit': 50000, 'defaultCurrency': 'EUR', 'discountPercent': 0, 'paymentTermsDays': 30}})
    add('contractTable', CUSTOMER_CONTRACT, CUSTOMER[0], 'partner', -93001,
        {'notes': 'Wholesale supply of 5 kg eco cakes at the wholesale price of the product', 'contractVAT': 0, 'contractType': 'Supply', 'contractTitle': 'Wholesale supply agreement 2026 - ' + CUSTOMER[1],
         'contractTotal': 0, 'contractNumber': 'EC-SALE-001', 'contractStatus': 'active', 'contractVATRate': 0, 'contractCurrency': 'EUR', 'contractPartyType': 'partner',
         'contractStartDate': '2025-12-01', 'contractFinishDate': '2026-12-31', 'contractSignedDate': '2025-11-25', 'contractSumBeforeVAT': 0, 'contractPaymentsPeriod': 'Month'})
    # --- products: ingredients, packaging, the cakes
    add('productFolderTable', 'ck2-fld-eco', 'productFolderCatalog', 'empty', 91000, {'title': 'Eco bakery'})
    for i, (fid, title) in enumerate([('ck2-fld-ingredients', 'Organic ingredients'), ('ck2-fld-packaging', 'Compostable packaging'), ('ck2-fld-cakes', 'Eco supercakes 5 kg')], 1):
        add('productFolderTable', fid, 'productFolderCatalog', 'ck2-fld-eco', 91000 + i * 100, {'title': title})
    for tid, title, unit in [('ck2-type-ingredient', 'Organic ingredient (kg)', 'unit_kg'), ('ck2-type-liquid', 'Organic liquid (l)', 'unit_l'),
                             ('ck2-type-packaging', 'Compostable packaging', 'unit_pcs'), ('ck2-type-cake', 'Eco supercake 5 kg', 'unit_pcs')]:
        add('productTypeTable', tid, 'productTypeCatalog', 'empty', 91000 + len(rows), {'title': title, 'baseUnit': unit, 'isActive': True, 'variantSet': '', 'propertySet': '', 'variantMode': 'none', 'uniqueVariants': True, 'productVATDefaultRate': 'vat_0'})
    for i, code in enumerate(ING, 1):
        nm, unit, price, sup, pack, shelf, cover, origin = ING[code]
        ptype = 'ck2-type-packaging' if code in PACKAGING else ('ck2-type-liquid' if unit == 'l' else 'ck2-type-ingredient')
        fld = 'ck2-fld-packaging' if code in PACKAGING else 'ck2-fld-ingredients'
        add('productTable', material_product(code), ptype, fld, 91000 + i * 10,
            {'sku': 'CK2-' + code.upper(), 'title': nm, 'isActive': True, 'description': f'{origin}. Supplier: {SUPPLIERS[sup]}. Shelf life {shelf} days, pack {pack:g} {unit}.', 'measureUnitDefault': UNIT_OF[unit], 'measureUnitForInventory': UNIT_OF[unit]})
        add('productPriceTable', f'ck2-pp-{code}', material_product(code), 'empty', 91000 + i, {'price': price, 'validFrom': '2025-01-01', 'measureUnit': UNIT_OF[unit], 'priceTypeGUID': 'pt_purchase'})
    for i, (c, v) in enumerate(cake_costs().items(), 1):
        add('productTable', cake_product(c), 'ck2-type-cake', 'ck2-fld-cakes', 95000 + i * 10,
            {'sku': 'CK2-CAKE-' + c.upper(), 'title': RECIPES[c]['title'].split(' (')[0] + ' 5 kg', 'isActive': True,
             'description': f'{RECIPES[c]["title"]}, 5 kg, {RECIPES[c]["comps"]} organic plant-based components. Cost {v["cost"]:.2f} EUR + {MARKUP * 100:.0f} % = wholesale {v["wholesale"]:.0f} EUR.',
             'measureUnitDefault': 'unit_pcs', 'measureUnitForInventory': 'unit_pcs'})
        add('productPriceTable', f'ck2-pp-cake-{c}-w', cake_product(c), 'empty', 95000 + i, {'price': v['wholesale'], 'validFrom': '2025-01-01', 'measureUnit': 'unit_pcs', 'priceTypeGUID': 'pt_wholesale'})
        add('productPriceTable', f'ck2-pp-cake-{c}-r', cake_product(c), 'empty', 95100 + i, {'price': v['retail'], 'validFrom': '2025-01-01', 'measureUnit': 'unit_pcs', 'priceTypeGUID': 'pt_retail'})
    out = ['-- CAKE2 demo catalogs (documentation/CAKE1, generated by cake_v1_optimization.py): the REAL persons, roles, material and deliverable products, suppliers and the customer',
           '-- that the task lines of cake2_plan_json.json refer to. Idempotent: run it again = the same rows. Run it BEFORE importing the json. Needs start1 + start2 + start4.',
           'DO $$ BEGIN', "  IF to_regclass('public.\"personTable\"') IS NULL OR to_regclass('public.\"rolePriceTable\"') IS NULL OR to_regclass('public.\"productPriceTable\"') IS NULL OR to_regclass('public.\"contractTable\"') IS NULL THEN",
           "    RAISE EXCEPTION 'Run start1_sql_tables.sql + start2_sql_code.sql + start4_sql_insert_missing.sql first';", '  END IF;', 'END $$;', '', 'BEGIN;']
    for table in dict.fromkeys(r[0] for r in rows):
        out.append(f'-- {table}')
        out.append(f'INSERT INTO public."{table}" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES')
        body = [f"  ('{g}', '{o}', '{pa}', {od}, {_sql_str(js)})" for t, g, o, pa, od, js in rows if t == table]
        out.append(',\n'.join(body))
        out.append('ON CONFLICT ("rowGUID") DO UPDATE SET "rowOwnerGUID" = EXCLUDED."rowOwnerGUID", "rowParentGUID" = EXCLUDED."rowParentGUID", "rowJSON" = EXCLUDED."rowJSON";')
        out.append('')
    out += ['COMMIT;', "NOTIFY pgrst, 'reload schema';", '']
    out += ['-- UNDO (run only after the project CAKE2 / its lines are deleted; every row of this file has an id that starts with ck2- or is a person with an @ecocakes.example e-mail):']
    for table in reversed(list(dict.fromkeys(r[0] for r in rows))):
        if table == 'personTable':
            out.append('--   DELETE FROM public."personTable" WHERE "rowJSON"->>\'personEmail\' LIKE \'%@ecocakes.example\';')
        elif table == 'contractTable':
            out.append('--   DELETE FROM public."contractTable" WHERE "rowGUID" LIKE \'ck2-ct-%\';')
        else:
            out.append(f'--   DELETE FROM public."{table}" WHERE "rowGUID" LIKE \'ck2-%\';')
    out.append('')
    path.write_text('\n'.join(out), encoding='utf-8')


# =====================================================================================================================
# 7b. THE TASK LINES (what Post takes) - derived from the WBS itself, so the same code can complete an existing file (--lines-only)
# =====================================================================================================================
# Only what exists in every database after start4 is referenced: the genus, the units, the budget items, the uniform distribution.
# NO roles / persons / products are made (they are catalogs of the organization): a line is priced by hand (priceSourceTaskLine 'manual') and
# its description (the subtitle of the resource column) names the worker or the ingredient. All money in EUR, VAT is not modelled (0 %).
UNIT_OF = {'kg': 'unit_kg', 'l': 'unit_l', 'pcs': 'unit_pcs'}
ITEM_WAGES, ITEM_RAW, ITEM_PACK, ITEM_SALE = 'employeeWagesBudgetItem', 'rawMaterialsBudgetItem', 'consumablesBudgetItem', 'saleOfGoodsBudgetItem'
CALENDAR_FOR_POST = 'sixDayWeekCalendar'      # Mon-Sat, no holidays: the plant works on Saturdays and the buyer orders on 1 January (workingDaysCalendar = Mon-Fri would refuse those tasks)
PROJECT_SETTINGS = {
    'currencyForBudget': 'EUR', 'currencyForContract': 'EUR', 'currencyForAccounting': 'EUR',
    'budgetScenarioForPlan': 'planScenarioProject1', 'budgetScenarioForFact': 'factScenarioProject1', 'calendarForTaskPlan': CALENDAR_FOR_POST,
    'projectExpenseBudgetNeeded': True, 'projectTimeCostsNeeded': True, 'projectTimeOfPersonNeeded': True, 'projectMaterialCostsNeeded': True,
    'projectExpenseCostsNeeded': False, 'projectRevenueBudgetNeeded': False,
}


def money(q: float, price: float) -> float:
    return round(q * price + 1e-9, 2)


def make_line(task_guid: str, key: str, n: int, genus: str, unit: str, qty: float, price: float, item: str, text: str, extra: Optional[dict] = None) -> dict:
    s = money(qty, price)
    js = {'taskManagementGenusLine': genus, 'distributionForBudgetTaskLine': 'uniformDistribution', 'measureUnitTaskLine': unit,
          'qtyTaskLine': qty, 'priceTaskLine': price, 'priceSourceTaskLine': 'manual', 'vatRatioTaskLine': 0,
          'sumForContract': s, 'sumVATForContract': 0, 'sumForAccounting': s, 'sumVATForAccounting': 0, 'sumForBudget': s, 'sumVATForBudget': 0,
          'budgetItemTaskLine': item, 'taskIsPosted': False, 'description': text}
    if extra:
        js.update(extra)
    return {'rowGUID': gid(f'line:{key}:{n}'), 'rowOwnerGUID': task_guid, 'rowParentGUID': genus, 'orderInList': n * 1024, 'rowJSON': js}


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
        lines.append(make_line(t['rowGUID'], key, n, 'timeGenus', 'unit_hour', round(mins / 60, 4), RATES[role], ITEM_WAGES, f'{role} · {who} · {cols["cc_from"]}-{cols["cc_to"]}',
                               {'resourceRoleItem': ROLE_OF[role], 'taskResourceKind': 'person', 'taskResourceItem': person_guid(who), 'taskResourceContract': contract_of_person(who),
                                'priceSourceTaskLine': 'contract', 'priceAutoTaskLine': RATES[role], 'raciItem': 'raciResponsibleGUID'}))
        cake = cake_of.get(t['treePath'].split('.')[1])
        if cake is None:
            continue                                      # an order line or a goods receipt of the purchasing stage
        ops = ROUTING[cake]
        title = js['taskDescription']

        def material(code: str, qty: float, item: str):
            nonlocal n
            nm, unit, price, sup = ING[code][0], ING[code][1], ING[code][2], ING[code][3]
            n += 1
            lines.append(make_line(t['rowGUID'], key, n, 'materialGenus', UNIT_OF[unit], qty, price, item, f'{nm} · {SUPPLIERS[sup]}',
                                   {'resourceRoleItem': material_role(code), 'taskResourceItem': material_product(code), 'priceSourceTaskLine': 'product', 'priceAutoTaskLine': price,
                                    'taskLinePartnerItem': supplier_partner(sup), 'taskLinePartnerContract': supplier_contract(sup)}))
        if title.startswith(ops[0].name + ' · '):          # the weighing of the batch: all ingredients of the batch
            for code, q in RECIPES[cake]['ing'].items():
                material(code, round(q * BATCH_CAKES, 4), ITEM_RAW)
        if title.startswith(ops[-1].name + ' · '):         # the packing of the batch: the packaging of every cake + the DELIVERABLE = the packed cakes
            for code in PACKAGING:
                material(code, float(BATCH_CAKES), ITEM_PACK)
            cc_ = cake_costs()[cake]
            n += 1
            lines.append(make_line(t['rowGUID'], key, n, 'revenueGenus', 'unit_pcs', float(BATCH_CAKES), cc_['wholesale'], ITEM_SALE, f'{RECIPES[cake]["title"].split(" (")[0]} 5 kg · {CUSTOMER[1]}',
                                   {'resourceRoleItem': REVENUE_ROLE, 'taskResourceItem': cake_product(cake), 'priceSourceTaskLine': 'product', 'priceAutoTaskLine': cc_['wholesale'],
                                    'taskLinePartnerItem': CUSTOMER[0], 'taskLinePartnerContract': CUSTOMER_CONTRACT}))
    doc['taskLines'] = lines
    doc['project']['rowJSON'].update(PROJECT_SETTINGS)
    return doc


# =====================================================================================================================
# 8. THE MAIN PROGRAM
# =====================================================================================================================
def find_crew(batches: List[Batch], t_search: float, t_final: float, threads: int, log: bool) -> dict:
    wm = worker_minutes(batches)
    days = sum(len(w) for w in production_weeks())
    per_worker = (days if days <= 5 else days * 5 / 6) * SHIFT_NET_MIN
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
    ap = argparse.ArgumentParser(description='CAKE1 / RUN1 plan: OR-Tools CP-SAT + total_costs.csv + WBS json for appPM80')
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
        write_catalog_sql(doc, OUT_CATALOG_SQL)
        patch_total_costs_revenue(OUT_CSV)
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
    write_total_costs(OUT_CSV, batches, tasks, workers, sol, pos, lots)
    costs = load_total_costs(OUT_CSV)
    assert costs['summary']['confectioners needed'] == sol['nE'] + sol['nL']
    print(f'{OUT_CSV.name}: {sol["nE"] + sol["nL"]} confectioners, total needed {costs["needed_total"]:,.2f} EUR, ordered {costs["ordered_total"]:,.2f} EUR')

    wm = worker_minutes(batches)
    total_eur = costs['ordered_total']
    finish = max(t.end for t in tasks)
    summary = {
        'workers': sol['nE'] + sol['nL'], 'early': sol['nE'], 'late': sol['nL'], 'worker_minutes': wm,
        'tasks': len(tasks), 'purchase_orders': len(pos), 'order_lines': len(lots), 'purchase_eur': round(total_eur, 2), 'last_end': finish.isoformat(),
    }
    summary['project_notes'] = (
        f'CAKE2: 8 eco cakes × 20 × 5 kg (160 cakes, 800 kg), production Thu 1 - Fri 2 January 2026. {summary["workers"]} confectioners found by OR-Tools CP-SAT '
        f'(Early {sol["nE"]} + Late {sol["nL"]}), {len(pos)} purchase orders ({total_eur:,.0f} EUR), orders 2+ days before delivery, last cake packed {finish:%a %d %b %H:%M}. '
        'Documentation: documentation/CAKE1/INIT_STAGE.html, costs: total_costs.csv. Times are the local plant time (hours and minutes are in the columns Hour S / Min S / Hour F / Min F and in From / To).')
    doc = add_task_lines(build_wbs(batches, tasks, workers, sol, pos, lots, stats, summary, costs))
    lines_eur = sum(l['rowJSON']['sumForBudget'] for l in doc['taskLines'] if l['rowParentGUID'] != 'revenueGenus')
    rev_eur = sum(l['rowJSON']['sumForBudget'] for l in doc['taskLines'] if l['rowParentGUID'] == 'revenueGenus')
    assert abs(lines_eur - costs['needed_total']) < 1.0, (lines_eur, costs['needed_total'])      # the cost lines (Time + Material) = total_costs.csv
    assert abs(rev_eur - costs['revenue']) < 0.01, (rev_eur, costs['revenue'])                    # the Deliverable lines = the revenue rows of the csv
    print(f'task lines: cost {lines_eur:,.2f} EUR = total_costs.csv needed {costs["needed_total"]:,.2f} EUR; deliverables {rev_eur:,.2f} EUR')
    write_catalog_sql(doc, OUT_CATALOG_SQL)
    print(f'{OUT_CATALOG_SQL.name}: the catalog rows the lines refer to')
    out = Path(a.out)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    summary.update(rows=len(doc['tasks']), dependencies=len(doc['dependencies']), crew_minutes={n: w['minutes'] for n, w in workers.items()},
                   seconds=round(time.time() - t0))
    print(json.dumps({k: v for k, v in summary.items() if k != 'project_notes'}, indent=1, ensure_ascii=False))
    print(f'written {out}  ({out.stat().st_size / 1e6:.2f} MB, {len(doc["tasks"])} rows, {len(doc["dependencies"])} links, {len(doc["taskLines"])} task lines)')


if __name__ == '__main__':
    main()
