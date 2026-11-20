#!/usr/bin/env python3
"""BIM converter server (phase 2 of documentation/BIM_WBS.html): a small stateless HTTP service. Standard library only + ifc_convert.

  GET  /health                    -> {"ok": true, "version": ...}
  POST /convert?projectGUID=&modelGUID=&name=&granularity=&skipEmpty=&startDate=&sourceName=&openings=1&properties=0
       body = the IFC bytes (application/octet-stream)  OR  {"url": "https://..."} (application/json; the host must be in BIM_URL_ALLOWLIST)
       header Authorization: Bearer <the user's Supabase JWT>
       -> 202 {"jobId": ...}
  GET  /jobs/<id>                 -> {"state": queued|running|done|failed, "progress": 0-100, "stepText": ..., "error": ..., "result": {...}}  (only for the user who started it)

What it does with the user's JWT: asks Supabase Auth who the user is, then uploads every chunk to the private Storage bucket "bim" as
<projectGUID>/<modelGUID>/<sha256>.bimc WITH THE USER'S OWN TOKEN - so the Storage policy (kit8/sql/start/start2_sql_code.sql PART 55) decides, the server holds no service key.
The server writes nothing else to the database: the app writes the rows through the RPCs bim_import_begin / _add_rows / _commit. No SUPABASE_URL = development mode:
no login, the chunks go to BIM_DEV_OUT (default ./out) and the result lists them.
Environment: SUPABASE_URL, SUPABASE_ANON_KEY, BIM_URL_ALLOWLIST (default raw.githubusercontent.com,media.githubusercontent.com,huggingface.co), BIM_MAX_IFC_MB (500), BIM_SERVER_PORT (8765), BIM_CORS_ORIGINS (*), BIM_DEV_OUT.
"""
from __future__ import annotations

import datetime as dt
import gzip
import hashlib
import json
import os
import re
import shutil
import subprocess
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
from ifc_convert import CONVERTER_VERSION  # noqa: E402

UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()
JOB_TTL = 3600


def cfg(name: str, default: str = '') -> str:
    return os.environ.get(name, default)


def max_bytes() -> int:
    return int(float(cfg('BIM_MAX_IFC_MB', '500')) * 1024 * 1024)


JSON_BODY_MAX = 1 << 20   # the body of {"url": ...} is small


class TooBig(Exception):
    pass


def copy_limited(src, dst, limit: int, block: int = 1 << 20) -> int:
    """src -> dst in blocks, at most `limit` bytes (TooBig when the source is longer)"""
    n = 0
    while True:
        b = src.read(block)
        if not b:
            return n
        n += len(b)
        if n > limit:
            raise TooBig()
        dst.write(b)


def copy_exact(src, dst, length: int, block: int = 1 << 20) -> None:
    """exactly `length` bytes of src -> dst in blocks (a short body is an error)"""
    left = length
    while left > 0:
        b = src.read(min(block, left))
        if not b:
            raise IOError('the upload stopped before the end')
        dst.write(b)
        left -= len(b)


def allowed_host(url: str) -> bool:
    p = urllib.parse.urlparse(url)
    hosts = [h.strip().lower() for h in cfg('BIM_URL_ALLOWLIST', 'raw.githubusercontent.com,media.githubusercontent.com,huggingface.co').split(',') if h.strip()]
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


def convert_in_process(job: dict, ifc_path: str, out_dir: str, q: dict) -> None:
    """runs worker.py (one process per job) and follows its progress; raises with the text of the failure. A job that runs longer than BIM_JOB_MAX_MIN (90) is killed."""
    opts = {'projectGUID': q['projectGUID'], 'name': q.get('name') or None, 'sourceName': q.get('sourceName') or None, 'granularity': q.get('granularity', 'auto'),
            'skipEmpty': q.get('skipEmpty', '1') != '0', 'startDate': q.get('startDate') or None, 'openings': q.get('openings') == '1', 'properties': q.get('properties', '1') != '0'}
    err_log = tempfile.NamedTemporaryFile(prefix='bim_worker_', suffix='.log', delete=False)
    proc = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'worker.py'), ifc_path, out_dir, json.dumps(opts)],
                            stdout=subprocess.PIPE, stderr=err_log, text=True, bufsize=1)
    limit = float(cfg('BIM_JOB_MAX_MIN', '90')) * 60
    timed_out: list = []

    def on_timeout():
        timed_out.append(True)
        proc.kill()

    timer = threading.Timer(limit, on_timeout)
    timer.start()
    failed, done = None, False
    try:
        for line in proc.stdout:
            kind, _, rest = line.rstrip('\n').partition('\t')
            if kind == 'P':
                pct, _, text = rest.partition('\t')
                job['progress'], job['stepText'] = min(int(pct or 0), 85), text
            elif kind == 'D':
                done = True
            elif kind == 'E':
                failed = rest
        code = proc.wait()
    finally:
        timer.cancel()
        if proc.poll() is None:
            proc.kill()
        err_log.close()
    tail = ''
    try:
        with open(err_log.name, encoding='utf-8', errors='replace') as fh:
            tail = fh.read()[-400:].strip()
        os.unlink(err_log.name)
    except OSError:
        pass
    if failed is not None:
        raise RuntimeError(failed)
    if code != 0 or not done:
        why = f'the time limit of {limit / 60:.0f} minutes' if timed_out else (f'killed by signal {-code}: probably out of memory' if code < 0 else f'exit code {code}')
        raise RuntimeError(f'The conversion stopped ({why}).' + (f' {tail}' if tail else ''))


