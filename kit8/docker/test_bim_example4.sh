#!/usr/bin/env bash
# BIM example 4 (Sixty5, 16 650 elements, 19 storeys, grouped tasks) through the real database flow, in batches of 3 000 elements like the app (kit8/pm/bim/import/bimImportModel.ts BIM_ROW_BATCH).
# The bundle of Sixty5 is too big for the repository (about 170 MB): make it once (about 5 minutes, 2 GB of memory), then run this script:
#   cd py/bim/server && python ifc_to_bim.py https://huggingface.co/datasets/sylvainHellin/ifc-bench/resolve/df630deb761efcb184f1a30ab374da7dbae38225/projects/sixty5/arc.ifc \
#       --project 7c1d5a30-4b8e-4f6a-9d21-5e0b6a3f8c14 --name "BIM example 4 - Sixty5" --start 2026-11-23 --openings --out <folder>
#   BIM_EX4_OUT=<folder> kit8/docker/test_bim_example4.sh        (default folder: kit8/pm/bim/examples/example4/out)
# Needs the container (docker compose up -d). Only the first 1 000 property rows are loaded (a psql variable of 110 MB is not the point of the test). Prints ALL OK.
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlbim4
EX="${BIM_EX4_OUT:-../pm/bim/examples/example4/out}"
if [ ! -f "$EX/bundle.json" ]; then echo "No bundle in $EX - make it first (see the header of this script)."; exit 2; fi
PROJECT_FILE=$(ls "$EX"/project_data_*.json | head -1)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
python3 -I - "$EX/bundle.json" "$TMP" <<'PY'
import json, sys
from collections import Counter
b = json.load(open(sys.argv[1]))
n_el, n_st, n_ch = len(b['elements']), len(b['storeys']), len(b['chunks'])
assert (n_el, n_st, n_ch) == (16650, 19, 19), (n_el, n_st, n_ch)   # the pinned numbers of Sixty5
b['properties'] = b['properties'][:1000]
json.dump(b, open(sys.argv[2] + '/bundle.json', 'w'))
st = sorted(b['storeys'], key=lambda s: s['orderInList'])
per = Counter(e['storeyIfcGuid'] for e in b['elements'])
per_s = ','.join(f"{s['name']}:{per[s['ifcGuid']]}" for s in st)
first = st[0]
yr = round(max(e['bbox'][4] for e in b['elements']) - min(e['bbox'][1] for e in b['elements']), 2)
tpl = open('bim_example2_check.sql').read()
tail = "-- delete_bim_data.sql for this project, as in the SQL editor\nSELECT tt.as_admin();\nCOMMIT;"
assert tail in tpl
tpl = tpl.replace(tail, "SELECT tt.as_admin();\nCOMMIT;").replace('/tmp/bim_ex2', '/tmp/bim_ex4').replace("'Duplex_A_20110907.ifc'", "'arc.ifc'")
def sub(a, c):
    global tpl
    assert tpl.count(a) == 1, a
    tpl = tpl.replace(a, c)
