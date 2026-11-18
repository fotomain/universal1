# CAKE2 - manufacturing plan of the eco supercakes (the current run)

Demo project for appPM80 made by OR-Tools: 8 vegan eco cakes of 5 kg, batches of 10, confectioners in shifts with breaks, machines, purchase orders placed >= 2 days before delivery, goods receipt. Project `c79ba49f-5795-470f-899d-ed412eeb7cb5` (named CAKE2; the first run, `documentation/CAKE1`, `8e3e5544-...`, is marked "do not use").

**Plan:** 8 cakes x 20 = 160 cakes, production **Thu 1 + Fri 2 Jan 2026**, purchasing before it (orders Mon 29 Dec, delivery Wed 31 Dec), **8 confectioners** (Early 4 + Late 4), 249 rows, 302 links, **370 task lines**: 162 Time on 11 real persons, 192 Material on real products + suppliers, 16 Deliverable cakes; cost 6 631.56 EUR, revenue 8 320 EUR, ROI1 25.5 %.

**The hour-by-hour model (2026-11-18):** the project is set to `resourceOptimizationMode = hourByHourModel` (grain `minute`, step 1 minute, project day 00:00-24:00, UTC) with Resource optimization ON (Automatic, Leveling, client side, order `priorityStandard`; all keys in `RESOURCE_LEVELING_SETTINGS` of the generator). Every task has `taskStartMinute` + `taskDurationMinutes`, every link is FS lag 0, every person has a **calendar** (his shift windows + his day off) that the minute check of Post reads. See section 9a of `INIT_STAGE.html`.

| File | What |
|---|---|
| `cake_v1_optimization.py` | the CP-SAT model + the generator: writes `total_costs.csv` FIRST, builds the WBS FROM it, then `cake2_plan_json.json` and `CAKE2_CATALOG_DATA.sql`. `python3 cake_v1_optimization.py` (about 7 min; `--quick` about 1.5 min). Needs `python3 -m pip install --upgrade ortools` (global). It stops when a Time line is outside the window of its person's calendar, when a link is not FS-feasible to the minute, or when lines and csv disagree. |
| `CAKE2_CATALOG_DATA.sql` | the REAL catalog rows the lines book: 11 persons + employment contracts (hour = month sum / 168 h) + **11 resource calendars with 4 048 day rows** (the contract points to the calendar), 12 roles + cost rates, 8 suppliers + 1 customer with contracts, 38 products + 46 prices. Idempotent, paste and run in the Supabase SQL editor **BEFORE the import** (needs start1 + start2 + start4); undo block at the end. |
| `total_costs.csv` | the workers and the materials the plan needs and what they cost (summary / labour / material / packaging / cake / total). The task lines of the json add up to it. |
| `cake2_plan_json.json` | format `kit8.pm.project` v1 for the project `c79ba49f-...` (14 custom columns, EUR, `sixDayWeekCalendar`, the hour-model + leveling settings, `cake2Roster` = shifts / days off the calendars are made from - the importer ignores it). Import: Project settings -> Import / Export -> Import. |
| `check_cake2_plan.py` | independent re-count of the json + csv (10 sections, incl. the minutes, calendars and capacity). `--after-post` + a json READ BACK from the database checks what is stored. |
| `INIT_STAGE.html` | the init stage: the task, the model, the people, the costs, the catalogs, the purchase plan, the hour model (9a), the import, the checks. |
| `kit8/docker/test_cake2.sh` | the file through the real schema: import as `authenticated` -> Post of every task in the hour model (slices + minute check in `capacityModeBlock`) -> Monitor01, assertions on every sum (`ALL OK`). |

Tests: `__tests__/pm/crud/exchange/cake2Plan.test.ts` (the json through the app's parser, import planner and the **hour scheduler** (every task on its minute), the settings, the business rules, the calendar fit, csv = lines), `cake2PostPlan.test.ts` (the app's own Post calculation with the hour slices of every task), `cakePlanExport.test.ts` (writes the rows of a REAL import: `CAKE_PLAN_OUT=<out> CAKE_TARGET=<project row json>`). All skip when the json is missing.

**Needs for Post in the hour model:** the SQL PART 53 (`start2_sql_code.sql`) in the database; without it the app's Post writes day rows only.

Import of a big file: the tasks go in through the RPC `project_import_tasks` (SQL PART 40), links and lines in chunks, reads of a project are paged (PostgREST returns at most 1000 rows). The importer reads json only - the csv is a report.
