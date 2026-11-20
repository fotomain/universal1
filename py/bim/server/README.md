# BIM converter (py/bim/server)

IFC -> chunks (BIMC v1, one per storey) + the stages / tasks of a project (the ordinary project exchange file `kit8.pm.project`) + the rows of the `bim_` tables + the IFC properties.
IfcOpenShell does the geometry (IfcOpenShell is native code: it cannot run in a Supabase Edge Function - this is why it is a service). Plan: `documentation/BIM_WBS.html`; the app: `kit8/pm/bim`.

| File | What |
|---|---|
| `bimc.py` | the BIMC v1 writer + reader (the format is described in its header; the TypeScript reader is `kit8/pm/bim/bimc/bimcReader.ts`) |
| `ifc_convert.py` | `convert_ifc(path, project_guid, ...)` -> `ConvertResult` (model, storeys, chunks, elements, properties, project file); the unit scale is applied (example 1 is in feet), Z up -> Y up, the model origin shifted (example 1 has coordinates of 417 km) |
| `wbs.py` | stages (storeys by elevation) + tasks (one per element up to 1 500 elements, else per storey + class + type), pinned one working day each, uuid5 ids (the same file = the same ids) |
| `worker.py` | ONE conversion in a process of its own (server.py starts it for every job; progress on stdout; `os._exit` at the end) |
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
Environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BIM_URL_ALLOWLIST` (default `raw.githubusercontent.com,media.githubusercontent.com` - the second one serves Git LFS files such as the Duplex of example 2, raw gives only the pointer: the only hosts an IFC may be fetched from), `BIM_MAX_IFC_MB` (200), `BIM_SERVER_PORT` (8765), `BIM_CORS_ORIGINS` (`*`), `BIM_DEV_OUT`.
**Supabase mode**: the user's JWT comes in the `Authorization` header; the server asks Supabase Auth who it is and uploads every chunk to the private bucket `bim` as `<project>/<model>/<sha256>.bimc` **with the user's own token** -
the Storage policy of PART 55 (`bim_storage_upload_ok`: the caller started this import, the folder is the model's, the project is writable) decides. The server holds no service key and writes nothing to the database.

Memory and big models: see "Large models, converter 2" below (measured: Sixty5, 343 MB, 1.8 GB peak).

## Openings, example 3
`--openings` (HTTP: `openings=1`) makes the openings (IfcOpeningElement) elements of their own; `properties=0` (HTTP) leaves the IFC properties out. Schependomlaan (49 MB, IFC2X3) measured 2026-11-20: 35 s, 1.1 GB peak, 3 504 elements, 329 grouped tasks, 2.8 MB of chunks:
```bash
python ifc_to_bim.py "IFC Schependomlaan.ifc" --project 3a427f72-98f9-4f46-8449-164e3a22e1de --name "BIM example 3 - Schependomlaan" --start 2026-11-23 --out out3
```

## Large models, converter 2 (example 4, Sixty5)
Sixty5 = an ArchiCAD architecture model of buildingSMART's Community-Sample-Test-Files (`SDK - S1`, CC BY 4.0, holder unspecified), mirrored by the IFC-Bench dataset on Hugging Face (pinned revision, sha256 `e91ddbbd...46df`, 342 657 851 bytes, IFC2X3, unit mm).
Measured 2026-11-20 on a 16 core / 16 GB Mac: **19 storeys, 16 650 elements, 1 639 grouped tasks, 19 chunks = 23.7 MB** (the IFC is 327 MB: 14 x smaller), `bundle.json` 141 MB of which 111 MB are the IFC properties (a gzip answer of the server is about a tenth of it),
worst difference between the chunks and a second read of the IFC (`check_bim_import.py --ifc`) **0.43 mm** (limit 2 mm); **CLI 279 s / 1.8 GB peak** (of these about 100 s were only the destructor of the geometry iterator at the end), **through the server (web address -> job -> answer) 159 s**, 37 s of them the download.
What converter 2 changed for big files:
* **the process**: every job runs in `worker.py` (own process). The destructor of the geometry iterator frees millions of small objects one by one and held the Python lock for minutes - the server would not have answered the polls of the app; the worker ends with `os._exit` after the bundle is written, so no destructor runs and the memory goes back at once. A killed worker (out of memory) says so in the job error and takes only its job; `BIM_JOB_MAX_MIN` (90) kills a job that runs too long. The CLI ends with `os._exit` too (it prints time and peak memory).
* **no whole file in memory**: the SHA-256 is read in 1 MB blocks (it was `fh.read()` = the whole file), an uploaded file or a downloaded address goes to disk in 1 MB blocks (`copy_exact`, `copy_limited`), a file above `BIM_MAX_IFC_MB` stops the download.
* **less per element**: vertices are kept as float32 relative to the first corner met (a model of 5 km keeps 0.3 mm; the checker limit is 2 mm, the measured worst is 0.2 mm), faces as int32, the scene coordinates are made per chunk, an element's arrays are freed when its chunk is written, no IFC entity is kept (properties are read by GlobalId), the model box is found without joining all vertices into one array.
  This did NOT lower the peak of a small file (Schependomlaan 1 042 -> 1 048 MB: the IfcOpenShell model dominates); it keeps the growth with the geometry flat.
* defaults: `BIM_MAX_IFC_MB` 500 (was 200), `BIM_URL_ALLOWLIST` also `huggingface.co`; progress by the iterator's own percent.
* `CONVERTER_VERSION` is `bim-converter-2` (the chunk bytes differ in the last quantization step from converter 1: the same file gives the same bytes within one version).
The bundle of Sixty5 is not in the repository (170 MB): make it with the command of `kit8/docker/test_bim_example4.sh` (header) and run that script for the database flow (15 checks, 16 650 elements in batches of 3 000).
Not done: a streaming IFC parser (the IfcOpenShell model needs about 7 x the file size in memory for a geometry-heavy file, about 3 x for Sixty5), a smaller property set (empty values are still sent), paged job results.
