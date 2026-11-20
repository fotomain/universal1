"""Tests of the BIM converter:  python -m unittest discover -s tests -v   (from py/bim/server; needs ifcopenshell + numpy).
No pytest needed. The tiny IFC is made by tests/tiny_ifc.py; example 1 is checked when kit8/pm/bim/examples/example1 is there."""
import datetime as dt
import http.client
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402

import server as srv  # noqa: E402
from bimc import ChunkElement, read_chunk, write_chunk  # noqa: E402
from check_bim_import import check_bundle  # noqa: E402
from ifc_convert import convert_ifc, write_bundle  # noqa: E402
from tiny_ifc import make_tiny_ifc  # noqa: E402
from wbs import add_working_days, resolve_granularity  # noqa: E402

PROJECT = '11111111-1111-4111-8111-111111111111'
EXAMPLE1 = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE)))), 'kit8', 'pm', 'bim', 'examples', 'example1', 'Structure_Walls.ifc')


def box(guid, x0, y0, z0, x1, y1, z1):
    v = np.array([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], dtype=np.float64)
    f = np.array([[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]])
    return ChunkElement(guid, v, f, np.zeros(12, dtype=np.int64))


class BimcTest(unittest.TestCase):
    def test_roundtrip_and_picking(self):
        ch = write_chunk([box('A' * 22, 0, 0, 0, 2, 3, 4), box('B' * 22, 10, 0, 0, 11, 1, 1)], [(200, 10, 10, 255), (10, 200, 10, 128)])
        rc = read_chunk(ch.data)
        self.assertEqual((rc.vertex_count, rc.index_count, rc.element_count), (16, 72, 2))
        self.assertEqual(rc.guids, ['A' * 22, 'B' * 22])
        self.assertEqual(rc.palette.tolist(), [[200, 10, 10, 255], [10, 200, 10, 128]])
        back = rc.world_positions()
        self.assertLess(abs(back[:8] - np.array(box('x', 0, 0, 0, 2, 3, 4).verts)).max(), 11 / 65535 + 1e-6)
        self.assertEqual(rc.element_of_triangle(0), 0)
        self.assertEqual(rc.element_of_triangle(11), 0)
        self.assertEqual(rc.element_of_triangle(12), 1)
        self.assertEqual(rc.element_of_triangle(23), 1)
        self.assertEqual(len(ch.sha256), 64)
        self.assertEqual(len(ch.data) % 4, 0)

    def test_same_input_same_bytes(self):
        a = write_chunk([box('A' * 22, 0, 0, 0, 1, 1, 1)], [(1, 2, 3, 255)])
        b = write_chunk([box('A' * 22, 0, 0, 0, 1, 1, 1)], [(1, 2, 3, 255)])
        self.assertEqual(a.sha256, b.sha256)

    def test_cut_chunk_is_refused(self):
        ch = write_chunk([box('A' * 22, 0, 0, 0, 1, 1, 1)], [(1, 2, 3, 255)])
        with self.assertRaises(ValueError):
            read_chunk(ch.data[:-4])
        with self.assertRaises(ValueError):
            read_chunk(b'XXXX' + ch.data[4:])

    def test_32_bit_indices_above_65535_vertices(self):
        n = 70000
        v = np.random.RandomState(1).rand(n, 3)
        f = np.stack([np.arange(0, n - 2, 3), np.arange(1, n - 1, 3), np.arange(2, n, 3)], axis=1)
        rc = read_chunk(write_chunk([ChunkElement('C' * 22, v, f, np.zeros(len(f), dtype=np.int64))], [(9, 9, 9, 255)]).data)
        self.assertEqual(rc.flags & 1, 1)
        self.assertEqual(int(rc.indices.max()), 3 * len(f) - 1)

    def test_working_days_skip_weekends(self):
        fri = dt.date(2026, 11, 20)
        self.assertEqual(add_working_days(fri, 0), fri)
        self.assertEqual(add_working_days(fri, 1), dt.date(2026, 11, 23))
        self.assertEqual(add_working_days(dt.date(2026, 11, 21), 0), dt.date(2026, 11, 23))

    def test_granularity_auto(self):
        self.assertEqual(resolve_granularity('auto', 1500), 'element')
        self.assertEqual(resolve_granularity('auto', 1501), 'group')
        self.assertEqual(resolve_granularity('group', 3), 'group')


class TinyConvertTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp()
        cls.path = os.path.join(cls.dir, 'tiny.ifc')
        make_tiny_ifc(cls.path)

    def test_storeys_by_elevation_and_site_stage(self):
        r = convert_ifc(self.path, PROJECT, start_date=dt.date(2026, 11, 23))
        self.assertEqual([s['name'] for s in r.storeys], ['Level 1', 'Level 2', 'Building / Site'])
        self.assertEqual(r.model['counts']['elements'], 6)
        self.assertEqual(r.model['counts']['tasks'], 6)
        self.assertEqual(r.model['counts']['stages'], 3)
        self.assertEqual(r.wbs['granularity'], 'element')
        self.assertAlmostEqual(r.storeys[1]['elevation'], 3.0, places=3)

    def test_every_element_has_one_task_and_the_tree_is_right(self):
        r = convert_ifc(self.path, PROJECT, start_date=dt.date(2026, 11, 23))
        tasks = {t['rowGUID']: t for t in r.project_file['tasks']}
        for el in r.elements:
            t = tasks[el['taskGUID']]
            self.assertEqual(t['rowJSON']['bimIfcGuid'], el['ifcGuid'])
            self.assertEqual(len(t['treePath'].split('.')), 3)
        self.assertEqual(r.project_file['dependencies'], [])
        starts = [t['rowJSON']['manualStartAt'] for t in r.project_file['tasks'] if t['rowJSON']['rowKind'] == 'task']
        self.assertEqual(len(set(starts)), len(starts))          # one working day each
        self.assertTrue(all(dt.datetime.fromisoformat(s.replace('Z', '+00:00')).weekday() < 5 for s in starts))

    def test_group_granularity_groups_the_doors(self):
        r = convert_ifc(self.path, PROJECT, granularity='group', start_date=dt.date(2026, 11, 23))
        doors = [e for e in r.elements if e['ifcClass'] == 'IfcDoor']
        self.assertEqual(len(doors), 2)
        self.assertEqual(doors[0]['taskGUID'], doors[1]['taskGUID'])
        self.assertLess(r.model['counts']['tasks'], 6)
        task = next(t for t in r.project_file['tasks'] if t['rowGUID'] == doors[0]['taskGUID'])
        self.assertIn('bimGroupKey', task['rowJSON'])
        self.assertNotIn('bimIfcGuid', task['rowJSON'])

    def test_same_ids_on_every_run(self):
        a = convert_ifc(self.path, PROJECT, start_date=dt.date(2026, 11, 23))
        b = convert_ifc(self.path, PROJECT, start_date=dt.date(2026, 11, 23))
        self.assertEqual([t['rowGUID'] for t in a.project_file['tasks']], [t['rowGUID'] for t in b.project_file['tasks']])
        self.assertEqual(sorted(a.chunk_bytes), sorted(b.chunk_bytes))

    def test_properties_are_read(self):
        r = convert_ifc(self.path, PROJECT, start_date=dt.date(2026, 11, 23))
        with_set = [p for p in r.properties if p['rowJSON']['sets']]
        self.assertEqual(len(with_set), 1)
        self.assertEqual(with_set[0]['rowJSON']['sets']['Pset_WallCommon']['FireRating'], '2HR')
        self.assertEqual(len(r.properties), 6)
        off = convert_ifc(self.path, PROJECT, with_properties=False, start_date=dt.date(2026, 11, 23))
        self.assertEqual(off.properties, [])

    def test_skip_empty_off_keeps_the_empty_stage(self):
        r = convert_ifc(self.path, PROJECT, skip_empty=False, start_date=dt.date(2026, 11, 23))
        self.assertGreaterEqual(r.model['counts']['stages'], 3)

    def test_bundle_on_disk_passes_the_checker(self):
        r = convert_ifc(self.path, PROJECT, start_date=dt.date(2026, 11, 23))
        out = os.path.join(self.dir, 'bundle')
        write_bundle(r, out)
        self.assertEqual(check_bundle(out, self.path, {'elements': 6, 'tasks': 6, 'stages': 3}), [])

    def test_checker_finds_a_damaged_chunk(self):
        r = convert_ifc(self.path, PROJECT, start_date=dt.date(2026, 11, 23))
        out = os.path.join(self.dir, 'bundle_bad')
        write_bundle(r, out)
        h = next(iter(r.chunk_bytes))
        p = os.path.join(out, 'chunks', h + '.bimc')
        with open(p, 'rb') as fh:
            data = bytearray(fh.read())
        data[100] ^= 0xFF
        with open(p, 'wb') as fh:
            fh.write(bytes(data))
        self.assertTrue(any('sha256' in x for x in check_bundle(out)))


