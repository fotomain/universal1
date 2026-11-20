# -*- coding: utf-8 -*-
"""From a BIM task (IFC class + type name + element count + quantities) to its work: man-hours per trade, materials, expenses, build phase.
Norms are building-economist norms (man-hours per m2 / piece, losses 3-8 %), see README.md."""
import re

# phase -> working days after the structure of the storey is ready (the gate of the storey)
PHASE_OFFSET = {
    'anchors': 1, 'shell': 3, 'stairs': 4, 'frames': 6, 'facade': 11, 'glazing': 16, 'rough': 15, 'roofwork': 20, 'partition': 24,
    'ceiling': 36, 'screed': 42, 'floorfin': 56, 'doors': 63, 'fixtures': 68, 'final': 74,
}
TRADE_OF_SITE_MANAGER = 'site-manager'


class B:
    def __init__(self, phase):
        self.phase = phase
        self.lab = {}
        self.mat = {}
        self.exp = {}
        self.note = ''

    def L(self, role, h):
        if h > 0: self.lab[role] = self.lab.get(role, 0.0) + h
        return self

    def M(self, key, q):
        if q > 0: self.mat[key] = self.mat.get(key, 0.0) + q
        return self

    def E(self, key, q):
        if q > 0: self.exp[key] = self.exp.get(key, 0.0) + q
        return self


def thick(ty, default):
    m = re.findall(r'(\d+)\s*(?:mm)?\s*$', ty.strip())
    if m:
        return int(m[-1])
    m = re.findall(r'\b(\d{2,3})\s*mm', ty)
    return int(m[-1]) if m else default


def nearest(t, options):
    return min(options, key=lambda o: abs(o - t))


def area(q, n, *keys, default_each=0.0):
    for k in keys:
        v = q.get(k)
        if v and v > 0: return v
    return n * default_each