n_tasks = b['model']['counts']['tasks']; n_st_rows = b['model']['counts']['stages']
sub("219, '4 stages + 215 tasks are imported'", f"{n_tasks + n_st_rows}, '{n_st_rows} stages + {n_tasks} tasks are imported'")
# the elements in batches of 3000 like the app
a = tpl.index("SELECT public.bim_import_add_rows(:'m', 'elements'")
z = tpl.index("\\gset", a) + len("\\gset")   # the statement of example 2 spans two lines
batches = []
for i in range(0, n_el, 3000):
    batches.append("SELECT public.bim_import_add_rows(:'m', 'elements', (SELECT jsonb_agg(jsonb_build_object('ifcGuid', e->>'ifcGuid', 'ifcClass', e->>'ifcClass', 'name', e->>'name', 'typeName', e->>'typeName', 'storeyIfcGuid', e->>'storeyIfcGuid', 'taskGUID', e->>'taskGUID', 'chunkHash', e->>'chunkHash', 'elementNumber', e->'elementNumber', 'bbox', e->'bbox')) FROM (SELECT e FROM jsonb_array_elements(:'bundle'::jsonb->'elements') WITH ORDINALITY AS t(e, n) WHERE n > %d AND n <= %d) q)) AS n_e%d \\gset" % (i, i + 3000, i // 3000))
sums = ' + '.join(f":n_e{i}::int" for i in range(len(batches)))
tpl = tpl[:a] + "\n".join(batches) + "\nSELECT (" + sums + ") AS n_e \\gset" + tpl[z:]
sub("SELECT tt.eq(:n_s::int, 4, '4 storeys'); SELECT tt.eq(:n_c::int, 4, '4 chunks'); SELECT tt.eq(:n_e::int, 215, '215 elements'); SELECT tt.eq(:n_p::int, 215, '215 property rows');",
    f"SELECT tt.eq(:n_s::int, {n_st}, '{n_st} storeys'); SELECT tt.eq(:n_c::int, {n_ch}, '{n_ch} chunks'); SELECT tt.eq(:n_e::int, {n_el}, '{n_el} elements in batches of 3000'); SELECT tt.eq(:n_p::int, 1000, '1000 property rows');")
sub("'storeys', 4, 'chunks', 4, 'elements', 215, 'properties', 215", f"'storeys', {n_st}, 'chunks', {n_ch}, 'elements', {n_el}, 'properties', 1000")
sub("::int, 215, '215 tasks have an element'", f"::int, {n_tasks}, '{n_tasks} tasks have an element'")
# class / storey specific lines of example 2 -> numbers of this model
lines = tpl.split('\n')
out = []
skip_next = False
for ln in lines:
    if "'IfcWallStandardCase'" in ln or "IN ('IfcDoor','IfcWindow')" in ln:
        continue
    if ln.startswith("SELECT tt.eq((SELECT string_agg(name"):
        out.append(ln); skip_next = True; continue
    if skip_next:
        out.append(f"  '{per_s}', 'elements per storey: ' || '{len(st)} storeys');".replace("'", "'")); skip_next = False; continue
    out.append(ln)
tpl = '\n'.join(out)
sub("1.0::numeric, 'the unit scale 1 (metres) is kept'", f"{b['model']['unitScale']}::numeric, 'the unit scale {b['model']['unitScale']} (mm) is kept'")
sub("8.18::numeric, 'the model is 8.18 m high'", f"{yr}::numeric, 'the model is {yr} m high'")
tpl = tpl.replace("'Level 1')))), 101, 'the stage Level 1 lights its 101 elements'", f"'{first['name']}')))), {per[first['ifcGuid']]}, 'the stage {first['name']} lights its {per[first['ifcGuid']]} elements'")
open(sys.argv[2] + '/check.sql', 'w').write(tpl)
PY
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
echo "== fresh database $DB"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null
for f in start1_sql_tables.sql start2_sql_code.sql start4_sql_insert_missing.sql; do psqlc -d "$DB" -f /sql/$f >/dev/null; done
docker exec "$C" rm -rf /tmp/bim_ex4 && docker exec "$C" mkdir -p /tmp/bim_ex4
docker cp "$PROJECT_FILE" "$C:/tmp/bim_ex4/project.json"
docker cp "$TMP/bundle.json" "$C:/tmp/bim_ex4/bundle.json"
echo "== import example 4 (16 650 elements) and check the numbers"
t0=$(date +%s)
out=$( (cat tests/00_helpers.sql "$TMP/check.sql") | docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q 2>&1 ) || { echo "$out" | grep -E "ERROR|FAILED" | sed 's/^/   /'; echo FAILED; exit 1; }
echo "$out" | grep -E "ok:" | sed 's/^[A-Za-z:._0-9\/ ]*NOTICE:  /   /'
echo "   -> $(echo "$out" | grep -c 'ok:') checks passed in $(( $(date +%s) - t0 )) s"
echo ALL OK
