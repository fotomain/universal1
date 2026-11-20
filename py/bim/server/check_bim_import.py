#!/usr/bin/env python3
"""Checker of a converted bundle (like documentation/CAKE2/check_cake2_plan.py): prints OK or the list of problems; exit code 1 on a problem.

  python check_bim_import.py <bundle folder> [--ifc <the IFC>] [--expect-elements 58] [--expect-tasks 58] [--expect-stages 4]
What is checked: every chunk file is readable, its sha256 is its name and its size is the one in bundle.json; the rows agree with the chunks (element numbers, guids);
every element has exactly one task and every task has an element (stages excepted); the tree paths are consistent; with --ifc the geometry is compared with a second,
independent read of the IFC (the dequantized vertices must be within 2 mm of the original ones) and the unit scale is checked against the storey elevations.
"""
import argparse
import glob
import hashlib
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bimc import read_chunk  # noqa: E402

QUANT_TOLERANCE_M = 0.002


def check_bundle(folder: str, ifc: str | None = None, expect: dict | None = None) -> list[str]:
    problems: list[str] = []
    with open(os.path.join(folder, 'bundle.json'), encoding='utf-8') as fh:
        bundle = json.load(fh)
    pfiles = glob.glob(os.path.join(folder, 'project_data_*.json'))
    if len(pfiles) != 1:
        return ['expected exactly one project_data_*.json in the folder']
    with open(pfiles[0], encoding='utf-8') as fh:
        project = json.load(fh)
    model, chunks, elements, storeys = bundle['model'], bundle['chunks'], bundle['elements'], bundle['storeys']
    c = model['counts']
    if c['elements'] != len(elements) or c['chunks'] != len(chunks) or c['storeys'] != len(storeys):
        problems.append('the counts of the model do not match the rows')
    for k, v in (expect or {}).items():
        have = {'elements': len(elements), 'tasks': c['tasks'], 'stages': c['stages'], 'storeys': len(storeys)}[k]
        if have != v:
            problems.append(f'expected {v} {k}, found {have}')

    read = {}
    for ch in chunks:
        path = os.path.join(folder, 'chunks', ch['hash'] + '.bimc')
        if not os.path.exists(path):
            problems.append(f"chunk file missing: {ch['hash']}")
            continue
        with open(path, 'rb') as fh:
            data = fh.read()
        if hashlib.sha256(data).hexdigest() != ch['hash']:
            problems.append(f"chunk {ch['hash'][:10]}: the sha256 is not the name")
        if len(data) != ch['byteSize']:
            problems.append(f"chunk {ch['hash'][:10]}: size differs from bundle.json")
        rc = read_chunk(data)
        read[ch['hash']] = rc
        if rc.element_count != ch['elementCount'] or rc.vertex_count != ch['vertexCount']:
            problems.append(f"chunk {ch['hash'][:10]}: counts differ from bundle.json")
    guid_of = {}
    for el in elements:
        rc = read.get(el['chunkHash'])
        if rc is None:
            problems.append(f"element {el['ifcGuid']}: its chunk is missing")
            continue
        if rc.guids[el['elementNumber']] != el['ifcGuid']:
            problems.append(f"element {el['ifcGuid']}: the element number points to {rc.guids[el['elementNumber']]}")
        guid_of[el['ifcGuid']] = el

    # tasks
    tasks = {t['rowGUID']: t for t in project['tasks']}
    stage_ids = {g for g, t in tasks.items() if t['rowJSON']['rowKind'] == 'stage'}
    leaf = {g for g, t in tasks.items() if t['rowJSON']['rowKind'] == 'task'}
    used = set()
    for el in elements:
        if el.get('taskGUID') is None:
            # the converter fills it in the bundle only through the wbs; the project file carries bimIfcGuid / bimGroupKey
            continue
        if el['taskGUID'] not in leaf:
            problems.append(f"element {el['ifcGuid']}: its task is not a task of the file")
        used.add(el['taskGUID'])
    if elements and all(e.get('taskGUID') for e in elements):
        if used != leaf:
            problems.append(f'{len(leaf - used)} tasks without an element')
    else:
        problems.append('elements carry no taskGUID')
    for g, t in tasks.items():
        labels = t['treePath'].split('.')
        if labels[-1] != g.replace('-', '_'):
            problems.append(f'task {g}: the tree path does not end with its own id')
        if t['rowJSON']['rowKind'] == 'task' and len(labels) != 3:
            problems.append(f'task {g}: a task must stand inside a stage')
    if project['dependencies']:
        problems.append('a BIM project file must have no links')
    if any(t.get('rowJSON', {}).get('rowKind') == 'task' and 'taskLines' in t for t in project['tasks']) or project.get('taskLines'):
        problems.append('a BIM project file must have no task lines')
    s_el = {s['ifcGuid'] for s in storeys}
    for el in elements:
        if el['storeyIfcGuid'] not in s_el:
            problems.append(f"element {el['ifcGuid']}: storey missing")
    for st in storeys:
        if st.get('stageGUID') not in stage_ids:
            problems.append(f"storey {st['name']}: its stage is not in the file")

    if ifc:
        import ifcopenshell
        import ifcopenshell.geom
        import ifcopenshell.util.unit as uu
        f = ifcopenshell.open(ifc)
        scale = float(uu.calculate_unit_scale(f))
        if abs(scale - model['unitScale']) > 1e-12:
            problems.append(f"unit scale {model['unitScale']} differs from the IFC ({scale})")
        for s in f.by_type('IfcBuildingStorey'):
            mine = next((x for x in storeys if x['ifcGuid'] == s.GlobalId), None)
            if mine and abs(mine['elevation'] - float(s.Elevation or 0) * scale) > 1e-3:
                problems.append(f"storey {s.Name}: elevation {mine['elevation']} is not {float(s.Elevation or 0) * scale}")
        settings = ifcopenshell.geom.settings()
        settings.set('use-world-coords', True)
        it = ifcopenshell.geom.iterator(settings, f, 2)
        cx, cy, cz = model['originShift']
        compared = 0
        worst = 0.0
        if it.initialize():
            while True:
                sh = it.get()
                g = sh.guid
                el = guid_of.get(g)
                if el is not None:
                    v = np.array(sh.geometry.verts, dtype=np.float64).reshape(-1, 3)
                    scene = np.stack([v[:, 0] - cx, v[:, 2] - cz, -(v[:, 1] - cy)], axis=1)
                    rc = read[el['chunkHash']]
                    mask = rc.element_index == el['elementNumber']
                    back = rc.world_positions()[mask]
                    if back.shape != scene.shape:
                        problems.append(f'element {g}: {back.shape[0]} vertices in the chunk, {scene.shape[0]} in the IFC')
                    else:
                        worst = max(worst, float(np.abs(back - scene).max()))
                        compared += 1
                if not it.next():
                    break
        if compared != len(elements):
            problems.append(f'only {compared} of {len(elements)} elements could be compared with the IFC')
        if worst > QUANT_TOLERANCE_M:
            problems.append(f'geometry differs from the IFC by {worst * 1000:.2f} mm (limit {QUANT_TOLERANCE_M * 1000:.0f} mm)')
        else:
            print(f'geometry: {compared} elements compared with the IFC, worst difference {worst * 1000:.3f} mm')
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('folder')
    ap.add_argument('--ifc')
    ap.add_argument('--expect-elements', type=int)
    ap.add_argument('--expect-tasks', type=int)
    ap.add_argument('--expect-stages', type=int)
    ap.add_argument('--expect-storeys', type=int)
    a = ap.parse_args(argv)
    expect = {k: v for k, v in (('elements', a.expect_elements), ('tasks', a.expect_tasks), ('stages', a.expect_stages), ('storeys', a.expect_storeys)) if v is not None}
    problems = check_bundle(a.folder, a.ifc, expect)
    if problems:
        print('PROBLEMS:')
        for p in problems:
            print(' -', p)
        sys.exit(1)
    with open(os.path.join(a.folder, 'bundle.json'), encoding='utf-8') as fh:
        b = json.load(fh)
    c = b['model']['counts']
    sizes = sum(ch['byteSize'] for ch in b['chunks'])
    print(f"OK: {c['elements']} elements, {c['tasks']} tasks, {c['stages']} stages, {c['chunks']} chunks, {sizes} bytes, unit scale {b['model']['unitScale']}, bbox {b['model']['bbox']}")


if __name__ == '__main__':
    main()
