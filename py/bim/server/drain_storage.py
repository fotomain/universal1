#!/usr/bin/env python3
"""Removes the chunk files that bim_storage_cleanup_table lists (a deleted project / model / failed import) through the Storage API, then empties the queue.
  SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=... python drain_storage.py [--dry]
The service key stays on the machine that runs this script (never in the app, never in .env of the app). --dry prints the paths only.
Reads the queue through PostgREST (table bim_storage_cleanup_table: the service role bypasses row level security)."""
import json
import os
import sys
import urllib.request


def call(method, url, key, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def main(argv):
    base, key = os.environ.get('SUPABASE_URL', '').rstrip('/'), os.environ.get('SUPABASE_SERVICE_KEY', '')
    if not base or not key:
        sys.exit('Set SUPABASE_URL and SUPABASE_SERVICE_KEY.')
    rows = call('GET', f'{base}/rest/v1/bim_storage_cleanup_table?select=storagePath&limit=1000', key)
    paths = [r['storagePath'] for r in rows]
    print(f'{len(paths)} file(s) waiting')
    if '--dry' in argv or not paths:
        for p in paths:
            print(' ', p)
        return
    call('DELETE', f'{base}/storage/v1/object/bim', key, {'prefixes': paths})   # Storage API: removes the files and their rows
    for i in range(0, len(paths), 100):
        part = ','.join('"' + p.replace('"', '') + '"' for p in paths[i:i + 100])
        call('DELETE', f'{base}/rest/v1/bim_storage_cleanup_table?storagePath=in.({part})', key)
    print('removed and the queue is empty (run again if there were more than 1000)')


if __name__ == '__main__':
    main(sys.argv[1:])