def build(task):
    """-> B or None"""
    c, ty, n, q = task['class'], task['type'], task['n'], task['q']
    t = ty.lower()
    A = 0.0
    wall = c in ('IfcWall', 'IfcWallStandardCase')

    # ---------------- walls ----------------
    if wall:
        A = area(q, n, 'NetSideArea', 'GrossSideArea', default_each=2.5)
        V = area(q, n, 'NetVolume', 'GrossVolume', default_each=0.2)
        if 'kalkzandsteen' in t:
            th = nearest(thick(t, 120), [100, 120, 150])
            b = B('shell').L('cs-fitter', 0.20 * A).L('labourer', 0.08 * A)
            b.M('cs%d' % th, 1.03 * A).M('csglue', 1.1 * A).E('crane', 0.035 * A).E('waste', 0.004 * A)
            return b
        if 'prefabbeton' in t:
            key = 'pedge' if 'rand' in t else 'pfacade'
            b = B('shell').L('concrete-fitter', 0.42 * A).L('labourer', 0.08 * A)
            b.M(key, 1.0 * A).M('sealant', 1.0 * A).E('crane', 0.05 * A).E('facadeacc', 0.6 * A).E('survey', 0.5)
            return b
        if 'ytong' in t or 'gasbeton' in t:
            th = nearest(thick(t, 100), [100, 120, 150])
            b = B('partition').L('bricklayer', 0.28 * A).L('labourer', 0.14 * A)
            b.M('ytong%d' % th, 1.04 * A).M('ytongmort', 1.4 * th / 100.0 * A).E('waste', 0.006 * A)
            return b
        if t.startswith('dd isolatie'):
            th = thick(t, 100)
            if ' dik ' in t:
                key = 'wool%d' % nearest(th, [100, 120, 145, 150, 160])
            else:
                key = 'pir%d' % nearest(th, [50, 60, 70, 90, 100, 120, 145, 150, 160, 180])
            b = B('facade').L('insulator', 0.09 * A).L('labourer', 0.02 * A)
            b.M(key, 1.05 * A).M('wallanchor', 4.5 * A).E('facadeacc', 0.8 * A).E('waste', 0.003 * A)
            return b
        if 'aluminium kozijnen' in t:
            b = B('glazing').L('frame-fitter', 1.9 * A).L('labourer', 0.2 * A)
            b.M('alukozijn', 1.02 * A).M('sealant', 1.0 * A).E('crane', 0.12 * A).E('facadeacc', 0.4 * A).E('survey', 0.5)
            return b
        if 'loggia afwerking' in t:
            b = B('facade').L('facade-fitter', 0.65 * A).L('labourer', 0.10 * A)
            b.M('loggiacl', 1.06 * A).M('sealant', 0.8 * A).E('facadeacc', 0.5 * A)
            return b
        if 'rekje' in t:
            return B('final').L('steel-fitter', 0.45 * n).L('labourer', 0.1 * n).M('gutterrail', n).E('crane', 0.03 * n)
        if 'inbouw reservoir' in t:
            return B('rough').L('drywaller', 0.35 * n * 0.5).L('plumber', 0.3 * n * 0.5).M('cisterncase', 0.5 * n)
        if 'douchwand' in t:
            b = B('fixtures').L('frame-fitter', 1.6 * A).L('labourer', 0.2 * A)
            b.M('glasswall', 1.03 * A).M('sealant', 1.0 * A)
            return b
        if 'dakbedekking' in t:
            return B('roofwork').L('roofer', 0.55 * A).M('roofcover', 1.08 * A).E('waste', 0.005 * A)
        if 'terras afwerking' in t:
            return B('final').L('carpenter', 0.45 * A).M('deck', 1.05 * A)
        if 'naaldhout 255' in t:
            return B('rough').L('carpenter', 12.0 * V).M('timberm3', 1.05 * V).E('crane', 0.5 * V)
        if 'naaldhout' in t:
            b = B('partition').L('carpenter', 0.45 * A).L('drywaller', 0.2 * A)
            b.M('timberm', 2.6 * A).M('board125', 1.05 * A).M('woolpart', 1.0 * A).M('jointset', 1.0 * A).E('waste', 0.006 * A)
            return b
        if 'multiplex' in t:
            return B('partition').L('carpenter', 0.38 * A).M('ply15', 1.08 * A).E('waste', 0.003 * A)
        if 'hsb' in t:
            return B('partition').L('carpenter', 0.9 * A).M('hsb', A).E('crane', 0.02 * A)
        if 'steun wand' in t:
            return B('rough').L('carpenter', 0.5 * n).M('timberm', 4.0 * n)
        if 'gipsplaat' in t:
            b = B('ceiling').L('drywaller', 0.25 * A).M('board10', 1.05 * A).M('jointset', A).E('waste', 0.004 * A)
            return b
        if 'ms/' in t:
            b = B('partition').L('drywaller', 0.6 * A).M('stud75', A).M('board125', 2.1 * A).M('jointset', A).M('filler', A)
            return b
        if 'gyproc' in t:
            heavy = any(x in t for x in ('gf 205', 'gf 180', 'gf 220', '2.75-75.2'))
            if '2x12,5' in t or 'voorzetwand' in t:
                b = B('partition').L('drywaller', 0.55 * A).L('labourer', 0.05 * A)
                b.M('stud75', 0.5 * A).M('board125', 2.1 * A).M('jointset', A).M('filler', A)
            elif heavy:
                b = B('partition').L('drywaller', 0.95 * A).L('labourer', 0.12 * A)
                b.M('stud75', 2.0 * A).M('board125', 2.2 * A).M('board125f', 2.1 * A).M('woolpart', 2.0 * A).M('jointset', 2.0 * A).M('filler', 2.0 * A)
            else:
                b = B('partition').L('drywaller', 0.62 * A).L('labourer', 0.08 * A)
                b.M('stud75', A).M('board125', 1.6 * A).M('board125w', 0.5 * A).M('woolpart', A).M('jointset', A).M('filler', A)
            b.E('waste', 0.008 * A)
            return b
        return None

    # ---------------- coverings ----------------
    if c == 'IfcCovering':
        A = area(q, n, 'NetArea', 'GrossArea', default_each=1.0)
        if 'lekdorpel' in t:
            return B('final').L('frame-fitter', 0.35 * n).M('sill', n)
        if 'inbouw armatuur' in t:
            return B('final').L('electrician', 0.75 * n).M('luminaire', n)
        if 'balkon rand' in t:
            return B('final').L('steel-fitter', 0.45 * n).L('labourer', 0.1 * n).M('gutterrail', n).E('crane', 0.03 * n)
        if 'kunststeen' in t:
            return B('final').L('tiler', 0.75 * A).M('artstone', 1.05 * A).M('sealant', 0.5 * A)
        if t.startswith('tegels'):
            b = B('floorfin').L('tiler', 0.9 * A).L('labourer', 0.1 * A)
            b.M('tile', 1.08 * A).M('tileglue', A).M('tilegrout', A).E('waste', 0.006 * A)
            return b
        if 'gang koof' in t:
            b = B('ceiling').L('drywaller', 0.75 * A).L('labourer', 0.05 * A)
            b.M('ceilsys', A).M('board125f', 2.1 * A).M('jointset', A).M('filler', A).E('waste', 0.006 * A)
            return b
        if 'plafond geluid' in t:
            b = B('ceiling').L('drywaller', 0.72 * A).L('labourer', 0.05 * A)
            b.M('ceilsys', A).M('board125', 2.1 * A).M('woolpart', A).M('jointset', A).M('filler', A).E('waste', 0.006 * A)
            return b
        if 'gyproc' in t:
            b = B('ceiling').L('drywaller', 0.55 * A).L('painter', 0.06 * A)
            b.M('ceilsys', A).M('board125', 2.1 * A).M('jointset', A).M('filler', A).E('waste', 0.006 * A)
            return b
        if 'promatect' in t:
            return B('ceiling').L('drywaller', 0.6 * A).M('promatect', 1.06 * A).M('jointset', A)
        if 'geluid werend' in t:
            return B('screed').L('insulator', 0.06 * A).M('acoustic25', 1.05 * A)
        if 'isolatie' in t and 'afschot' not in t and 'loggia' not in t:
            th = thick(t, 100)
            if ' dik ' in t:
                key = 'wool%d' % nearest(th, [100, 120, 145, 150, 160])
            else:
                key = 'pir%d' % nearest(th, [50, 60, 70, 90, 100, 120, 145, 150, 160, 180])
            b = B('facade').L('insulator', 0.08 * A).L('labourer', 0.02 * A)
            b.M(key, 1.05 * A).E('waste', 0.003 * A)
            return b
        if 'afschot' in t:
            b = B('roofwork').L('roofer', 0.5 * A).L('labourer', 0.05 * A)
            b.M('roofins', 1.04 * A).M('roofcover', 1.08 * A).E('waste', 0.006 * A)
            return b
        if 'isolatie loggia' in t:
            return B('roofwork').L('roofer', 0.3 * A).M('loggiains', 1.04 * A)
        if 'loggia dakbedekking' in t:
            return B('roofwork').L('roofer', 0.4 * A).M('roofcover', 1.08 * A)
        if 'dakrand' in t:
            return B('roofwork').L('roofer', 0.6 * n).L('facade-fitter', 0.3 * n).M('coping', n).E('crane', 0.02 * n)
        if 'rekje terras' in t:
            return B('final').L('carpenter', 0.4 * A).M('deck', 1.05 * A)
        if 'multiplex' in t:
            return B('partition').L('carpenter', 0.3 * A).M('ply15', 1.1 * A)
        if 'aluminium' in t:
            return B('final').L('facade-fitter', 0.8 * A).M('alusheet', 1.12 * A)
        if 'dd staal 100 x 200' in t:
            return B('rough').L('steel-fitter', 0.8 * n).M('steelbeam', 3.0 * n).E('crane', 0.15 * n)
        if 'staal' in t:
            a = A if q else n * 1.0
            return B('rough').L('steel-fitter', 0.9 * a).M('steelplate', 1.1 * a)
        if 'gipsplaat' in t:
            th = thick(t, 10)
            key = 'board13' if th == 13 else ('board20' if th == 20 else 'board10')
            b = B('ceiling').L('drywaller', 0.22 * A).L('painter', 0.14 * A)
            b.M(key, 1.06 * A).M('jointset', A).M('filler', A).E('waste', 0.004 * A)
            return b
        return None

    # ---------------- windows ----------------
    if c == 'IfcWindow':
        A = area(q, n, 'Area', 'GrossArea', default_each=1.8)
        if t == 'roof 1':
            return B('roofwork').L('roofer', 3.5 * n).M('roofwindow', n)
        if t.startswith('stelkozijn'):
            b = B('frames').L('frame-fitter', 1.4 * A).L('labourer', 0.15 * A)
            b.M('stelkozijn', 1.02 * A).M('sealant', A).E('crane', 0.10 * A).E('survey', 0.25)
            return b
        b = B('glazing').L('frame-fitter', 2.2 * A).L('labourer', 0.25 * A)
        b.M('alupui', 1.02 * A).M('sealant', A).E('crane', 0.12 * A).E('facadeacc', 0.6 * A)
        return b

    # ---------------- doors ----------------
    if c == 'IfcDoor':
        if t.startswith('d2'):
            return B('doors').L('carpenter', 3.2 * n).M('doorfire', n).E('hoist', 0.05 * n)
        if t.startswith('d1 zl'):
            return B('doors').L('carpenter', 2.4 * n).M('doorint2', n).E('hoist', 0.03 * n)
        if t.startswith('d1'):
            return B('doors').L('carpenter', 2.4 * n).M('doorint', n).E('hoist', 0.03 * n)
        if 'deur loggia' in t:
            return B('glazing').L('frame-fitter', 3.0 * n).M('doorloggia', n).E('crane', 0.1 * n)
        if 'dubbel draai' in t:
            return B('glazing').L('frame-fitter', 4.5 * n).M('doordbl', n).E('crane', 0.2 * n)
        if 'entree' in t or 'dubbel' in t:
            return B('glazing').L('frame-fitter', 12.0 * n).M('doorentry', n).E('crane', 0.5 * n)
        return B('doors').L('carpenter', 3.0 * n).M('doorint', n)

    # ---------------- beams ----------------
    if c == 'IfcBeam':
        if 'onderdorpel' in t:
            return B('glazing').L('concrete-fitter', 0.6 * n).M('psill', n).E('crane', 0.04 * n)
        return B('shell').L('concrete-fitter', 1.4 * n).L('labourer', 0.3 * n).M('plintel', n).E('crane', 0.7 * n)

    # ---------------- slabs ----------------
    if c == 'IfcSlab':
        A = area(q, n, 'GrossArea', 'NetArea', default_each=3.0)
        V = area(q, n, 'GrossVolume', 'NetVolume', default_each=0.25)
        if 'inbouw reservoir' in t:
            return B('rough').L('plumber', 1.3 * n).M('cistern', n)
        if 'dekvloer' in t or 'afwerkvloer' in t:
            rate = 0.09 if 'badkamer' in t else 0.07
            b = B('screed').L('screeder', rate * A).L('labourer', 0.05 * A)
            b.M('screed', 1.06 * V).M('edgefoil', 1.05 * A).E('screedpump', V).E('waste', 0.004 * A)
            return b
        if 'prefabbeton' in t:
            return B('shell').L('concrete-fitter', 7.0 * V).L('labourer', 1.0 * V).M('pbeamm3', V).E('crane', 0.9 * V)
        if 'multiplex' in t:
            return B('rough').L('carpenter', 18.0 * V).M('plym3', 1.05 * V)
        return None

    # ---------------- stairs, flow terminals, openings ----------------
    if c == 'IfcStair':
        if 'staal' in t:
            return B('stairs').L('steel-fitter', 60.0 * n).L('labourer', 10.0 * n).M('psteelstair', n).E('crane', 3.0 * n)
        return B('stairs').L('concrete-fitter', 6.5 * n).L('labourer', 1.5 * n).M('pstair', n).E('crane', 1.0 * n)
    if c == 'IfcFlowTerminal':
        return B('rough').L('plumber', 0.7 * n).M('floordrain', n)
    if c == 'IfcOpeningElement':
        return B('rough').L('labourer', 0.3 * n).L('bricklayer', 0.2 * n).E('coredrill', n)

    # ---------------- furnishing ----------------
    if c == 'IfcFurnishingElement':
        if t.startswith('toilet'):
            return B('fixtures').L('plumber', 0.9 * n).M('toilet', n)
        if 'meterkast' in t:
            return B('rough').L('electrician', 6.5 * n).L('labourer', 0.5 * n).M('meterkast', n).E('hoist', 0.5 * n)
        if 'poselein' in t:
            return B('fixtures').L('plumber', 0.7 * n).M('porcbasin', n)
        if 'wasmachine' in t:
            return B('fixtures').L('kitchen-fitter', 0.6 * n).M('washer', n).E('hoist', 0.1 * n)
        if 'droger' in t:
            return B('fixtures').L('kitchen-fitter', 0.6 * n).M('dryer', n).E('hoist', 0.1 * n)
        if 'keuken' in t:
            return B('fixtures').L('kitchen-fitter', 16.0 * n).L('plumber', 2.5 * n).L('electrician', 2.0 * n).M('kitchen', n).E('hoist', 0.6 * n)
        if 'wasbak' in t:
            return B('fixtures').L('plumber', 0.8 * n).M('basin', n)
        if 'koelkast' in t:
            return B('fixtures').L('kitchen-fitter', 0.5 * n).M('fridge', n)
        if 'kast hoog' in t:
            return B('fixtures').L('kitchen-fitter', 2.5 * n).M('tallcab', n)
        if 'brievenbus' in t:
            return B('final').L('carpenter', 0.8 * n).M('mailbox', n)
        if 'polyester' in t:
            return B('fixtures').L('plumber', 1.8 * n).M('polybeton', n)
        return None

    # ---------------- proxies ----------------
    if c == 'IfcBuildingElementProxy':
        if 'jordahl' in t:
            return B('anchors').L('steel-fitter', 0.16 * n).M('jordahl', n)
        if 'wasbak dubbel' in t:
            return B('fixtures').L('plumber', 1.4 * n).M('basin2', n)
        if 'aluminium kozijnen' in t:
            b = B('glazing').L('frame-fitter', 1.9 * 2.4 * n).M('alukozijn', 2.4 * n).M('sealant', 2.4 * n).E('crane', 0.12 * 2.4 * n)
            return b
        if 'lekdorpel' in t:
            return B('final').L('frame-fitter', 0.35 * n).M('sill', n)
        if 'aluminium' in t:
            return B('final').L('facade-fitter', 0.8 * n).M('alusheet', 0.9 * n)
        if t.startswith('stelkozijn'):
            return B('frames').L('frame-fitter', 1.4 * 21.6 * n).M('stelkozijn', 21.6 * n).E('crane', 0.10 * 21.6 * n)
        if 'kast hoog' in t:
            return B('fixtures').L('kitchen-fitter', 2.5 * n).M('tallcab', n)
        if 'eau-logo' in t:
            return B('final').L('frame-fitter', 1.0 * n).M('letters', n)
        if 'multiplex' in t:
            return B('partition').L('carpenter', 1.0 * n).M('ply15', 3.0 * n)
        if 'gyproc' in t:
            return B('partition').L('drywaller', 0.62 * 8 * n).M('stud75', 8 * n).M('board125', 8 * 2.1 * n).M('jointset', 8 * n)
        return None

    if c == 'IfcDiscreteAccessory':
        return B('final').L('frame-fitter', 0.4 * n).M('letters', n)
    if c == 'IfcRailing':
        if 'prefabbeton' in t:
            return B('final').L('concrete-fitter', 1.2 * n).M('prailing', n).E('crane', 0.4 * n)
        if 'aluminium' in t:
            return B('final').L('steel-fitter', 1.1 * n).M('railalu', n).E('crane', 0.05 * n)
        if 'staal' in t:
            return B('final').L('steel-fitter', 1.4 * n).M('railsteel', n).E('crane', 0.05 * n)
        if 'glas' in t:
            return B('final').L('frame-fitter', 1.8 * n).M('railglass', n).E('crane', 0.06 * n)
        return B('final').L('steel-fitter', 0.5 * n).M('raildef', n)
    if c == 'IfcDistributionControlElement':
        key = 'ventlargo' if 'largo' in t else ('ventduco' if 'duco' in t else 'ventglas')
        return B('final').L('frame-fitter', 0.22 * n).M(key, n)
    return None
