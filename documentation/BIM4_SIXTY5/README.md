# BIM4 Sixty5 - cost and time plan (Time / Material / Expense lines)

Project `6c70450d-4e27-4a56-8e7f-4698e30e2ac4` (BIM import of `arc.ifc`: 19 stages = storeys, 1 639 tasks). The import had no lines and one placeholder day per task. This folder makes the
**Task -> Edit** data of it: for every task the Time, Material and Expense lines, a realistic build order with named crews, and Post.

## What is in the data (built 2026-11-20)

| | |
|---|---|
| tasks | 1 639 (all with lines), 19 stages |
| lines | 14 468: Time 6 280 · Material 3 280 · Expense 4 908 |
| money (EUR excl. VAT) | time 1 829 075.27 · material 5 501 195.15 · expense 272 193.40 · **total 7 602 463.82** |
| people | 63 named persons (Dutch, Polish, Portuguese, Turkish, Moroccan ... names) in 19 trades, hourly cost per role (`rolePriceTable`, price type `pt_cost`) |
| suppliers | 20 companies (fictional), each with a supply contract; 114 products (104 materials, 10 expense services) with purchase prices (`pt_purchase`) |
| dates | 2026-12-10 .. 2028-05-18 (375 working days, Mon-Fri); one storey of structure every 12 working days, envelope ~3 storeys behind, fit-out ~6 storeys behind |
| posted | every task is posted (32 377 plan rows), capacity check `capacityModeBlock` reported 0 busy lines, the busiest person-day has 7.61 h |

Quantities are the **real IFC quantities of the model** (`BaseQuantities`: NetSideArea, NetVolume, NetArea, Area, ... summed per task; counts for pieces), not invented ones.

## Rules of the plan

* **Project settings changed:** the three currencies = EUR (were USD / EUR / GBP; a Dutch project), project dates from the plan, Time of equipment off (equipment is an Expense: tower crane, hoist, access), notes. The calendar is `workingDaysCalendar` (Mon-Fri).
* **Calendars:** `workingDaysCalendar` and `standardWorkWeekCalendar` ended 2027-12-31; `02_calendar.sql` adds the day rows 2028-2030 (same rows as "Fill in Management calendars").
* **Time line = one person**, role from the trade, price = the cost of the hour of the role. Every task also has a foreman (7 % of the man-hours) and the site manager of the trade (2.5 %, RACI Accountable; the crew is Responsible). VAT 0 (own employees).
* **No person above 8 h a day:** the organization posts in `capacityModeBlock` (a booked person above his calendar loses the line). The planner (`build_sixty5_plan.py`) puts the tasks in order of the build phases and gives every task the first start at which every person of its crew has the hours free on every day.
* **Material line** = a product of the catalog (`bld-prd-*`) with its supplier and the supply contract, price = the purchase price of the product, VAT 21 %. Quantities include losses (3-8 %). Budget items: `rawMaterialsBudgetItem` (blocks, mortar, insulation, boards, prefab, timber, roof, steel), `materialBudgetItem` (frames, doors, finishes, sanitary, electrical, kitchens), `consumablesBudgetItem`.
* **Expense line** = tower crane with operator (per hour), hoist, facade access, screed pump, waste (per m3), core drilling, surveying, small tools and site costs per man-hour. Budget items `utilitiesRentInsuranceBudgetItem`, `subcontractedServicesBudgetItem`, `expenseBudgetItem`.
* Every line: business unit `bu_team1costs` (the cost center of the project), distribution `uniformDistribution`.
* **Build phases** (working days after the structure of the storey is ready, `PHASE_OFFSET` in `sixty5_rules.py`): anchors 1 · CS walls + prefab facade 3 · stairs 4 · stelkozijn 6 · insulation + loggia cladding 11 · rough-in (cisterns, meter cupboards, drains) 15 · windows and curtain walls 16 · roof work 20 · partitions (aircrete, metal stud) 24 · ceilings and lining 36 · screeds 42 · tiles 56 · doors 63 · fixtures and kitchens 68 · railings, sills, grilles, trims 74.

