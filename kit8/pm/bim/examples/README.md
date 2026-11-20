# BIM examples

* `example1/Structure_Walls.ifc` - "Structure Walls" of https://github.com/viktor-platform/ifc-sample-models (IFC4, Revit 2024, 58 walls, 12 storeys of which 4 hold walls, in feet). That repository has no licence file: keep it as a private test.
  Project GUID of the example: `aabd1dde-97e6-4359-97e4-0efcb847589b`.
* `example1/out/` - what `py/bim/server/ifc_to_bim.py` made of it: `bundle.json` (model, storeys, chunks, elements, properties), `project_data_<guid>.json` (the project exchange file: 4 stages + 58 tasks, no links, no lines),
  `chunks/<sha256>.bimc` (4 chunks, 37 088 bytes). It is the golden file of `__tests__/bim` and of `kit8/docker/test_bim_example1.sh`.
* `example1/example1.demo.json` - the same, in one json (chunks as base64) for the offline demo `/pm/bim/example`.
* Example 2 (Archicad Vacation Home) was dropped by the owner on 2026-11-20 (one example only).
