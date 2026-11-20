#!/usr/bin/env python3
"""Command line converter: IFC (file or https url) -> bundle folder (bundle.json, project_data_<guid>.json, chunks/*.bimc).

  python ifc_to_bim.py <file.ifc | https://...ifc> --project <project guid> --out <folder> [--name "Project name"] [--granularity auto|element|group] [--keep-empty] [--start 2026-11-20]
Example 1 of the plan:  python ifc_to_bim.py ../../../kit8/pm/bim/examples/example1/Structure_Walls.ifc --project aabd1dde-97e6-4359-97e4-0efcb847589b --out ../../../kit8/pm/bim/examples/example1/out
"""
import argparse
import datetime as dt
import os
import sys
import tempfile
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ifc_convert import convert_ifc, write_bundle  # noqa: E402


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('source')
    ap.add_argument('--project', required=True, help='project GUID the tasks are made for')
    ap.add_argument('--out', required=True)
    ap.add_argument('--name')
    ap.add_argument('--granularity', default='auto', choices=['auto', 'element', 'group'])
    ap.add_argument('--keep-empty', action='store_true', help='keep storeys without elements as empty stages')
    ap.add_argument('--start', help='project start date YYYY-MM-DD (default today)')
    ap.add_argument('--no-properties', action='store_true')
    ap.add_argument('--openings', action='store_true', help='the openings (windows / doors cut out of a wall) become elements and tasks of their own')
    a = ap.parse_args(argv)
    path, tmp, src_name = a.source, None, os.path.basename(a.source)
    if a.source.startswith('http://') or a.source.startswith('https://'):
        tmp = tempfile.NamedTemporaryFile(suffix='.ifc', delete=False)
        with urllib.request.urlopen(a.source, timeout=60) as r:
            tmp.write(r.read())
        tmp.close()
        path, src_name = tmp.name, os.path.basename(a.source.split('?')[0]).replace('%20', ' ')
    try:
        res = convert_ifc(path, a.project, a.name, src_name, a.granularity, not a.keep_empty, dt.date.fromisoformat(a.start) if a.start else None,
                          with_properties=not a.no_properties, include_openings=a.openings, progress=lambda p, t: print(f'[{p:3d}%] {t}'))
        info = write_bundle(res, a.out)
    finally:
        if tmp:
            os.unlink(tmp.name)
    c = res.model['counts']
    print(f"OK: {c['storeys']} storeys, {c['elements']} elements, {c['stages']} stages, {c['tasks']} tasks, {c['chunks']} chunks ({sum(len(b) for b in res.chunk_bytes.values())} bytes)")
    print(info)


if __name__ == '__main__':
    main()
