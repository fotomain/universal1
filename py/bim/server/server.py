#!/usr/bin/env python3
"""BIM converter server (phase 2 of documentation/BIM_WBS.html): a small stateless HTTP service. Standard library only + ifc_convert.

  GET  /health                    -> {"ok": true, "version": ...}
  POST /convert?projectGUID=&modelGUID=&name=&granularity=&skipEmpty=&startDate=&sourceName=
       body = the IFC bytes (application/octet-stream)  OR  {"url": "https://..."} (application/json; the host must be in BIM_URL_ALLOWLIST)
       header Authorization: Bearer <the user's Supabase JWT>
       -> 202 {"jobId": ...}
  GET  /jobs/<id>                 -> {"state": queued|running|done|failed, "progress": 0-100, "stepText": ..., "error": ..., "result": {...}}  (only for the user who started it)

What it does with the user's JWT: asks Supabase Auth who the user is, then uploads every chunk to the private Storage bucket "bim" as
<projectGUID>/<modelGUID>/<sha256>.bimc WITH THE USER'S OWN TOKEN - so the Storage policy (kit8/sql/start/start2_sql_code.sql PART 55) decides, the server holds no service key.
The server writes nothing else to the database: the app writes the rows through the RPCs bim_import_begin / _add_rows / _commit. No SUPABASE_URL = development mode:
no login, the chunks go to BIM_DEV_OUT (default ./out) and the result lists them.
Environment: SUPABASE_URL, SUPABASE_ANON_KEY, BIM_URL_ALLOWLIST (default raw.githubusercontent.com,media.githubusercontent.com), BIM_MAX_IFC_MB (200), BIM_SERVER_PORT (8765), BIM_CORS_ORIGINS (*), BIM_DEV_OUT.
"""
from __future__ import annotations

import datetime as dt
import gzip
import hashlib
import json
import os
import re
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ifc_convert import CONVERTER_VERSION, convert_ifc, write_bundle  # noqa: E402

UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()
JOB_TTL = 3600


def cfg(name: str, default: str = '') -> str:
    return os.environ.get(name, default)


def max_bytes() -> int:
    return int(float(cfg('BIM_MAX_IFC_MB', '200')) * 1024 * 1024)


def allowed_host(url: str) -> bool:
    p = urllib.parse.urlparse(url)
    hosts = [h.strip().lower() for h in cfg('BIM_URL_ALLOWLIST', 'raw.githubusercontent.com,media.githubusercontent.com').split(',') if h.strip()]
    return p.scheme == 'https' and (p.hostname or '').lower() in hosts


def verify_user(token: str) -> dict | None:
    base = cfg('SUPABASE_URL').rstrip('/')
    req = urllib.request.Request(base + '/auth/v1/user', headers={'Authorization': 'Bearer ' + token, 'apikey': cfg('SUPABASE_ANON_KEY')})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception:
        return None


def upload_chunk(token: str, project: str, model: str, h: str, data: bytes):
    base = cfg('SUPABASE_URL').rstrip('/')
    path = f'{project}/{model}/{h}.bimc'
    req = urllib.request.Request(f'{base}/storage/v1/object/bim/{path}', data=data, method='POST',
                                 headers={'Authorization': 'Bearer ' + token, 'apikey': cfg('SUPABASE_ANON_KEY'), 'Content-Type': 'application/octet-stream', 'x-upsert': 'false', 'Cache-Control': 'max-age=31536000'})
    try:
        urllib.request.urlopen(req, timeout=120).read()
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        if e.code in (400, 409) and ('Duplicate' in body or 'already exists' in body):
            return path   # the same content is there already (the name is its hash)
        raise RuntimeError(f'Storage refused the chunk ({e.code}): {body[:200]}')
    return path


def new_job(owner: str) -> str:
    jid = uuid.uuid4().hex
    with JOBS_LOCK:
        now = time.time()
        for k in [k for k, j in JOBS.items() if now - j['created'] > JOB_TTL]:
            del JOBS[k]
        JOBS[jid] = {'state': 'queued', 'progress': 0, 'stepText': 'Queued', 'error': None, 'result': None, 'owner': owner, 'created': now}
    return jid


