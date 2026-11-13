# Cost calculator - `kit8/system/costcalculator`

What the application costs to own per month. The administrator types how big his work is (projects, tasks, plan lines, users, changes, ROI, reports) and the screen answers with the **Supabase cloud bill**: the total, the virtual machine that is needed and the numbers behind them. Spec and reasoning: `documentation/PRICE_PLAN_CALCULATOR.html` (its "Live sketch" is the reference of the model).

* **Route** `/system/costcalculator` = `app/system/costcalculator.tsx` (Drawer: **System settings → Cost calculator**, `CustomDrawerContent.tsx` + the `Drawer.Screen` in `app/_layout.tsx`). **Administrator only** (spec Q3): the menu row is hidden for everybody else and the screen says so.
* **Estimate, not the invoice.** USD per month for ONE Supabase project, as if this organization had it alone (spec Q4). Many numbers are assumptions marked **A** in the coefficients (M = measured, B = benches, S = a rule); calibrate them on a real project (spec task W2).
* **Remembered on the device** (spec Q8, phase 1): the last parameters (`costCalculator.input.v1`) and the changed coefficients (`costCalculator.coefficients.v1`) in AsyncStorage. A broken stored value is ignored.

## What the screen shows
Left: the parameters (the owner's list; **Advanced** folded: fill, plan rows per line, users online, opens, versions, months kept, pg_cron cleaned, Realtime, plan, second environment, point in time recovery, domain, IPv4) and the folded **Model coefficients** (editable, Reset). Example buttons (Small team · Medium · Large · Very large) and **Reset**.
Right: total per month / year, per user, per project · the virtual machine and **why** a smaller one was rejected (memory | CPU | database size | biggest project | point in time recovery) · headroom · **"the next size is needed at about N projects / M users"** (the model is run upward: projects, users and their activity grow together) · the bill by lines (0 = "included") · database, disk to pay for, tasks / lines / plan rows, memory, vCPU, the three biggest parts of the database · bars of Realtime connections, messages and egress against the included amounts · disk after 12 and 24 months · date and source of the price list (a warning while it is the built-in snapshot or older than 30 days).

## The model (pure, no React) - `costModel.ts`
`calculateCosts(input, prices, coefficients)` → volumes → disk / CPU / memory / Realtime / egress → the FIRST machine size that passes five tests (memory, CPU at 60 % target load, database size, biggest project, point in time recovery) → dollars (plan fee + machine minus credits + second environment + disk, egress, Realtime, users above the included amounts + add-ons). `nextMachineChange`, `diskAfterMonths`, `normalizeCostInput`, `COST_EXAMPLES` are there too. Free plan is never an answer (spec Q6).

| File | What |
|---|---|
| `costModel.ts` | the parameters (`CostInput`, defaults, normalize), `calculateCosts`, `nextMachineChange`, `diskAfterMonths`, the four examples |
| `costCoefficients.ts` | EVERY number of the model in one table with its source (M / B / A / S) + the descriptions for the screen |
| `supabasePrices.ts` | the price list type, the built-in snapshot of 2026-11-12, `validatePriceList`, age / state |
| `costFormat.ts` | `formatUsd` (100 or more without cents, like the sketch), `formatNumber`, `formatKB`, `formatPercent` |
| `costFields.ts` | the parameters of the screen in order, with labels and hints (`pmT` keys) |
| `useCostCalculator.ts` · `useStoredValue.ts` | the state, the model run, what is remembered on the device |
| `CostCalculatorScreen.tsx` · `CostCalculatorInputs.tsx` · `CostCalculatorResults.tsx` · `CostFieldRow.tsx` | the screen |

## Not built (later rounds, spec sections 8-11)
* The **price fetcher** (Edge Function `supabase-prices`, table `supabase_price_history`, "Refresh prices", a price typed by hand that wins): the screen uses the built-in snapshot and says so. The list has the shape the fetcher will store, and `validatePriceList` already holds the checks it needs.
* **Fill from this database** (RPC `application_usage_facts()`), the second currency, saved scenarios, shared / dedicated switch, margin (sales plans).
* W2 calibration of the A coefficients on a real Supabase project; the daily cleanup of the pg_cron log (finding F1, W6) is a separate SQL change.
* No SQL is needed for this round.

Tests: `__tests__/system/costcalculator` (`costModel.test.ts` compares the port with the numbers of the spec's sketch from `fixtures/sketchGolden.json`; `supabasePrices.test.ts`; `costCalculatorScreen.test.tsx`), the menu in `__tests__/drawer-catalogs.test.tsx`.
