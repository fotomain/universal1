# Work centers - `kit8/catalog/work_center`

A **work center** is a Person, an Equipment or a Partner (a supplier) as a RESOURCE a Time line of a task can book - with its own calendar and its own variant. It stands for ONE catalog item (its **base**).
Design and decisions: `documentation/WORK_CENTER_WBS.html`. SQL: PART 35 of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (+ the `workCenter` branches in PARTs 17, 21, 23, 26, 27, 33); undo: PART 1a-000 of `delete_sql_structure.sql`.

## Data - `workCenterTable`

`rowGUID` · `rowOwnerGUID 'workCenterCatalog'` · **`rowParentGUID` = the folder = the business unit** · `orderInList` · `rowJSON`:

| key | |
|---|---|
| `workCenterKind` | **required**: `person` \| `equipment` \| `partner` (chosen when the work center is made; it does not change in the table) |
| `workCenterBase` | **required**: the rowGUID of a `personTable` / `equipmentTable` / `partnerTable` row of the kind. A catalog item is the base of **ONE** work center (unique index on kind + base). Work centers are made by hand: nothing is migrated |
| `workCenterBaseVariant` | the `descriptorKey` of a variant of the BASE (what Copy Variant settings copies); a select that depends on the kind and the base (a partner has no variants) |
| `workCenterVariant` | the `descriptorKey` of the work center's OWN variant: a `variantTable` row (+ its `variantValueTable` rows) owned by the work center. Made by the button, never typed (a trigger refuses it) |
| `resourceCalendar` | = the **workCenterCalendar**: a RESOURCE calendar (the full person calendar model: hours per day, week modes, vacation / sick leave, Fill, own copy, busy check, calendar lock); empty = the Standard work week |
| `businessUnit` | **required** (R10), from the existing `businessUnitTable`; always equal to `rowParentGUID` (a trigger keeps them in step both ways: a drag onto another folder changes the unit) |
| `workCenterTitle` | empty = the name of the base (filled by the trigger) |
| `isActive` | an inactive work center is not offered on new lines (the one on a line stays) |

**Rules in SQL** (trigger `work_center_check`, Docker test `kit8/docker/tests/35_work_center.sql`): a kind, a base of that kind, a business unit; a Partner needs `partnerIsSupplier` - **checked when the work center is saved with that base**, a partner that loses the flag later changes nothing; one base, one work center; a booked work center is not deleted (deactivate it).

## Screen - `WorkCenterCRUD` (drawer: Catalogs → Work centers, route `/catalog/work/center`)

A `ReusableTable` with the **folders = business units**: a folder is shown only while a work center is in it (with the units above it) - it appears with the first work center and is hidden again with the last one (`workCenterFolderNodes`). The tree is read only (the units are edited in Business units).
`+` opens the New work center window (`WorkCenterNewModal`: kind → a FREE base of that kind → business unit → title → calendar). Columns: Title · Kind · Base · Base variant · Work center variant · **Copy Variant settings** (button, also in the row menu) · Calendar · Business unit · Active.

**Copy Variant settings** (`work_center_copy_variant_settings(workCenter, overwrite)`): a one-time copy of the chosen base variant - the variant row and its values - owned by the work center; later changes of the base variant do not reach it. A work center has ONE variant of its own: when it has one the screen **asks first**, and only after "Overwrite" calls the RPC with `overwrite = true`.

## On a Time line (`kit8/pm/view/task/finances`)

* Project settings → Time → **Time of work center input needed** (`projectTimeOfWorkCenterNeeded`, default off, `kit8/pm/model/taskInputScope.ts`): the menu **Resource: Person | Equipment | Partner** is the KIND of the work centers, and the ONE column **Person / Equipment / Partner** lists the work centers of that kind (active ones; `lineMenuKind`). A new Time line starts on Person. A line made before work centers (it holds a person / equipment directly) keeps its person / equipment: the column still picks from that catalog and the menu shows its kind; choosing another kind in the menu turns it into a work center line.
* The menu is stored as `taskWorkCenterKind` ('person' | 'equipment' | 'partner'); the line says `taskResourceKind = 'workCenter'`, `taskResourceItem` = the work center. Choosing a work center makes the menu follow it; changing the menu clears a work center of another kind. The rules follow the **base** (`lineWorkerKind`, `lineBaseItem` in `taskLineResource.ts`): a Person work center books a person's roles and is costed by the contract of its person; an Equipment and a Partner work center book an equipment's roles and are costed by the rate of the role. The variants are the work center's own, the property values the base's.
* The business unit of a work center is the default unit of the lines that book it (the "resource" source of `taskLineBusinessUnit.ts`).
* **Calendar / capacity**: the Post busy check, the calendar lock and the conflict window work for the kind `workCenter` (`organization_resource_capacity_info('workCenter', ...)`): the capacity is the work center's calendar, else the Standard work week. A work center has no contract, so the contract-calendar priority of a person does not apply to it.
* **Vendor**: a Partner work center IS the vendor of its lines (vendor invoice candidates, ROI "has a vendor"); an Equipment work center has the main vendor of its equipment; a Person work center none.
* Reports: the Costs page has the tile **Time of work centers**.

## Known limits

* A person that has a work center can still be booked directly (old lines). The two are different resources for the busy check: their hours are not added up.
* The Fact / invoice / order lines show a work center by its title; their candidates logic is the one above.
* Changing the kind of a work center = delete (while no Time line books it) and make a new one.

## Files

| File | What |
|---|---|
| `workCenterModel.ts` | table, kinds, row shape, bases (free, supplier), variants, folders, validation |
| `workCenterMetaData.ts` | SystemMetaData entry (`workCenterReusable`) |
| `useWorkCenterData.ts` | work centers + catalogs from redux |
| `workCenterApi.ts` | Copy Variant settings (RPC) |
| `WorkCenterCRUD.tsx` · `WorkCenterNewModal.tsx` | the screen and the "+" window |

Tests: `__tests__/catalog/work_center` (model, SQL text, screen, window), `__tests__/pm/view/task/finances/taskLineResource.test.ts` (the Time line), `taskLineBusinessUnit.test.ts`, `__tests__/pm/model/taskInputScope.test.ts`, `kit8/docker/tests/35_work_center.sql`.
