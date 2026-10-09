# Template of the resource contract - `templateResourceContractTable`

The contract a task line ASKS FOR before a partner is known (sheet "W1 TASK LINES": "for future supplies independent from Partner here"). It works like
a template for FUTURE partner relationships: the terms (requirements, payment, delivery, VAT, validity) are written once; when a partner is chosen, a real
contract (`contractTable`) is made from the template.

| column | value |
|---|---|
| `rowGUID` | the template |
| `rowOwnerGUID` | `managementGenusTable.rowGUID` of a LEAF genus: `timeGenus` · `materialGenus` · `expenseGenus` · `revenueGenus` |
| `rowParentGUID` | 'empty' |
| `rowJSON` | `title, description, requirements, contractType, paymentsPeriod, paymentTermDays, currency, vatRate, deliveryTerms, validityDays, isActive` |

* **Screen**: `TemplateResourceContractCRUD.tsx` (route `/catalog/management/templateresourcecontract/list`, drawer **Resource contract templates**): chips per genus +
  a ReusableTable (add / duplicate / reorder / delete + Undo, search, sort + filter, export, realtime). `genus` prop = one genus without chips.
* **Task line** (`kit8/pm/view/task/finances`): `task_line_table.rowJSON.resourceContractTemplateTaskLine` is picked from the templates of the line's genus
  (`task_line_table.rowJSON.taskManagementGenusLine`, kept equal to the genus of the tab). It replaces the old "Contract" cell of Material / Expense / Revenue
  lines; Time lines keep `taskResourceContract` = the contract of the PERSON, the source of the cost.
* SQL: `kit8/sql/init/create_template_resource_contract_table.sql` (+ `delete_template_resource_contract_table.sql`), after `create_management_genus_table.sql`.
* Not built yet: "make a contract from the template" for a chosen partner.
