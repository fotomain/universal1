// The rows create_budget_item_table.sql generates from the managementGenusTable seed (INSERT ... SELECT): ...Genus -> ...BudgetFolder / ...BudgetItem.
import { genusRows } from '../resourcerole/resourceRoleTestKit';

export function budgetSeedRows(): any[] {
  const genus = genusRows() as any[];
  const folders = genus.filter((g) => g.rowParentGUID === 'empty').map((g) => ({
    rowGUID: g.rowGUID.replace(/Genus$/, 'BudgetFolder'), rowOwnerGUID: 'budgetItemCatalog', rowParentGUID: 'empty', orderInList: g.orderInList,
    rowJSON: { title: g.rowJSON.title, description: g.rowJSON.description },
  }));
  const items = genus.filter((g) => g.rowParentGUID !== 'empty').map((g) => ({
    rowGUID: g.rowGUID.replace(/Genus$/, 'BudgetItem'), rowOwnerGUID: 'budgetItemCatalog', rowParentGUID: g.rowParentGUID.replace(/Genus$/, 'BudgetFolder'), orderInList: g.orderInList,
    rowJSON: { title: g.rowJSON.title, description: `Budget item: ${g.rowJSON.description}`, managementGenusItem: g.rowGUID },
  }));
  return [...folders, ...items].sort((a, b) => a.orderInList - b.orderInList);
}
