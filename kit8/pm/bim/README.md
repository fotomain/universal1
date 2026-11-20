# BIM - an IFC model as a project (stages + tasks) with a 3D view

Plan and decisions: `documentation/BIM_WBS.html`. Converter service: `py/bim/server` (README there). SQL: PART 55 (`start1` tables, `start2` code, `delete_bim_data.sql` removes the data).

## What it does
1. **Import** (`import/`, route `/pm/bim/import`, component `BIMToProjectImport.tsx`): an IFC (BIM example 1, BIM example 2 = the Duplex Apartment, a file, or an https address; example 2 is a Git LFS file, so its address is on `media.githubusercontent.com`, a host the converter allows by default) is converted on the **converter service**
   into chunks (BIMC v1, one per storey) + the stages / tasks of the project (minimum data: no lines, no costs, no links) + the rows of the `bim_` tables. The project GUID of
   example 1 is `aabd1dde-97e6-4359-97e4-0efcb847589b`; a project that does not exist is made; a project with tasks that is **not** a BIM project is refused; a BIM project asks before its tasks are replaced. The old tasks are deleted by the RPC `project_delete_tasks` (one statement; a plain delete of thousands of rows hit the 8 s statement limit of Supabase: "canceling statement due to statement timeout").
2. **The BIM button** (`view/PMProjectBimView.tsx`): the LAST button of the view switch (Gantt, Edit, ... Budgets, **BIM**), shown only while `projectIsBIMBased` is true (the import turns it on, the user can switch it).
3. **Interactivity** (`view/useBimTaskBridge.ts`, the only place that talks to the store): a task (or a stage = all its tasks, or the checked tasks) pressed in the tree lights its elements and
   dims the rest (two switches), the camera moves to them; an element pressed in 3D selects its task - or its stage - in the tree (`setSelected` + `requestFocus`: the tree scrolls); an empty press clears the light.
   An **XYZ gizmo** in the corner of the 3D view shows the orientation (X red = east, Y green = up, Z blue = south, N = north). A press on the 3D view does not move the camera; a press in the tree zooms to its elements.
   **Zoom in percent** (toolbar, 2026-11-20; `bimCamera.ts` `zoomByPercent / parseZoomPercent / zoomPercentOf`): **−** / **+** = 25 % smaller / bigger (the pair is exact inverse); the field takes a CHANGE in percent, positive or negative (`50` = 1.5x bigger, `-50` = half as big, Enter or the Zoom button; `-100` or less and text are refused, the field turns red); the number after it is the LEVEL, 100 % = the whole model fits (a press on a detail, then + / the field, shows where it sits in the big picture). Tests `__tests__/bim/bimZoomPercent.test.ts`, `bimZoomToolbar.test.tsx`.
   The element pressed shows its name, class, type and its IFC properties (`bim_property_get`, read when asked).
4. **Project settings -> BIM** (`view/project/settings/PMProjectBimTab.tsx`): the switch `projectIsBIMBased` - **always switchable** (owner, 2026-11-20; saved with the window; a read-only project locks it; ON = the BIM button is shown, OFF = hidden, the model stays until Remove BIM data), the facts of the last import, Import again, Remove BIM data.

## The pieces
| Folder | What |
|---|---|
| `bimc/` | `bimcReader.ts` = the BIMC v1 reader (zero copy: typed array views on the buffer; `bimcElementOfTriangle` = the pick), `base64.ts` |
| `model/` | `bimModel.ts` = names, types, `projectIsBimBased`, `bimLocalDbName`, the facts of a model |
| `import/` | `bimImportModel.ts` (pure: bundle -> RPC rows), `runBimImport.ts` (the order + failure handling, everything injected), `bimServerClient.ts` (POST /convert, poll the job), `useBimImport.ts`, `BIMToProjectImport.tsx` |
| `cloud/` | `bimCloud.ts` = the `BimCloud` interface + the Supabase adapter (RPCs of PART 55 + Storage bucket `bim`) |
| `local/` | the local read cache: `bimLocalSql.ts` (ONE SQL implementation), `bimLocalDb.native.ts` (expo-sqlite), `bimLocalDb.web.ts` (SQLite WASM + OPFS), `bimLocalMemory.ts` (memory twin), chunk file caches |
| `view/` | `BimViewer` (gestures + canvas), `BimCanvas(.web)` (react-three-fiber), `BimSceneContent`, `bimSceneBuilder.ts` (three), `bimCamera.ts` (orbit math), `bimModelLoader.ts`, `useBimModel`, `PMProjectBimView`, `BimExampleDemo` |
| `examples/example1/` | `Structure_Walls.ifc` (the viktor-platform sample, no licence file in that repo: a private test), `out/` = what the converter made (bundle.json, project file, 4 chunks), `example1.demo.json` = the offline demo |

