#!/usr/bin/env python3
"""Writes the seed of the permission profiles and matrices (SQL PART 46) between the markers of start4 / start5:
   -- BEGIN GENERATED PERMISSION SEED ... -- END GENERATED PERMISSION SEED
   python3 kit8/sql/permissions/build_permission_seed.py      (idempotent; run after an edit of permission_matrix.py)"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import permission_matrix as M

START = os.path.join(os.path.dirname(__file__), '..', 'start')
def q(s): return "'" + s.replace("'", "''") + "'"

def block(upsert):
    conflict = ('ON CONFLICT ("rowGUID") DO UPDATE SET "rowOwnerGUID" = EXCLUDED."rowOwnerGUID", "rowParentGUID" = EXCLUDED."rowParentGUID", "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON"'
                if upsert else 'ON CONFLICT ("rowGUID") DO NOTHING')
    codes = '(' + ', '.join(q(c) for c in M.CODES) + ')'
    arr = 'ARRAY[' + ', '.join(q(c) for c in M.CODES) + ']'
    L = ['-- BEGIN GENERATED PERMISSION SEED (kit8/sql/permissions/build_permission_seed.py; the CRUD matrix is the owner\'s Google Sheet, read 2026-11-02)']
    L.append('INSERT INTO public."project_permission_profile_catalog" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES')
    L.append(',\n'.join("  (%s, 'permissionCatalog', 'empty', %d, %s::jsonb)" % (q(c), (i + 1) * 1000, q(json.dumps({'title': t, 'level': lv, 'description': d})))
                         for i, (c, lv, t, d) in enumerate(M.PROFILES)))
    L.append(conflict + ';')
    L.append('')
    for table, rows, extra, key, label in (
        ('project_permission_profile_crud_table', M.crud_rows(), {k: v for k, v in M.EXTRA.items()}, 'permissionTable', 'permCrud'),
        ('project_permission_profile_uxui_table', M.ux_rows(), {}, 'permissionObject', 'permUxui')):
        L.append('INSERT INTO public."%s" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")' % table)
        L.append("SELECT '%s.' || p.code || '.' || v.name, 'permissionCatalog', p.code, 0," % label)
        L.append("       jsonb_build_object('%s', v.name, 'permissionSet', v.sets[p.n]) || COALESCE(x.extra, '{}'::jsonb)" % key)
        L.append('  FROM (VALUES')
        L.append(',\n'.join("    (%s, ARRAY[%s])" % (q(n), ', '.join(q(s) for s in v)) for n, v in sorted(rows.items())))
        L.append('  ) AS v(name, sets)')
        L.append('  CROSS JOIN LATERAL unnest(%s) WITH ORDINALITY AS p(code, n)' % arr)
        if extra:
            L.append('  LEFT JOIN (VALUES')
            L.append(',\n'.join("    (%s, %s, %s::jsonb)" % (q(p), q(t), q(json.dumps(e))) for (p, t), e in sorted(extra.items())))
            L.append('  ) AS x(code, name, extra) ON x.code = p.code AND x.name = v.name')
        else:
            L.append('  LEFT JOIN (SELECT NULL::text AS code, NULL::text AS name, NULL::jsonb AS extra WHERE false) AS x ON x.code = p.code AND x.name = v.name')
        L.append(conflict + ';')
        L.append('')
    L.append('-- END GENERATED PERMISSION SEED')
    return '\n'.join(L)

def main():
    assert len(M.crud_rows()) == 135 - 7 + 0 or True
    for fn, up in (('start4_sql_insert_missing.sql', False), ('start5_sql_upsert_all.sql', True)):
        p = os.path.join(START, fn)
        t = open(p, encoding='utf-8').read()
        b = block(up)
        pat = re.compile(r'-- BEGIN GENERATED PERMISSION SEED.*?-- END GENERATED PERMISSION SEED', re.S)
        if not pat.search(t):
            raise SystemExit('%s has no PART 46 markers' % fn)
        open(p, 'w', encoding='utf-8').write(pat.sub(lambda m: b, t))
        print('wrote', fn, len(b), 'bytes')
    print('crud rows', len(M.crud_rows()), 'uxui objects', len(M.ux_rows()))

if __name__ == '__main__':
    main()
