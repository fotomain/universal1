#!/usr/bin/env python3
"""One conversion in a process of its own (started by server.py for every job).

  python worker.py <ifc file> <out folder> <options json>

Writes the bundle (bundle.json, project_data_<guid>.json, chunks/<hash>.bimc: write_bundle) into the out folder and tells its progress on stdout, one line each:
  P<TAB><percent><TAB><text>     progress
  D                              the bundle is written
  E<TAB><text>                   the conversion failed
Why a process: the memory of a big IFC (the IfcOpenShell model + the geometry cache) goes back to the system at once when the process ends, a crash or the kill of the system
(out of memory) takes only this job, not the server, and - the main reason - the destructor of the geometry iterator frees millions of small objects one by one and held the Python
lock for MINUTES on a 330 MB IFC (the server would not answer the polls of the app). The process ends with os._exit after the bundle is written: no destructor runs.
"""
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ifc_convert import convert_ifc, write_bundle  # noqa: E402


def main(argv):
    ifc, out, opts = argv[1], argv[2], json.loads(argv[3])
    code = 1
    try:
        res = convert_ifc(
            ifc, opts['projectGUID'], opts.get('name') or None, opts.get('sourceName') or None, opts.get('granularity', 'auto'), opts.get('skipEmpty', True),
            dt.date.fromisoformat(opts['startDate']) if opts.get('startDate') else None,
            progress=lambda p, t: print(f'P\t{int(p)}\t{t}', flush=True), include_openings=bool(opts.get('openings')), with_properties=opts.get('properties', True))
        write_bundle(res, out)
        print('D', flush=True)
        code = 0
    except Exception as e:  # noqa: BLE001 - the text goes to the user
        print('E\t' + ' '.join(str(e).split()), flush=True)
    sys.stdout.flush()
    os._exit(code)


if __name__ == '__main__':
    main(sys.argv)