## Decisions of the owner (2026-11-20) and what that means
* **Supabase is the cloud** (tables, RPCs, Storage bucket `bim`, private, signed urls). **Qdrant is not used.** Only example 1 (Q5); Q14 "do all": the IFC **properties** are imported too (`bim_property_table`).
* **Local database** `kit8bimdb_<organizationGUID>` (one per organization): expo-sqlite on a phone; on the web the official SQLite WASM with the OPFS VFS `opfs-sahpool` in a **dedicated worker**
  (`public/bim/bim-sqlite-worker.mjs`; OPFS synchronous access exists in dedicated workers only - the plan said SharedWorker, which cannot do it). The sahpool allows one connection, so
  the **leader** window (Web Lock `kit8bim-db-leader`) owns the worker and the other windows talk to it over a `BroadcastChannel`; when the leader closes, a waiting window takes over.
  No Web Locks / no worker files = the memory twin. The chunk files are Cache Storage (web) / files of the document folder (phone). It is a CACHE: the cloud is the truth.
* **One set of `bim_` tables** with a project column + row level security; no table per project.

## Run
```bash
pip install -r py/bim/server/requirements.txt          # ifcopenshell + numpy
python py/bim/server/server.py                          # the converter, port 8765 (development mode: no login, chunks go to ./out)
npm run bim:copy-wasm                                   # the SQLite WASM next to the worker (web), after npm install
```
`.env` (the owner edits it): `EXPO_PUBLIC_BIM_SERVER_URL=http://localhost:8765` (a phone needs the LAN address of the Mac). The converter in Supabase mode needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` in ITS environment.
**Import again** (Project settings -> BIM, or the Import tab of the project window) opens `/pm/bim/import?projectGUID=<this project>`; the importer is a Drawer screen that stays mounted, so it follows the parameter every time it changes (test `__tests__/bim/bimImportScreen.test.tsx`).

**Without a login or a database**: `/pm/bim/example` shows example 1 (and `?example=2` the Duplex Apartment, two buttons switch) in 3D from the converted files of the repository (the same viewer and the same two-way highlight; it also saves the model into the local database and reads it back).

## Tests
`npm test -- __tests__/bim __tests__/sql/bimSql`; Python: `cd py/bim/server && python -m unittest discover -s tests`; Docker: `kit8/docker/test_time_genus.sh 104` (84 checks) `kit8/docker/test_bim_example1.sh`, `test_bim_example2.sh` and `test_bim_copy.sh` (the examples through the real database flow; the last one also copies a model into a second project).

## Not built / not tried
* Not tried on a real iPhone / Android (expo-gl, expo-sqlite, files): the code is written, nothing of it was seen on a phone. WebGL2 + normalized Uint16 attributes on the dev client is the open question (the spike A3 of the plan).
* The converter was run on the owner's Mac only (CLI + HTTP, development mode); the Supabase mode (JWT check + Storage upload with the user's token) is tested in Docker for the SQL and the Storage policy helpers, not against a real Supabase.
* Instancing of repeated geometry, normals, meshopt / brotli on the wire, ID-buffer picking, the BIM view of a project version, colour by status, section planes, measuring: not built (the BIMC header has room for them).
* Example 2 = the buildingSMART Duplex Apartment (2026-11-20, `examples/example2`); the Archicad Vacation Home `.pla` cannot be read without ArchiCAD (needs an IFC export).

## Openings and example 3 (Schependomlaan)
* **Openings as elements** (switch in the importer, default on; converter option `--openings` / `openings=1`): the 130 openings of example 1 (the voids of windows and doors in the 58 walls) become elements and tasks of their own (188 elements,
  188 tasks; "Opening in <wall name>", type "Opening", in the storey of their wall, translucent blue). Off = they are only holes in the wall meshes. A wall itself is ONE element (one extruded solid, one material, no parts).
* **Example 3 = Schependomlaan** (the design model `IFC Schependomlaan.ifc`, ArchiCAD / ROOT bv, IFC2X3, 49 MB; project GUID `3a427f72-98f9-4f46-8449-164e3a22e1de`; address in `model/bimModel.ts`, `raw.githubusercontent.com` of the openBIMstandards archive - the dataset moved to
  buildingSMART Sample-Test-Files, whose repository was renamed and no longer lists it). Measured 2026-11-20 on the owner's Mac: converted in 35 s, 1.1 GB memory, 6 storeys (fundering, begane grond, 1st - 3rd floor, dak), **3 504 elements** (1 214 coverings, 648 + 231 walls, 279 slabs, 277 building element parts,
  259 windows, 205 doors ...), more than 1 500 so the tasks are GROUPED: **329 tasks** (one per storey + class + type, e.g. "Beam · IFC_strookfundering_1000x250 (4)"), 6 chunks = 2.8 MB, properties 11.8 MB of json, worst difference chunk vs IFC 0.18 mm. Through the HTTP service from its GitHub address it finished in about 12 s of polling.
  Not in the repository (49 MB): the importer fetches it by address. Example 2 (Duplex Apartment) was added by another session; the offline demo `/pm/bim/example` has examples 1 and 2 only.
