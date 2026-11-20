"""IFC -> BIM bundle: the chunks (BIMC v1, one per storey), the rows of the bim_ tables, the properties and the WBS (project exchange file).

IfcOpenShell does the geometry (the geometry iterator, many threads). Everything here is deterministic: the same IFC gives the same bytes and ids.
Memory: the vertices of all elements are held as float64 until the model origin is known (a 450 KB IFC = a few MB; 100 MB IFC = a few GB: see README, limit BIM_MAX_IFC_MB).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import os
from dataclasses import dataclass, field

import numpy as np

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element as ue
import ifcopenshell.util.unit as uu

from bimc import MAX_ELEMENTS_PER_CHUNK, Chunk, ChunkElement, write_chunk
from wbs import build_wbs

CONVERTER_VERSION = 'bim-converter-1'
SKIP_CLASSES = {'IfcOpeningElement', 'IfcSpace', 'IfcAnnotation', 'IfcGrid', 'IfcVirtualElement', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey'}
# grey per class when the model has no colour (RGB 0..255)
CLASS_COLOURS = {
    'IfcWall': (200, 198, 192), 'IfcWallStandardCase': (200, 198, 192), 'IfcSlab': (170, 170, 172), 'IfcColumn': (150, 150, 155), 'IfcBeam': (150, 150, 155),
    'IfcRoof': (160, 110, 100), 'IfcWindow': (140, 190, 220), 'IfcDoor': (150, 110, 70), 'IfcStair': (180, 175, 160), 'IfcRailing': (110, 110, 120),
    'IfcFurnishingElement': (190, 160, 120), 'IfcCovering': (215, 212, 205),
}
DEFAULT_COLOUR = (185, 185, 190)
OPENING_COLOUR = (70, 140, 230, 110)   # an opening = a translucent blue solid in the hole


@dataclass
class ConvertResult:
    model: dict
    storeys: list
    chunks: list
    elements: list
    properties: list
    project_file: dict
    wbs: dict
    chunk_bytes: dict = field(default_factory=dict)

    def to_json(self) -> dict:
        return {'model': self.model, 'storeys': self.storeys, 'chunks': self.chunks, 'elements': self.elements, 'properties': self.properties,
                'project': self.project_file, 'wbs': {k: v for k, v in self.wbs.items() if k != 'file'}}


def _json_safe(v):
    if v is None or isinstance(v, (bool, int, str)):
        return v
    if isinstance(v, float):
        return v if math.isfinite(v) else None
    if isinstance(v, dict):
        return {str(k): _json_safe(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set)):
        return [_json_safe(x) for x in v]
    return str(v)


def _storey_of(e):
    """the storey an element belongs to (climbing through spaces and aggregates), or None (site / building / nothing)"""
    seen = 0
    cur = e
    while cur is not None and seen < 8:
        seen += 1
        c = ue.get_container(cur)
        if c is None:
            c = ue.get_aggregate(cur)
        if c is None:
            return None
        if c.is_a('IfcBuildingStorey'):
            return c
        if c.is_a('IfcBuilding') or c.is_a('IfcSite') or c.is_a('IfcProject'):
            return None
        cur = c
    return None


def _material_colour(m, cls: str):
    try:
        d = m.diffuse
        rgb = (d.r(), d.g(), d.b())
        a = 1.0
        try:
            t = m.transparency
            if t == t and t > 0:
                a = max(0.05, 1.0 - float(t))
        except Exception:
            pass
        if all(0.0 <= c <= 1.0 for c in rgb):
            return (int(round(rgb[0] * 255)), int(round(rgb[1] * 255)), int(round(rgb[2] * 255)), int(round(a * 255)))
    except Exception:
        pass
    r, g, b = CLASS_COLOURS.get(cls, DEFAULT_COLOUR)
    return (r, g, b, 255)


def _props(e) -> dict:
    out = {}
    try:
        psets = ue.get_psets(e)
    except Exception:
        psets = {}
    for name, vals in psets.items():
        if isinstance(vals, dict):
            out[name] = {k: _json_safe(v) for k, v in vals.items() if k != 'id'}
    return out


def convert_ifc(path: str, project_guid: str, project_name: str | None = None, source_name: str | None = None, granularity: str = 'auto', skip_empty: bool = True,
                start_date: dt.date | None = None, threads: int | None = None, with_properties: bool = True, progress=None, include_openings: bool = False) -> ConvertResult:
    """include_openings: the openings (IfcOpeningElement = the voids of windows / doors cut out of a wall) become elements of their own (a translucent blue solid in the hole, a task in the storey of
    the wall they are cut from). Off by default: then they are only holes in the wall mesh."""
    def say(p, text):
        if progress:
            progress(p, text)

    say(2, 'Reading the IFC')
    with open(path, 'rb') as fh:
        raw_sha = hashlib.sha256(fh.read()).hexdigest()
    f = ifcopenshell.open(path)
    unit_scale = float(uu.calculate_unit_scale(f))
    proj = (f.by_type('IfcProject') or [None])[0]
    proj_name = (project_name or (proj.Name if proj is not None and proj.Name else None) or os.path.splitext(os.path.basename(path))[0]).strip()
    src = source_name or os.path.basename(path)

    storeys_raw = f.by_type('IfcBuildingStorey')
    storey_info = {}
    for s in storeys_raw:
        elev = float(s.Elevation or 0.0) * unit_scale
        storey_info[s.GlobalId] = {'ifcGuid': s.GlobalId, 'name': (s.Name or s.LongName or 'Storey').strip() or 'Storey', 'elevation': round(elev, 4)}

    say(8, 'Making the geometry')
    settings = ifcopenshell.geom.settings()
    settings.set('use-world-coords', True)
    it = ifcopenshell.geom.iterator(settings, f, threads or max(1, (os.cpu_count() or 2)))
    shapes = []   # (guid, class, name, typeName, tag, storeyGuid, verts, faces, face_mat_idx_local, local_palette, props)
    if it.initialize():
        n = 0
        while True:
            sh = it.get()
            n += 1
            product = f.by_id(sh.id)
            cls = product.is_a()
            is_opening = product.is_a('IfcOpeningElement')
            if (cls not in SKIP_CLASSES or (is_opening and include_openings)) and not product.is_a('IfcSpace'):
                gm = sh.geometry
                verts = np.array(gm.verts, dtype=np.float64).reshape(-1, 3)
                faces = np.array(gm.faces, dtype=np.int64).reshape(-1, 3)
                if len(verts) and len(faces):
                    mat_ids = np.array(gm.material_ids, dtype=np.int64).reshape(-1)
                    if len(mat_ids) != len(faces):
                        mat_ids = np.zeros(len(faces), dtype=np.int64)
                    colours = [_material_colour(m, cls) for m in gm.materials] or [(*CLASS_COLOURS.get(cls, DEFAULT_COLOUR), 255)]
                    if is_opening:
                        colours = [OPENING_COLOUR] * len(colours)
                    mat_ids = np.where((mat_ids >= 0) & (mat_ids < len(colours)), mat_ids, 0)
                    host = None
                    if is_opening:
                        voids = getattr(product, 'VoidsElements', None) or ()
                        host = voids[0].RelatingBuildingElement if voids else None
                    storey = _storey_of(host if host is not None else product)
                    typ = ue.get_type(product)
                    shapes.append({
                        'guid': product.GlobalId, 'cls': cls, 'name': ((('Opening in ' + (getattr(host, 'Name', None) or host.is_a())) if host is not None else (getattr(product, 'Name', None) or '')).strip() if is_opening else (getattr(product, 'Name', None) or '').strip()), 'typeName': ('Opening' if is_opening else ((typ.Name if typ is not None else None) or getattr(product, 'ObjectType', None) or '').strip()),
                        'tag': (getattr(product, 'Tag', None) or '').strip(), 'storey': storey.GlobalId if storey is not None else None,
                        'verts': verts, 'faces': faces, 'mat': mat_ids, 'colours': colours, 'product': product})
            if not it.next():
                break
            if n % 50 == 0:
                say(8 + min(50, n // 10), f'Geometry of {n} shapes')
    if not shapes:
        raise ValueError('The IFC has no element with geometry.')
    # a stable order: by storey elevation, then class, then guid (the same file gives the same chunks)
    shapes.sort(key=lambda s: (storey_info[s['storey']]['elevation'] if s['storey'] in storey_info else 1e9, s['cls'], s['guid']))

    say(60, 'Placing the model')
    all_v = np.concatenate([s['verts'] for s in shapes], axis=0)
    mn, mx = all_v.min(axis=0), all_v.max(axis=0)
    cx, cy, cz = float((mn[0] + mx[0]) / 2), float((mn[1] + mx[1]) / 2), float(mn[2])
    shift = np.array([cx, cy, cz])

    def to_scene(v: np.ndarray) -> np.ndarray:
        # IFC: X east, Y north, Z up (metres).  Scene: X east, Y up, Z south: (x, y, z) -> (x, z, -y), the origin shifted; a rotation, the winding stays
        return np.stack([v[:, 0] - cx, v[:, 2] - cz, -(v[:, 1] - cy)], axis=1)

    for s in shapes:
        s['scene'] = to_scene(s['verts'])
    bbox = [round(float(x), 4) for x in (*to_scene(mn.reshape(1, 3))[0], *to_scene(mx.reshape(1, 3))[0])]
    sb = to_scene(np.array([mn, mx]))
    bbox = [round(float(x), 4) for x in (*sb.min(axis=0), *sb.max(axis=0))]

    say(66, 'Writing the chunks')
    groups: dict = {}
    for s in shapes:
        groups.setdefault(s['storey'], []).append(s)
    storey_order = [g for g in sorted((g for g in groups if g in storey_info), key=lambda g: (storey_info[g]['elevation'], storey_info[g]['name']))]
    if None in groups:
        storey_order.append(None)
    chunks_json, chunk_bytes, elements, storeys_json = [], {}, [], []
    el_by_guid = {}
    for si, sg in enumerate(storey_order):
        members = groups[sg]
        part = 0
        for start in range(0, len(members), MAX_ELEMENTS_PER_CHUNK):
            part_members = members[start:start + MAX_ELEMENTS_PER_CHUNK]
            palette, pal_index = [], {}
            ces = []
            for s in part_members:
                local = []
                for c in s['colours']:
                    if c not in pal_index:
                        if len(palette) >= 255:
                            c = (c[0] & 0xF0, c[1] & 0xF0, c[2] & 0xF0, c[3])
                        if c not in pal_index:
                            pal_index[c] = len(palette)
                            palette.append(c)
                    local.append(pal_index[c])
                ces.append(ChunkElement(s['guid'], s['scene'], s['faces'], np.array(local, dtype=np.int64)[s['mat']]))
            ch: Chunk = write_chunk(ces, palette)
            chunk_bytes[ch.sha256] = ch.data
            chunks_json.append({'hash': ch.sha256, 'byteSize': len(ch.data), 'storeyIfcGuid': sg, 'part': part, 'formatVersion': 1, 'vertexCount': ch.vertex_count,
                                'elementCount': ch.element_count, 'bboxMin': [round(x, 5) for x in ch.bbox_min], 'bboxSize': [round(x, 5) for x in ch.bbox_size]})
            for i, s in enumerate(part_members):
                el = {'ifcGuid': s['guid'], 'ifcClass': s['cls'], 'name': s['name'], 'typeName': s['typeName'], 'tag': s['tag'], 'storeyIfcGuid': sg,
                      'chunkHash': ch.sha256, 'elementNumber': i, 'bbox': list(ch.element_bboxes[i])}
                elements.append(el)
                el_by_guid[s['guid']] = s
            part += 1
        if sg is not None:
            storeys_json.append({**storey_info[sg], 'orderInList': si + 1, 'chunkHashes': [c['hash'] for c in chunks_json if c['storeyIfcGuid'] == sg]})
        else:
            storeys_json.append({'ifcGuid': None, 'name': 'Building / Site', 'elevation': None, 'orderInList': si + 1, 'chunkHashes': [c['hash'] for c in chunks_json if c['storeyIfcGuid'] is None]})

    say(80, 'Making the work breakdown')
    wbs = build_wbs(project_guid, proj_name, [storey_info[g] for g in storey_info], elements, granularity, skip_empty, start_date, src)

    properties = []
    if with_properties:
        say(90, 'Reading the properties')
        for el in elements:
            p = el_by_guid[el['ifcGuid']]['product']
            data = {'attributes': {'Class': el['ifcClass'], 'GlobalId': el['ifcGuid'], 'Name': el['name'], 'Type': el['typeName'], 'Tag': el['tag']}, 'sets': _props(p)}
            properties.append({'ifcGuid': el['ifcGuid'], 'rowJSON': data})

    model = {
        'sourceName': src, 'sourceSha256': raw_sha, 'ifcSchema': f.schema, 'converterVersion': CONVERTER_VERSION, 'unitScale': unit_scale,
        'originShift': [round(float(x), 5) for x in shift], 'bbox': bbox, 'projectName': proj_name,
        'counts': {'storeys': len(storeys_json), 'elements': len(elements), 'chunks': len(chunks_json), 'tasks': wbs['tasks'], 'stages': wbs['stages'], 'properties': len(properties)},
    }
    storey_stage = wbs['storeyStage']
    for s in storeys_json:
        s['stageGUID'] = storey_stage.get(s['ifcGuid'] if s['ifcGuid'] is not None else 'site')
    say(100, 'Done')
    return ConvertResult(model=model, storeys=storeys_json, chunks=chunks_json, elements=elements, properties=properties, project_file=wbs['file'], wbs=wbs, chunk_bytes=chunk_bytes)


def write_bundle(result: ConvertResult, out_dir: str) -> dict:
    """The files of a bundle on disk: bundle.json (everything but the chunks and the project file), project_data_<guid>.json, chunks/<hash>.bimc"""
    os.makedirs(os.path.join(out_dir, 'chunks'), exist_ok=True)
    guid = result.project_file['project']['rowGUID']
    pfile = os.path.join(out_dir, f'project_data_{guid}.json')
    with open(pfile, 'w', encoding='utf-8') as fh:
        json.dump(result.project_file, fh, ensure_ascii=False, indent=1)
    body = result.to_json()
    body.pop('project', None)
    bfile = os.path.join(out_dir, 'bundle.json')
    with open(bfile, 'w', encoding='utf-8') as fh:
        json.dump(body, fh, ensure_ascii=False, indent=1)
    for h, data in result.chunk_bytes.items():
        with open(os.path.join(out_dir, 'chunks', f'{h}.bimc'), 'wb') as fh:
            fh.write(data)
    return {'bundle': bfile, 'project': pfile, 'chunks': len(result.chunk_bytes)}
