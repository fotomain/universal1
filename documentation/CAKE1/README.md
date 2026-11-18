# CAKE1 - manufacturing plans of the eco supercakes

Demo projects for appPM80 made by OR-Tools: 8 vegan eco cakes of 5 kg, batches of 10, confectioners in shifts with breaks, machines, purchase orders placed >= 2 days before delivery, goods receipt. Two runs:

| Run | Project | Plan | Files |
|---|---|---|---|
| **RUN1 (current)** | `c79ba49f-5795-470f-899d-ed412eeb7cb5` (named CAKE2) | 8 cakes x **20** = 160 cakes, production **Thu 1 + Fri 2 Jan 2026**, purchasing before it (orders Mon 29 Dec, delivery Wed 31 Dec), **8 confectioners** (Early 4 + Late 4), 249 rows, 302 links, **370 task lines**: 162 Time on 11 real persons, 192 Material on real products + suppliers, 16 Deliverable cakes; cost 6 631.56 EUR, revenue 8 320 EUR | `cake_v1_optimization.py`, `total_costs.csv`, `cake2_plan_json.json`, **`CAKE2_CATALOG_DATA.sql`**, `check_cake2_plan.py`, `INIT_STAGE.html` |
| first run (archive, GUID `8e3e5544-...` = "do not use") | CAKE1 | 8 cakes x 200 in January, 9 confectioners, 1 958 rows, 3 252 lines = 64 632.16 EUR | `cake_v0_month200_optimization.py`, `cake1_plan_json.json`, `check_cake1_plan.py`, `INIT_STAGE_month200.html` |

| File | What |
|---|---|
| `cake_v1_optimization.py` | the CP-SAT model + the generator: writes `total_costs.csv` FIRST, builds the WBS FROM it, then `cake2_plan_json.json`. `python3 cake_v1_optimization.py` (about 6 min; `--quick` about 1.5 min). Needs `python3 -m pip install --upgrade ortools` (global, nothing is installed here). |
| `CAKE2_CATALOG_DATA.sql` | the REAL catalog rows the lines book: 11 persons + employment contracts (hour = month sum / 168 h), 12 roles + cost rates, 8 suppliers + 1 customer with contracts, 38 products (27 ingredients, 3 packaging, 8 cakes) + 46 prices. Idempotent, paste and run in the Supabase SQL editor **BEFORE the import** (needs start1 + start2 + start4); undo block at the end. The exchange file carries only their ids. |
| `total_costs.csv` | the workers and the materials the plan needs and what they cost: sections summary / labour / material / packaging / cake / total; `needed` = the recipes and the hours, `ordered` = the purchase orders (2 % waste, whole packs). The task lines of the json add up to it (the script stops otherwise). |
| `cake2_plan_json.json` | format `kit8.pm.project` v1 for the project `c79ba49f-...` (planning units day + hour + minute, 14 custom columns, EUR, `sixDayWeekCalendar`). Import: Project settings -> Import / Export -> Import. |
| `check_cake2_plan.py` | independent re-count of the json + csv (9 sections). `--after-post` + a json READ BACK from the database checks what is stored. |
| `kit8/docker/test_cake2.sh` | the file through the real schema: import as `authenticated` -> Post of every task -> Monitor01, assertions on every sum (`ALL OK`). `test_cake1.sh` does the same for the first run. |

Tests: `__tests__/pm/crud/exchange/cake2Plan.test.ts` (the json through the app's parser, import planner and scheduler + the business rules + csv = lines), `cake2PostPlan.test.ts` (the app's own Post calculation on every task), `cakePlanExport.test.ts` (writes the rows of a REAL import into a given project: `CAKE_PLAN_OUT=<out> CAKE_TARGET=<project row json>`). `cake1Plan / cake1PostPlan` are the first run's. All skip when the file is missing.

Import of a big file: the tasks go in through the RPC `project_import_tasks` (SQL PART 40, `start2_sql_code.sql`; test `kit8/docker/tests/42_project_import.sql`), links 250 and lines 250 a call, reads of a project are paged (PostgREST returns at most 1000 rows). The Time lines book a person + his contract, the Material lines a product + supplier, the Deliverable lines a cake product + the customer; Post works in the capacity mode of the organization (no person is over his calendar, so no Resource Leveling is needed); the persons / products / partners are the catalog rows of `CAKE2_CATALOG_DATA.sql` (section 8 of INIT_STAGE.html). The importer reads json only - the csv is a report.
