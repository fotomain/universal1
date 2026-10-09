# Management genus

`managementGenusTable` - the management classes of resources and money, two levels in one table: **folders** (level 1) and **items** (level 2):

```
costsGenus      > timeGenus, materialGenus, expenseGenus
revenuesGenus   > revenueGenus
paymentsGenus   > inboundPaymentGenus, outboundPaymentGenus
```

rowGUID = the code · rowOwnerGUID `managementGenusCatalog` · rowParentGUID = the folder ('empty' = the row IS a folder) · rowJSON `{ title, description }`.
Only the items are genus a role type can have.
`resourceRoleTypeTable.rowJSON.managementGenus` points at a row (Human Resources → `timeGenus`, see `kit8/catalog/resourcerole/README.md`).

- Run `kit8/sql/init/create_management_genus_table.sql` (table, RLS for signed-in users, realtime, the 8 rows; `delete_management_genus_table.sql` removes it).
- Route `/catalog/management/genus/list` (drawer **Management genus**) → `ManagementGenusDashboardCRUD.tsx`: `FolderTreeReusable` with the 3 FOLDERS beside a
  `ReusableTable` with the ITEMS (pick a folder = its items; no "No folder" row, no subfolders). Columns: Genus, Code, Folder, Description, Role types (how many use it).
- **`noCrud` is true by default**: no add / duplicate / delete / reorder, no row menu, no check boxes, cells not editable, tree without CRUD and drag. The lock button in
  the header (or `<ManagementGenusDashboardCRUD noCrud={false} />`) turns editing on: table CRUD (a new item goes into the picked folder, or the first one) plus create /
  rename / reorder / delete of folders in the tree (`useManagementGenusTree`; deleting a folder deletes its items; "new subfolder" and a folder dragged into a folder are refused).

| File | What |
|---|---|
| `managementGenusModel.ts` | table, route, seed codes, `managementGenusNodes` / `managementGenusPath` / `managementGenusDescendants` |
| `managementGenusMetaData.ts` | SystemMetaData entry (spread into `kit8/redux/SystemMetaData.ts`) |
| `useManagementGenusData.ts` | rows from redux (read + realtime) and the role types (read only, for the count) |
| `useManagementGenusTree.ts` | the `foldersTree` binding of ReusableTable: read-only, or with CRUD saved through redux |
| `ManagementGenusDashboardCRUD.tsx` | the screen |
