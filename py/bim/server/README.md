# BIM converter (py/bim/server)

IFC -> chunks (BIMC v1, one per storey) + the stages / tasks of a project (the ordinary project exchange file `kit8.pm.project`) + the rows of the `bim_` tables + the IFC properties.
IfcOpenShell does the geometry (IfcOpenShell is native code: it cannot run in a Supabase Edge Function - this is why it is a service). Plan: `documentation/BIM_WBS.html`; the app: `kit8/pm/bim`.

| File | What |
|---|---|
| `bimc.py` | the BIMC v1 writer + reader (the format is described in its header; the TypeScript reader is `kit8/pm/bim/bimc/bimcReader.ts`) |
| `ifc_convert.py` | `convert_ifc(path, project_guid, ...)` -> `ConvertResult` (model, storeys, chunks, elements, properties, project file); the unit scale is applied (example 1 is in feet), Z up -> Y up, the model origin shifted (example 1 has coordinates of 417 km) |
| `wbs.py` | stages (storeys by elevation) + tasks (one per element up to 1 500 elements, else per storey + class + type), pinned one working day each, uuid5 ids (the same file = the same ids) |
| `server.py` | the HTTP service: `POST /convert` -> a job, `GET /jobs/<id>`; standard library only |
| `ifc_to_bim.py` | the command line: IFC (file or https) -> a bundle folder |
| `check_bim_import.py` | checks a bundle (hashes, counts, element -> task, tree paths, no links / lines) and, with `--ifc`, compares the dequantized chunk with a second read of the IFC (limit 2 mm) |
| `make_demo_bundle.py` | packs a bundle into the one json of the offline demo (`/pm/bim/example`) |
| `drain_storage.py` | removes the chunk files that `bim_storage_cleanup_table` lists (service key, on your machine) |
| `tests/` | `python -m unittest discover -s tests` (19 tests: format, WBS rules, bundle checker, the HTTP service) |

## Example 1
```bash
python ifc_to_bim.py ../../kit8/pm/bim/examples/example1/Structure_Walls.ifc --project aabd1dde-97e6-4359-97e4-0efcb847589b --name "BIM example 1 - Structure Walls" --start 2026-11-23 --out ../../kit8/pm/bim/examples/example1/out
python check_bim_import.py ../../kit8/pm/bim/examples/example1/out --ifc ../../kit8/pm/bim/examples/example1/Structure_Walls.ifc --expect-elements 58 --expect-tasks 58 --expect-stages 4
```
Result (measured 2026-11-20): 4 of the 12 storeys hold walls (Elevator Pit 31, L1_35_Low 5, L1_37_Med 5, L1_43_High 17 = 58 walls), 4 stages + 58 tasks, 58 property rows, **4 chunks = 37 088 bytes**
(the IFC is 446 971 bytes), the model is 59.8 x 28.6 x 70.9 m, the unit scale 0.3048 is applied, the worst difference between the chunk and the IFC is 0.45 mm.

## Run the service
```bash
pip install -r requirements.txt
python server.py                               # development mode: no login, chunks go to ./out/<model guid>
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=... python server.py     # Supabase mode
docker build -t bim-server . && docker run -p 8765:8765 -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... bim-server
```
Environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BIM_URL_ALLOWLIST` (default `raw.githubusercontent.com`: the only hosts an IFC may be fetched from), `BIM_MAX_IFC_MB` (200), `BIM_SERVER_PORT` (8765), `BIM_CORS_ORIGINS` (`*`), `BIM_DEV_OUT`.
**Supabase mode**: the user's JWT comes in the `Authorization` header; the server asks Supabase Auth who it is and uploads every chunk to the private bucket `bim` as `<project>/<model>/<sha256>.bimc` **with the user's own token** -
the Storage policy of PART 55 (`bim_storage_upload_ok`: the caller started this import, the folder is the model's, the project is writable) decides. The server holds no service key and writes nothing to the database.

Memory: the vertices of all elements are held as float64 until the model origin is known (a 450 KB IFC = a few MB; a 100 MB IFC = a few GB). Not measured on a big IFC (the spike A5 of the plan).
