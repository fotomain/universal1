# kit8/pm/components

## PMNumberInputApp

The number input of the **lines of a project task** (`task_line_table`, Finances tabs) and of the **lines of every document** (fact input, purchase order, product receipt, vendor invoice, customer invoice).

| Prop | Meaning |
|---|---|
| `tableName` | the table of the line, e.g. `task_line_table`, `vendor_invoice_lines` - information only (written on the input: web `data-tablename`), so a place can be found by text |
| `tableFieldName` | the field the input edits, e.g. `qtyTaskLine`, `priceInvoiced` - information only (web `data-tablefieldname`) |
| `positiveOnly` | default `true`: a minus sign cannot be typed, the saved number is never below 0 (a bigger `min` still wins; `pmNumberMin`) |
| `value`, `onCommit(n \| null)` | free typing, saved on blur / Enter and only when the value really changed; an emptied input saves `null` |
| `integer`, `min`, `max`, `stepper`, `step`, `placeholder`, `align`, `editable` | as the number cell of ReusableTable |

How the lines use it: `ReusableTable` columns of type `number` / `integer` have the optional `renderNumber`; the helper `pmNumberColumn(tableName, tableFieldName)` fills it:

```ts
{ key: 'qty', title: pmT('Qty'), type: 'number', field: 'qtyTaskLine', min: 0, ...pmNumberColumn(taskLineTable, 'qtyTaskLine') }
```

Used in: `view/task/finances/taskLineColumns.tsx` (Qty, Price, VAT %), `documents/fact/input/factColumns.tsx`, `documents/vendor/{invoice,purchase_order,product_receipt}/…Columns.tsx`, `documents/customer/invoice/customerInvoiceColumns.tsx` (Qty, Price, VAT %). A NEW editable number column in those files must spread `pmNumberColumn(...)` (a test checks it). Read-only cells (sums) and the catalogs keep the stock number cell.

Tests: `__tests__/pm/components/pmNumberInput.test.tsx`.
