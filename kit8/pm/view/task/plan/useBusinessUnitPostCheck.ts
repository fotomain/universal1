// useBusinessUnitPostCheck - the check "do not post a cost to a revenue center (or a revenue to a cost center)" as a function of a line (layer 2 of the check;
// layer 1 is the unit picker of the line, layer 3 the SQL procedure create_task_line_plan). The lists it needs (units, CFR types, budget items, genus) are read
// from redux once; a project without business units posts exactly as before (the function finds no unit and returns null).
import { useCallback, useEffect, useRef } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { PRODUCT_READ_PARAMS } from '../../../../catalog/product/dashboard/useProductCatalogData';
import { BUSINESS_UNIT_TABLE } from '../../../../catalog/business_unit/businessUnitModel';
import { CFR_TYPE_TABLE } from '../../../../catalog/business_unit/cfrTypeModel';
import { BUDGET_ITEM_TABLE } from '../../../../catalog/budget/item/budgetItemModel';
import { MANAGEMENT_GENUS_TABLE } from '../../../../catalog/management/genus/managementGenusModel';
import type { TaskLineRow } from '../finances/taskLineModel';
import { BusinessUnitLists, lineUnitPostProblem } from '../finances/taskLineBusinessUnit';

const ENTITIES = [BUSINESS_UNIT_TABLE.entity, CFR_TYPE_TABLE.entity, BUDGET_ITEM_TABLE.entity, MANAGEMENT_GENUS_TABLE.entity];

export function useBusinessUnitPostCheck(): (line: TaskLineRow) => string | null {
  const dispatch = useDispatch();
  const lists: any[] = useSelector((s: any) => ENTITIES.map((e) => s?.[e]?.entityDataFromServer), shallowEqual);
  useEffect(() => {
    for (const e of ENTITIES) {
      const actions = SystemMetaData[e]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  }, [dispatch]);
  const live = useRef(lists);
  live.current = lists;
  return useCallback((line: TaskLineRow) => {
    const [businessUnit, cfrType, budgetItem, managementGenus] = live.current.map((l) => (Array.isArray(l) ? l : []));
    // only the lists of the unit rule are needed: the sources are not read here (the unit is already saved on the line)
    const d = { businessUnit, cfrType, budgetItem, managementGenus, resourceRole: [], person: [], equipment: [], product: [], contract: [] } as BusinessUnitLists;
    return lineUnitPostProblem(d, line);
  }, []);
}