def run_job(jid: str, ifc_path: str, token: str | None, q: dict):
    job = JOBS[jid]

    def progress(p, text):
        job['progress'], job['stepText'] = p, text

    try:
        job['state'] = 'running'
        start = dt.date.fromisoformat(q['startDate']) if q.get('startDate') else None
        res = convert_ifc(ifc_path, q['projectGUID'], q.get('name') or None, q.get('sourceName') or None, q.get('granularity', 'auto'), q.get('skipEmpty', '1') != '0', start,
                          progress=lambda p, t: progress(min(p, 85), t))
        out = res.to_json()
        out['model']['modelGUID'] = q['modelGUID']
        if token and cfg('SUPABASE_URL'):
            n = len(res.chunk_bytes)
            for i, (h, data) in enumerate(res.chunk_bytes.items()):
                progress(86 + int(13 * i / max(1, n)), f'Uploading chunk {i + 1} of {n}')
                upload_chunk(token, q['projectGUID'], q['modelGUID'], h, data)
            out['uploaded'] = n
        else:
            folder = os.path.join(cfg('BIM_DEV_OUT', './out'), q['modelGUID'])
            out['devFolder'] = write_bundle(res, folder)
            out['uploaded'] = 0
        for c in out['chunks']:
            c['storagePath'] = f"{q['projectGUID']}/{q['modelGUID']}/{c['hash']}.bimc"
        job['result'] = out
        job['state'], job['progress'], job['stepText'] = 'done', 100, 'Done'
    except Exception as e:  # noqa: BLE001 - the text goes to the user
        job['state'], job['error'], job['stepText'] = 'failed', str(e), 'Failed'
    finally:
        try:
            os.unlink(ifc_path)
        except OSError:
            pass


class Handler(BaseHTTPRequestHandler):
    server_version = 'bim-server/1'

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', cfg('BIM_CORS_ORIGINS', '*'))
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type, x-client-info, apikey')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    def _json(self, code: int, body: dict):
        raw = json.dumps(body, ensure_ascii=False).encode('utf-8')
        gz = 'gzip' in (self.headers.get('Accept-Encoding') or '') and len(raw) > 2048
        if gz:
            raw = gzip.compress(raw, 5)
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        if gz:
            self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _token(self) -> str | None:
        h = self.headers.get('Authorization') or ''
        return h[7:].strip() if h.lower().startswith('bearer ') else None

    def _owner(self) -> tuple[str | None, str | None]:
        """(owner id, error text). Development mode (no SUPABASE_URL) = owner 'dev'."""
        if not cfg('SUPABASE_URL'):
            return 'dev', None
        tok = self._token()
        if not tok:
            return None, 'Sign in first (no token).'
        u = verify_user(tok)
        if not u or not u.get('id'):
            return None, 'The sign in is not valid.'
        return u['id'], None

    def do_GET(self):
        p = urllib.parse.urlparse(self.path)
        if p.path == '/health':
            return self._json(200, {'ok': True, 'version': CONVERTER_VERSION, 'mode': 'supabase' if cfg('SUPABASE_URL') else 'development'})
        m = re.match(r'^/jobs/([0-9a-f]{32})$', p.path)
        if m:
            owner, err = self._owner()
            if err:
                return self._json(401, {'error': err})
            job = JOBS.get(m.group(1))
            if not job or job['owner'] != owner:
                return self._json(404, {'error': 'No such job.'})
            return self._json(200, {k: job[k] for k in ('state', 'progress', 'stepText', 'error', 'result')})
        self._json(404, {'error': 'Not found.'})

    def do_POST(self):
        p = urllib.parse.urlparse(self.path)
        if p.path != '/convert':
            return self._json(404, {'error': 'Not found.'})
        owner, err = self._owner()
        if err:
            return self._json(401, {'error': err})
        q = {k: v[0] for k, v in urllib.parse.parse_qs(p.query).items()}
        for k in ('projectGUID', 'modelGUID'):
            if not UUID_RE.match(q.get(k, '')):
                return self._json(400, {'error': f'{k} must be a GUID.'})
        if q.get('granularity', 'auto') not in ('auto', 'element', 'group'):
            return self._json(400, {'error': 'granularity must be auto, element or group.'})
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > max_bytes():
            return self._json(413, {'error': f'The IFC must be 1 byte to {max_bytes() // (1024 * 1024)} MB.'})
        body = self.rfile.read(length)
        if (self.headers.get('Content-Type') or '').startswith('application/json'):
            try:
                url = json.loads(body)['url']
            except Exception:
                return self._json(400, {'error': 'The JSON body needs {"url": ...}.'})
            if not allowed_host(url):
                return self._json(400, {'error': 'This host is not allowed (BIM_URL_ALLOWLIST).'})
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    body = r.read(max_bytes() + 1)
            except Exception as e:  # noqa: BLE001
                return self._json(400, {'error': f'The url could not be read: {e}'})
            if len(body) > max_bytes():
                return self._json(413, {'error': 'The IFC is too big.'})
            q.setdefault('sourceName', os.path.basename(urllib.parse.urlparse(url).path))
        if b'ISO-10303-21' not in body[:200]:
            return self._json(400, {'error': 'This is not an IFC (STEP) file.'})
        tf = tempfile.NamedTemporaryFile(suffix='.ifc', delete=False)
        tf.write(body)
        tf.close()
        jid = new_job(owner)
        threading.Thread(target=run_job, args=(jid, tf.name, self._token(), q), daemon=True).start()
        self._json(202, {'jobId': jid})


def main():
    port = int(cfg('BIM_SERVER_PORT', '8765'))
    srv = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print(f'bim-server {CONVERTER_VERSION} on :{port} ({"supabase" if cfg("SUPABASE_URL") else "development"} mode)')
    srv.serve_forever()


if __name__ == '__main__':
    main()
