# CAKE1 - the first manufacturing plan of the eco supercakes (ARCHIVE)

The first run: 8 vegan eco cakes of 5 kg, 200 cakes a position in January, 9 confectioners (Early 6 + Late 3), 1 958 rows, 3 252 task lines = 64 632.16 EUR, project GUID `8e3e5544-5d86-4831-b116-420e6f9bde87` (marked **"do not use"**).

**The current run (CAKE2, 160 cakes on 1 + 2 Jan 2026, the hour-by-hour model) lives in `documentation/CAKE2`** (moved there 2026-11-18, with its generator, catalog SQL, csv, checker and INIT_STAGE.html).

| File | What |
|---|---|
| `cake_v0_month200_optimization.py` | the CP-SAT model + generator of the first run (about 17 min) |
| `cake1_plan_json.json` | the plan in the exchange format `kit8.pm.project` v1 (day model: `manualStartAt` + `startHourStart` / `planMinuteStart` fields) |
| `check_cake1_plan.py` | independent re-count of the json |
| `INIT_STAGE_month200.html` | the init stage of the first run |

Tests: `__tests__/pm/crud/exchange/cake1Plan.test.ts`, `cake1PostPlan.test.ts`, Docker `kit8/docker/test_cake1.sh` (all skip when the json is missing).
