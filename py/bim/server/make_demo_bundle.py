#!/usr/bin/env python3
"""Packs a converted bundle folder into ONE json for the offline demo viewer (kit8/pm/bim/view/BimExampleDemo.tsx, route /pm/bim/example): the manifest-like data, the elements, the
stages / tasks as a flat list and the chunks as base64. No database, no network - the 3D view and the two-way highlight can be tried without a login.
  python make_demo_bundle.py <bundle folder> <out.json>"""
import base64
import glob
import json
import os
import sys


def main(folder, out):
    with open(os.path.join(folder, 'bundle.json'), encoding='utf-8') as fh:
        b = json.load(fh)
    pf = glob.glob(os.path.join(folder, 'project_data_*.json'))[0]
    with open(pf, encoding='utf-8') as fh:
        project = json.load(fh)
    chunks = []
    for c in b['chunks']:
        with open(os.path.join(folder, 'chunks', c['hash'] + '.bimc'), 'rb') as fh:
            chunks.append({'hash': c['hash'], 'storeyIfcGuid': c['storeyIfcGuid'], 'part': c['part'], 'byteSize': c['byteSize'], 'base64': base64.b64encode(fh.read()).decode('ascii')})
    tasks = [{'guid': t['rowGUID'], 'path': t['treePath'], 'kind': t['rowJSON']['rowKind'], 'text': t['rowJSON']['taskDescription'], 'order': t['orderInList']} for t in project['tasks']]
    demo = {'model': b['model'], 'storeys': b['storeys'], 'elements': [{k: e[k] for k in ('ifcGuid', 'ifcClass', 'name', 'typeName', 'storeyIfcGuid', 'taskGUID', 'chunkHash', 'elementNumber', 'bbox')} for e in b['elements']], 'tasks': tasks, 'chunks': chunks,
            'properties': {p['ifcGuid']: p['rowJSON'] for p in b['properties']}}
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(demo, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{out}: {os.path.getsize(out)} bytes, {len(chunks)} chunks, {len(demo["elements"])} elements, {len(tasks)} tasks')


if __name__ == '__main__':
    main(*sys.argv[1:3])
