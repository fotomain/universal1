"""WBS of an IFC model = the project exchange file (format kit8.pm.project, version 1) with stages and tasks ONLY.

Rules (documentation/BIM_WBS.html section 3, owner answers 2026-11-20):
  * a storey that holds elements = a stage, lowest elevation first (the order of building); storeys without elements are skipped (option skip_empty);
  * an element = a task inside its stage; granularity "auto": one task per element up to ELEMENT_LIMIT elements in the model, else one task per (storey, class, type name);
  * an element that is in no storey = a task in the last stage "Building / Site";
  * no lines, no costs, no links; every task is pinned (manualStartAt) to one working day after the other, so the plan is the same on every run;
  * the ids are uuid5 of (project, ifc guid / group key): a re-run makes the same ids.
The task keeps its origin in rowJSON: bimIfcGuid (one element) / bimGroupKey (a group); a stage keeps bimStoreyGuid.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import uuid

ELEMENT_LIMIT = 1500
OWNER_PLACEHOLDER = '00000000-0000-4000-8000-000000000000'
_NS = uuid.UUID('6ba7b811-9dad-11d1-80b4-00c04fd430c8')
SITE_STAGE_NAME = 'Building / Site'


def label(guid: str) -> str:
    return guid.replace('-', '_')


def make_guid(project_guid: str, kind: str, key: str) -> str:
    return str(uuid.uuid5(_NS, f'{project_guid}:{kind}:{key}'))


def add_working_days(day: dt.date, n: int) -> dt.date:
    """the n-th working day after `day` (Mon-Fri); n = 0 -> `day` itself moved to a working day"""
    while day.weekday() >= 5:
        day += dt.timedelta(days=1)
    for _ in range(n):
        day += dt.timedelta(days=1)
        while day.weekday() >= 5:
            day += dt.timedelta(days=1)
    return day


def element_task_text(el: dict) -> str:
    name = (el.get('name') or '').strip()
    if name:
        return name
    t = (el.get('typeName') or '').strip()
    tag = (el.get('tag') or '').strip()
    if t or tag:
        return (t + (' ' + tag if tag else '')).strip()
    return f"{el['ifcClass']} {el['ifcGuid'][:6]}"


def resolve_granularity(granularity: str, element_count: int) -> str:
    if granularity in ('element', 'group'):
        return granularity
    return 'element' if element_count <= ELEMENT_LIMIT else 'group'


def build_wbs(project_guid: str, project_name: str, storeys: list[dict], elements: list[dict], granularity: str = 'auto', skip_empty: bool = True,
              start_date: dt.date | None = None, source_name: str = '') -> dict:
    """storeys: [{ifcGuid, name, elevation}] (any order); elements: [{ifcGuid, ifcClass, name, typeName, tag, storeyIfcGuid|None}] in a stable order.
    Fills element['taskGUID'] and returns {'file': exchange file dict, 'granularity': used, 'tasks': n, 'stages': n, 'storeyStage': {storeyIfcGuid: stage guid}}."""
    start = start_date or dt.date.today()
    mode = resolve_granularity(granularity, len(elements))
    by_storey: dict = {}
    for el in elements:
        by_storey.setdefault(el.get('storeyIfcGuid'), []).append(el)

    stage_defs = []
    for s in sorted(storeys, key=lambda s: (s['elevation'], s['name'])):
        els = by_storey.get(s['ifcGuid'], [])
        if not els and skip_empty:
            continue
        stage_defs.append({'key': s['ifcGuid'], 'name': s['name'], 'elevation': s['elevation'], 'elements': els, 'storey': True})
    loose = by_storey.get(None, [])
    if loose:
        stage_defs.append({'key': 'site', 'name': SITE_STAGE_NAME, 'elevation': None, 'elements': loose, 'storey': False})

    p_label = label(project_guid)
    tasks = []
    storey_stage = {}
    day_index = 0
    for si, st in enumerate(stage_defs):
        stage_guid = make_guid(project_guid, 'stage', st['key'])
        storey_stage[st['key']] = stage_guid
        stage_json = {'rowKind': 'stage', 'taskDescription': st['name'], 'durationDays': 0}
        if st['storey']:
            stage_json['bimStoreyGuid'] = st['key']
            stage_json['notes'] = f"Storey {st['name']}, elevation {st['elevation']:.2f} m, {len(st['elements'])} elements."
        tasks.append({'rowGUID': stage_guid, 'treePath': f'{p_label}.{label(stage_guid)}', 'projectGUID': project_guid, 'rowOwnerGUID': OWNER_PLACEHOLDER,
                      'rowDuration': None, 'rowProgress': 0, 'orderInList': 1024 * (si + 1), 'rowJSON': stage_json})
        groups: dict = {}
        order = []
        for el in st['elements']:
            if mode == 'element':
                key = el['ifcGuid']
            else:
                key = f"{st['key']}|{el['ifcClass']}|{el.get('typeName') or ''}"
            if key not in groups:
                groups[key] = []
                order.append(key)
            groups[key].append(el)
        for ti, key in enumerate(order):
            members = groups[key]
            tguid = make_guid(project_guid, 'task', key)
            for el in members:
                el['taskGUID'] = tguid
            first = members[0]
            when = add_working_days(start, day_index)
            day_index += 1
            tj = {'rowKind': 'task', 'durationDays': 1, 'manualStartAt': dt.datetime(when.year, when.month, when.day).strftime('%Y-%m-%dT00:00:00.000Z'), 'bimIfcClass': first['ifcClass']}
            if mode == 'element':
                tj['taskDescription'] = element_task_text(first)
                tj['bimIfcGuid'] = first['ifcGuid']
            else:
                tn = (first.get('typeName') or '').strip() or first['ifcClass']
                tj['taskDescription'] = f"{first['ifcClass'].replace('Ifc', '')} · {tn} ({len(members)})"
                tj['bimGroupKey'] = hashlib.sha1(key.encode('utf-8')).hexdigest()[:16]
                tj['notes'] = f'{len(members)} elements of the class {first["ifcClass"]}, type "{tn}".'
            tasks.append({'rowGUID': tguid, 'treePath': f'{p_label}.{label(stage_guid)}.{label(tguid)}', 'projectGUID': project_guid, 'rowOwnerGUID': OWNER_PLACEHOLDER,
                          'rowDuration': None, 'rowProgress': 0, 'orderInList': 1024 * (ti + 1), 'rowJSON': tj})

    notes = f'BIM import of {source_name}: {len(stage_defs)} stages, {len([t for t in tasks if t["rowJSON"]["rowKind"] == "task"])} tasks. Only stages and tasks (no lines, no costs). Dates are placeholders: one working day a task, in the order of building.'
    project = {
        'rowGUID': project_guid, 'treePath': p_label, 'rowOwnerGUID': OWNER_PLACEHOLDER, 'rowDuration': None, 'rowProgress': 0, 'orderInList': 1024,
        'rowJSON': {'rowKind': 'project', 'name': project_name, 'durationDays': 0, 'projectStartAt': dt.datetime(start.year, start.month, start.day).strftime('%Y-%m-%dT00:00:00.000Z'),
                    'projectStartDate': start.isoformat(), 'skipWeekends': True, 'planDay': True, 'notes': notes},
    }
    file = {'format': 'kit8.pm.project', 'version': 1, 'exportedAt': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z'),
            'project': project, 'tasks': tasks, 'dependencies': []}
    n_tasks = len([t for t in tasks if t['rowJSON']['rowKind'] == 'task'])
    return {'file': file, 'granularity': mode, 'tasks': n_tasks, 'stages': len(stage_defs), 'storeyStage': storey_stage}