@unittest.skipUnless(os.path.exists(EXAMPLE1), 'example 1 is not in the repository')
class Example1Test(unittest.TestCase):
    def test_example1(self):
        r = convert_ifc(EXAMPLE1, 'aabd1dde-97e6-4359-97e4-0efcb847589b', start_date=dt.date(2026, 11, 23))
        self.assertEqual(r.model['unitScale'], 0.3048)
        self.assertEqual(r.model['counts']['elements'], 58)
        self.assertEqual(r.model['counts']['tasks'], 58)
        self.assertEqual(r.model['counts']['stages'], 4)              # 4 of the 12 storeys hold walls
        self.assertEqual([s['name'] for s in r.storeys], ['Elevator Pit', 'L1_35_Low', 'L1_37_Med', 'L1_43_High'])
        self.assertAlmostEqual(r.storeys[0]['elevation'], -22.9166667 * 0.3048, places=2)   # the unit scale is applied (feet -> metres)
        self.assertAlmostEqual(r.model['bbox'][4] - r.model['bbox'][1], 28.575, places=2)
        self.assertTrue(all(e['ifcClass'] == 'IfcWall' for e in r.elements))


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.pop('SUPABASE_URL', None)
        cls.dev = tempfile.mkdtemp()
        os.environ['BIM_DEV_OUT'] = cls.dev
        cls.httpd = ThreadingHTTPServer(('127.0.0.1', 0), srv.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.ifc = os.path.join(cls.dev, 'tiny.ifc')
        make_tiny_ifc(cls.ifc)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def call(self, method, path, body=None, headers=None):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=60)
        c.request(method, path, body=body, headers=headers or {})
        r = c.getresponse()
        return r.status, json.loads(r.read() or b'{}')

    def test_health(self):
        s, b = self.call('GET', '/health')
        self.assertEqual((s, b['ok'], b['mode']), (200, True, 'development'))

    def test_convert_job_runs_to_the_end(self):
        with open(self.ifc, 'rb') as fh:
            data = fh.read()
        s, b = self.call('POST', f'/convert?projectGUID={PROJECT}&modelGUID=22222222-2222-4222-8222-222222222222&startDate=2026-11-23', data, {'Content-Type': 'application/octet-stream'})
        self.assertEqual(s, 202)
        for _ in range(100):
            s, j = self.call('GET', '/jobs/' + b['jobId'])
            if j['state'] in ('done', 'failed'):
                break
            time.sleep(0.2)
        self.assertEqual(j['state'], 'done', j)
        self.assertEqual(j['result']['model']['counts']['elements'], 6)
        self.assertTrue(all(c['storagePath'].startswith(f'{PROJECT}/22222222-2222-4222-8222-222222222222/') for c in j['result']['chunks']))

    def test_refuses_bad_input(self):
        self.assertEqual(self.call('POST', f'/convert?projectGUID=x&modelGUID=y', b'abc')[0], 400)
        self.assertEqual(self.call('POST', f'/convert?projectGUID={PROJECT}&modelGUID=22222222-2222-4222-8222-222222222222', b'not an ifc file at all')[0], 400)
        self.assertEqual(self.call('POST', f'/convert?projectGUID={PROJECT}&modelGUID=22222222-2222-4222-8222-222222222222&granularity=zzz', b'ISO-10303-21;')[0], 400)
        self.assertEqual(self.call('GET', '/jobs/' + 'a' * 32)[0], 404)

    def test_url_host_must_be_allowed(self):
        body = json.dumps({'url': 'https://evil.example.com/x.ifc'}).encode()
        s, b = self.call('POST', f'/convert?projectGUID={PROJECT}&modelGUID=22222222-2222-4222-8222-222222222222', body, {'Content-Type': 'application/json'})
        self.assertEqual(s, 400)
        self.assertIn('not allowed', b['error'])
        self.assertFalse(srv.allowed_host('http://raw.githubusercontent.com/x.ifc'))
        self.assertTrue(srv.allowed_host('https://raw.githubusercontent.com/x.ifc'))
        self.assertTrue(srv.allowed_host('https://media.githubusercontent.com/media/x/y/main/a.ifc'))  # Git LFS files (example 2)


if __name__ == '__main__':
    unittest.main()
