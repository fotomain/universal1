# Project package - a project WITH its BIM model in one zip (BUILT 2026-11-20)

The export of a project (`Project settings -> Import / Export -> Export`) used to be one JSON: project, tasks, dependencies, Gantt settings. Two things were missing: the **task lines**
(the importer could read them, the export never wrote them) and the **BIM model** (6 `bim_` tables + the geometry files of the private Storage bucket `bim`).

## What the user sees

Export tab, three switches above the buttons:

| switch | default | |
|---|---|---|
| Task lines (Time, Material, Expense) | on | writes `taskLines` into the JSON (the lines come back UNPOSTED: press Post) |
| BIM model (3D geometry) - makes a zip package | on | only on a project with `projectIsBIMBased`; the button then reads **Export package (zip)** |
| BIM properties (large) | ON (owner 2026-11-20) | only with the model on; the IFC properties are tens of MB for a big model: switch off for a smaller file |

Without the BIM switch the result is the plain `project_data_<guid>.json` (an old app reads it). With it: `project_package_<guid>.zip`. A project with the switch on but no ready model gives the JSON and says so.
Import (the Import tab, and the Import New Project Assistant) takes a `.json` or a `.zip` and tells them apart by the name / mime type and the `PK` header.

## The zip

```
package.json                    kit8.pm.package v1: counts, flags
project_data_<guid>.json        the ordinary exchange file (kit8.pm.project v1) incl. taskLines
csv/*.csv                       the same data as CSV files for people (csvExport.ts): project, tasks, dependencies, task_lines, bim_storeys / bim_elements / bim_chunks / bim_properties
bim/manifest.json               kit8.pm.bim v1: model facts, storeys (with the stage task of the file), chunks (hash, size, counts, bbox)
bim/elements.ndjson             one element per line (the shape of BimBundleElement; the task is the task of the FILE)
bim/properties.ndjson           optional, { ifcGuid, rowJSON } per line
bim/chunks/<hash>.bimc          the geometry files, as in Storage
```

`csv/`: UTF-8 with a byte order mark (Excel), comma, CRLF; a nested key is a dotted column (`budget.currency`), an array is JSON text; `bim_properties.csv` is in the LONG form (ifc guid, property path, value);
tasks / lines / elements carry the name of their task / storey next to the GUID. A READ copy: the import reads the JSON, never the CSV; the manifest lists them in `csvFiles`.

The BIM part is **the shape of the converter's bundle** (`BimBundle`), so the import is the BIM importer's own row path (`buildBimRows`, `bim_import_*`), only fed from the zip instead of the converter.
No SQL changed; no new format version of the JSON (a file of version 1 with an optional key, like `taskLines` before).

## Export (`export/exportProjectToFile.ts`, `bimExportRead.ts`)

1. project + tasks + dependencies (`readProjectData`) + lines (`readProjectTaskLines`, paged) -> `buildProjectExchangeFile(..., taskLines)`.
2. BIM: `bim_model_manifest` -> elements in pages of 5 000 (`bim_elements_page`) -> properties in pages of 300 (`BimCloud.propertiesPage`: a table read, policy `bim_property_table_select`, keyset by ifcGuid)
   -> the chunk files 4 at a time (size checked against the manifest). The ids of the database are turned back into what the importer needs (storey `ifcGuid`, the task id as it is in the file).
3. `packZip` (fflate, JSON level 6, chunks level 1) -> `downloadBinaryFile`.

## Import (`import/importProjectFromFile.ts`, `importProjectPackage.ts`)

0. checks BEFORE anything changes: every element points to a chunk and to a task of the file, every storey to a stage, every chunk is in the zip with the size the model says.
1. confirm "replace the data" as before. A plain project with tasks: its tasks go first (`bim_import_begin` refuses a non-BIM project that has tasks); a BIM project keeps them until the import has begun.
2. `bim_import_begin` -> tasks, links, task lines, project settings (new ids, `planProjectImport`) -> chunk files uploaded with the user's token (`BimCloud.uploadChunk`, folder of the new model)
   -> `bim_import_add_rows` (storeys, chunks, elements, properties; task ids mapped through `plan.idMap`) -> `bim_import_commit` (all or nothing, sets `projectIsBIMBased`).
3. A failure after the begin: `bim_import_fail` (rows + uploaded files are cleaned through the queue) and the tasks of this import are deleted again.
A plain import never takes `projectIsBIMBased` from a file (only a restored model sets it). A package with a model needs a signed-in user (the cloud).

## Not covered / limits

* **Catalogs** the lines point to (persons, products, suppliers, contracts, roles, budget items) are not in the file: importing into ANOTHER organization leaves references to rows that do not exist there. An optional catalog pack is the next step.
* The package is built in memory (`zipSync`): fine on the web for a big model; **not tried on a phone** (Android writes through the Storage Access Framework, iOS through the share sheet).
* Not run against a real Supabase / Storage: the RPC path is the BIM importer's (tested in Docker), `uploadChunk` and `propertiesPage` are new client calls and are tested with fakes only.
* The Gantt bar's "Export to JSON" still writes tasks + dependencies only (it reads the store, not the database): use Project settings -> Import / Export for lines and BIM.
* `npm install` once: `fflate` is a direct dependency now (it was already installed through another package).

## Files

`packageModel.ts` (pure: names, zip build / read, checks) · `csvExport.ts` (the csv/ folder) · `bimExportRead.ts` · `importProjectPackage.ts` · `binaryFiles.ts` (save / read a binary file per platform) ·
tests `__tests__/pm/crud/exchange/projectPackage.test.ts` (real example-1 bundle, fakes for database and storage), `__tests__/pm/ui/importExportProject.test.tsx`, `__tests__/ui/project/assistant/importAssistantModel.test.ts`.
