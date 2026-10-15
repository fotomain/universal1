import React from 'react';
import PMBudgetItemCRUD from '../../../../../kit8/catalog/budget/item/PMBudgetItemCRUD';

// route /budget/item/list - the budget items (folders tree + table); editing is on, the lock button in the header makes it read-only
export default function BudgetItemListScreen() {
  return <PMBudgetItemCRUD />;
}
