# Payment plan of a task (`kit8/pm/view/task/payments`)

When the money of a task moves: the project manager plans the **payments** of a task (money out / money in) for his forecast. Design and decisions: `documentation/PAYMENTS_PLAN_WBS.html`.
SQL: **PART 37** (`start1_sql_tables.sql` tables, `start2_sql_code.sql` code, `delete_sql_structure.sql` part `1a-00000`). Docker test: `kit8/docker/tests/95_payment_plan.sql` (`./test_fact_monitor01.sh 95`).

## Where it is
The fifth tab **Payments** (`TabPayments`) of the Finances view of a task (`PMProjectTaskInputCRUD`, after Time / Material / Expenses / Deliverable; not shown while the screen is a picker). Its content is `PMTaskPaymentPlan`:
three sub-tabs **Outbound · Inbound · Cash flow**. Outbound / Inbound = the table of the payments of that direction; **Cash flow is EMPTY** (a note; the report of the POSTED payments comes later and reads `task_payment_plan_movements`).

## The data
`task_payment_plan_lines`: one row = one planned payment. `rowOwnerGUID` = the task, `rowParentGUID` = `'outbound' | 'inbound'`, `rowJSON` = `TaskPaymentPlanRowJSON` (`paymentPlanModel.ts`).

| Key | Meaning |
|---|---|
| `paymentPlanPartner` / `paymentPlanPerson` | the payee (never both; a person only on Outbound) |
| `paymentPlanContract`, `paymentPlanCurrency` | contract of the payee; currency = its currency, else the project's (never typed) |
| `paymentPlanBudgetItem` | a budget item of the **payments genus** of the direction. Default = `paymentBudgetItemOutbound` / `Inbound` of the contract. **Editable on the line** (`paymentPlanBudgetItemSource = 'line'`: it stays when the contract changes or a fill refreshes) |
| `paymentPlanBusinessUnit` | default: `businessUnitAssigned` of the contract |
| `paymentPlanTimelineAnchor` | `taskStart` (default) \| `taskEnd`: what the shift is counted from |
| `paymentPlanTimelineShiftDays` | days after the anchor, **>= 0**. Default: contract -> payment terms of the partner (supplier data for Outbound, customer data for Inbound) -> 0 |
| `paymentPlannedTransactionDate` | `YYYY-MM-DD`; typed, or anchor + shift. Shift and date follow each other (`paymentPlanDates.ts`; `paymentPlanDateSource` / `paymentPlanDateSnapshot` say which was typed) |
| `sumForContract` / `sumForAccounting` / `sumForBudget` | **all WITH VAT** (cash). The last two: snapshot of the exchange rate **of the planned date** (`paymentPlanMoney.ts`, same code as the task lines) |
| `paymentPlanSource` | `{ genus, taskLineGUIDs }` when a fill button made the payment |
| `paymentIsPosted` / `paymentEverPosted` | any change sets the first false (the database too); Post sets both true |

**Pitfall:** on a task line `sumForBudget` is NET; here the three sums are WITH VAT. The VAT basis switch (`kit8/pm/vat`) does not apply to this table.

## Rules (all plain functions, unit tested in `__tests__/pm/view/task/payments`)
- `paymentPlanCompute.ts` - `computePaymentPlanRowJSON` (the table's `computeRowJSON`): direction, payee (partner xor person), contract owner, currency, budget item follows the contract while it is empty or still the item the app took (`paymentPlanBudgetItemAuto`), business unit, default shift, shift <-> date, converted sums, unposted. `paymentPlanProblems` = the Errors column.
- `paymentPlanDates.ts` - the date rules: never before the task START; with the project switch `paymentPlanAfterTaskFinishEnabled` OFF never after the task END (Project settings -> **Payments**, true by default); a date before the chosen anchor needs a negative shift: "choose the anchor Task start".
  The task moves: a payment dated by its shift moves with it, a payment with a typed date keeps the date and gets a new shift (`usePaymentPlanFollowsTask`).
- `paymentPlanFill.ts` - **Fill / refresh from Time · Material · Expense lines** (Outbound) / **Deliverable lines** (Inbound): ONE payment per group (payee x contract x business unit), sum = sum + VAT of the lines. Time lines of **persons** pay the person with his contract; a Partner work center its partner; equipment and products their main vendor. A second press matches groups to made payments by their lines and keeps everything the user typed (date, anchor, budget item, payee ...); a made payment with no group any more is removed (asks first); hand made payments are never touched.

## Post
`post_task_payment_plan(task, first day, last day)`: ALL payments of the task or none. It refuses with the list `{ lineGUID, problem }` (`paymentPlanApi.ts` has the sentences) when a payment lacks budget item / payee / contract / currency / sum / date, the date breaks the rules, or a converted sum is missing while the project has that currency. Otherwise it replaces the movements of the task (`task_payment_plan_movements`, one row per payment, the three sums with VAT) and sets `paymentIsPosted`.
Changing or deleting a payment, or moving the task, unposts it (trigger). The button is the Post button of the `ReusableTable` (visible only while there is something to post). No register, no Monitor01, no ROI reads the movements yet.

## Files
`paymentPlanModel.ts` (row, tabs, post state) · `paymentPlanDates.ts` · `paymentPlanMoney.ts` · `paymentPlanCompute.ts` · `paymentPlanFill.ts` · `paymentPlanApi.ts` (RPCs) · `paymentPlanMetaData.ts` (redux entity `taskPaymentPlanReusable`) · `paymentPlanColumns.tsx` · `usePaymentPlan.ts` (rows + realtime, environment, follows-the-task, Post) · `PMTaskPaymentPlan.tsx` (the tab).
Outside this folder: the contract keys `kit8/catalog/contract/contractPaymentModel.ts`, the partner key in `partnerModel.ts` (`partnerPaymentShift`), `view/project/settings/PMProjectPaymentsTab.tsx`.