def run_job(jid: str, ifc_path: str, token: str | None, q: dict):
    job = JOBS[jid]
    supabase_mode = bool(token and cfg('SUPABASE_URL'))
    out_dir = tempfile.mkdtemp(prefix='bim_out_') if supabase_mode else os.path.join(cfg('BIM_DEV_OUT', './out'), q['modelGUID'])
    try:
        job['state'] = 'running'
        convert_in_process(job, ifc_path, out_dir, q)
        with open(os.path.join(out_dir, 'bundle.json'), encoding='utf-8') as fh:
            out = json.load(fh)
        pfile = [f for f in os.listdir(out_dir) if f.startswith('project_data_') and f.endswith('.json')][0]
        with open(os.path.join(out_dir, pfile), encoding='utf-8') as fh:
            out['project'] = json.load(fh)
        out['model']['modelGUID'] = q['modelGUID']
        if supabase_mode:
            n = len(out['chunks'])
            for i, c in enumerate(out['chunks']):
                job['progress'], job['stepText'] = 86 + int(13 * i / max(1, n)), f'Uploading chunk {i + 1} of {n}'
                with open(os.path.join(out_dir, 'chunks', c['hash'] + '.bimc'), 'rb') as fh:
                    upload_chunk(token, q['projectGUID'], q['modelGUID'], c['hash'], fh.read())
            out['uploaded'] = n
        else:
            out['devFolder'] = {'bundle': os.path.join(out_dir, 'bundle.json'), 'project': os.path.join(out_dir, pfile), 'chunks': len(out['chunks'])}
            out['uploaded'] = 0
        for c in out['chunks']:
            c['storagePath'] = f"{q['projectGUID']}/{q['modelGUID']}/{c['hash']}.bimc"
        job['result'] = out
        job['state'], job['progress'], job['stepText'] = 'done', 100, 'Done'
    except Exception as e:  # noqa: BLE001 - the text goes to the user
        job['state'], job['error'], job['stepText'] = 'failed', str(e), 'Failed'
    finally:
        if supabase_mode:
            shutil.rmtree(out_dir, ignore_errors=True)
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
        is_json = (self.headers.get('Content-Type') or '').startswith('application/json')
        if length <= 0 or length > (JSON_BODY_MAX if is_json else max_bytes()):
            return self._json(413, {'error': f'The IFC must be 1 byte to {max_bytes() // (1024 * 1024)} MB.'})
        # the IFC goes to a temp file in 1 MB blocks (a 340 MB file is never in memory as bytes)
        tf = tempfile.NamedTemporaryFile(suffix='.ifc', delete=False)

        def refuse(code: int, text: str):
            tf.close()
            try:
                os.unlink(tf.name)
            except OSError:
                pass
            return self._json(code, {'error': text})

        try:
            if is_json:
                try:
                    url = json.loads(self.rfile.read(length))['url']
                except Exception:
                    return refuse(400, 'The JSON body needs {"url": ...}.')
                if not allowed_host(url):
                    return refuse(400, 'This host is not allowed (BIM_URL_ALLOWLIST).')
                try:
                    with urllib.request.urlopen(url, timeout=60) as r:
                        copy_limited(r, tf, max_bytes())
                except TooBig:
                    return refuse(413, 'The IFC is too big.')
                except Exception as e:  # noqa: BLE001
                    return refuse(400, f'The url could not be read: {e}')
                q.setdefault('sourceName', os.path.basename(urllib.parse.urlparse(url).path))
            else:
                try:
                    copy_exact(self.rfile, tf, length)
                except Exception as e:  # noqa: BLE001
                    return refuse(400, f'The file could not be received: {e}')
            tf.close()
            with open(tf.name, 'rb') as fh:
                head = fh.read(200)
        except Exception as e:  # noqa: BLE001
            return refuse(500, f'The file could not be stored: {e}')
        if b'ISO-10303-21' not in head:
            try:
                os.unlink(tf.name)
            except OSError:
                pass
            return self._json(400, {'error': 'This is not an IFC (STEP) file.'})
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
