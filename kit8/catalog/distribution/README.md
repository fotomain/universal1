# Distribution

`distributionGenericTable` - HOW a budget is spread over the days of a task line (the minimum period is one day). Two levels in one table, like the
[management genus](../management/genus/README.md): **groups** (level 1) and **distributions** (level 2):

```
simpleDistributionGroup   > frontLoadedDistribution, backLoadedDistribution, uniformDistribution
curvesDistributionGroup   > normalDistribution, logarithmicFrontDistribution, logarithmicBackDistribution, epidemicDistribution
customDistributionGroup   > manualDistribution
```

rowGUID = the code · rowOwnerGUID `distributionGenericCatalog` · rowParentGUID = the group ('empty' = the row IS a group) ·
rowJSON `{ title, description, shape, params: [{ key, title, default }], editable }`.
Only manual is `editable` (the user types the value of every period); the other seven are fixed.

- Run `kit8/sql/init/create_distribution_generic_table.sql` (table, RLS for signed-in users, realtime, the 11 rows; `delete_distribution_generic_table.sql` removes it).
- Route `/catalog/distribution/list` (drawer **Distribution**) → `DistributionTypeCRUD.tsx`: `FolderTreeReusable` with the 3 GROUPS beside a `ReusableTable` with the
  DISTRIBUTIONS. Columns: Distribution, Code, Group, Shape, Parameters, Editable, Description.
- **`noCrud` is true by default (as the management genus)**: no add / duplicate / delete / reorder, no row menu, no check boxes, cells not editable, tree without CRUD and
  drag. The lock button in the header (or `<DistributionTypeCRUD noCrud={false} />`) turns editing on.
- Task lines: `task_line_table.rowJSON.distributionForBudgetTaskLine` = the rowGUID of a distribution; the **Budget distribution** column of the Finances table picks it
  (`kit8/pm/view/task/finances/taskLineColumns.tsx`).

## The shares (`distributionShares`)

`distributionShares(code, periods, params)` returns the share of the total of every period (a period = a day, at least one); the shares sum to 1.
`distributeAmount(code, amount, periods, params)` gives the amounts (rounded, the rest goes to the last day, so they add up).
The source document gives the SHAPES, not the formulas; these are the choices made (change them in `distributionModel.ts`):

| code | shape | parameters (default) |
|---|---|---|
| frontLoaded / backLoaded | linear fall from the start / rise to the end | – |
| uniform | equal share | – |
| normal | Gaussian bell | peak 0.5, spread 0.2 (a share of the timeline) |
| logarithmicFront / Back | `ln(1 + k t) / ln(1 + k)` (cumulative), back = mirror | steepness k = 9 |
| epidemic | gamma wave `(t/p)^k e^(k (1 - t/p))`, `k = (p / spread)²` | peak 0.35, spread 0.2 |
| manual | the typed values scaled to sum 1 | `values` (one per period) |

| File | What |
|---|---|
| `distributionModel.ts` | table, route, codes, parameters, tree helpers, `distributionShares` / `distributeAmount` |
| `distributionMetaData.ts` | SystemMetaData entry (spread into `kit8/redux/SystemMetaData.ts`) |
| `useDistributionData.ts` | rows from redux (read + realtime) |
| `useDistributionTree.ts` | the `foldersTree` binding of ReusableTable: read-only, or with CRUD saved through redux |
| `DistributionTypeCRUD.tsx` | the screen |