## What is NOT in the plan (the model has no such elements)

Piles, foundation, the concrete structure (floor slabs, cores, columns), mechanical / electrical / lift installations, site establishment, design fees, contingency, profit and risk. The IFC is the architectural model: the **7.6 M EUR is the finishing scope** of it. The first storey of structure is assumed ready at working day 110 (April 2027) and one storey every 12 working days; that is an assumption, not data of the model.

## Prices - what was checked and what is an estimate

Checked on the web 2026-11-20 (single points, retail or portals, no price list of a merchant): aircrete block 100 mm 18.33 EUR/m2 incl. VAT (Hornbach, Wüpor) -> 15.20 net used for Ytong; calcium-silicate block L120 31-36 EUR/m2 incl. VAT -> element 28.50 used; PIR 100 mm ~28 EUR/m2 incl. VAT -> 23.50 used (0.235 EUR per mm); Gyproc 12.5 mm board 4-10 EUR/m2 -> 5.20; installed partitions 40-75 EUR/m2 (Bobex, Belgium; our system price 35-60 per m2 material + 0.6 h/m2); aluminium frame + HR++ installed 480-950 EUR/m2 (Werkspot) -> 640 supply + 2.2 h/m2 fit; freelance rates carpenter 49, bricklayer 45, building average 61, crane operator 48-60 EUR/h (Knab, MijnZZP) -> all-in cost of an hour 41-74 (CAO Bouw +4 % on 2026-01-01, employer charges and overhead). **Everything else** (prefab facade 265 EUR/m2, kitchens 5 800, entrance doors 1 120, crane 95 EUR/h, norms in man-hours per m2) is an estimate of a building economist, to be replaced by merchant quotes. Fictional suppliers: the names are made up.

## Files

| file | what |
|---|---|
| `sixty5_input.json` | the 1 639 tasks with IFC class, type, element count and summed quantities (read from the database 2026-11-20) |
| `sixty5_tree.json` | the 1 658 rows (stages + tasks) of the project tree, for the Docker test |
| `sixty5_catalog.py` | roles + rates, suppliers, products, expense items, names |
| `sixty5_rules.py` | task type -> man-hours per trade, materials, expenses, build phase |
| `build_sixty5_plan.py` | the planner and the SQL writer: `python3 -I build_sixty5_plan.py [outdir]` (default `out/`, ~17 MB, not kept in git) |
| `out/01_catalog.sql` ... `05_post_NNN.sql` | catalogs · calendars 2028-2030 · project + task dates · lines (250 a file) · Post (40 tasks a file, as the owner of the project) |

Run order on a database: `01_catalog` -> `02_calendar` -> `03_project_tasks` -> `04_lines_*` -> `05_post_*` (all idempotent). The Post files run as the owner of the project (`SIXTY5_OWNER`, default the real one): `create_task_line_plan` asks `perm_can_in`, a bare `postgres` session does not pass it.

Undo: `DELETE FROM public.task_line_table WHERE "rowProjectGUID" = '<project>'` (the plan rows go with the lines), the catalog rows all have ids `bld-*` (persons: e-mail `@bouwteam-sixty5.example`).

Test: `kit8/docker/test_sixty5.sh` (fresh database, start1 + start2 + start4, the 1 658 rows, the five steps above, 25 assertions: catalog references, prices, sums, no busy person, plan = lines per genus, Monitor01 register) - `ALL OK`.

**fx snapshot (2026-11-20):** every line carries `fxSnapshotTaskLine` (EUR -> EUR, rate 1; day = contract date, else task start). Without it the task window made the snapshot on opening and set `taskIsPosted = false` = "Post needed" on every task the user opened. `out/06_fx_snapshot.sql` adds it to lines of a database made with the older files (idempotent, does not touch `taskIsPosted`); re-running `04_lines_*` resets the lines to unposted, so run `05_post_*` after it.
