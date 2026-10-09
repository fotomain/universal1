// Task lines - the derived fields of a line after a cell changed (pure; the table's computeRowJSON). Order of the rules:
//  1. taskManagementGenusLine = the genus of the tab (the contract templates offered depend on it)
//  2. a role attribute / product attribute the new role / product does not have is cleared; the variant of a person must be one of HIS variants
//     (empty = automatic: the variant that covers the role, see taskLinePersonMatch.ts)
//  3. unit, VAT, price from the catalogs while they are empty / still follow them - for a person the price is the cost of his CONTRACT, else the
//     rate of the role; the price source; the sums (taskLineMoney.ts)
//  4. the sums in the accounting / budget currency of the project, as a snapshot of the exchange rate (taskLineFx.ts) - only when `fx` is given
import { computeLineJSON } from './taskLineMoney';
import { productVariantOptions, roleVariantOptions, suggestForLine, TaskLineCatalogData } from './taskLineCatalogs';
import { personVariants } from './taskLinePersonMatch';
import { computeFx, LineFxContext } from './taskLineFx';
import type { TaskLineGenusDef, TaskLineRowJSON } from './taskLineModel';

export function computeTaskLineRowJSON(
  data: TaskLineCatalogData,
  genus: TaskLineGenusDef,
  json: Partial<TaskLineRowJSON>,
  day?: string,
  fx?: LineFxContext | null,
): Partial<TaskLineRowJSON> {
  const patch: Partial<TaskLineRowJSON> = {};
  let merged: Partial<TaskLineRowJSON> = { ...json };
  const apply = (p: Partial<TaskLineRowJSON>) => { Object.assign(patch, p); merged = { ...merged, ...p }; };

  if (merged.taskManagementGenusLine !== genus.genus) apply({ taskManagementGenusLine: genus.genus });

  const roleKey = merged.resourceRoleAttributeSetKey;
  if (roleKey && !roleVariantOptions(data, merged.resourceRoleItem).some((o) => o.value === roleKey)) apply({ resourceRoleAttributeSetKey: null });
  if (genus.resource === 'product') {
    const key = merged.taskResourceAttributesKey;
    if (key && !productVariantOptions(data, merged.taskResourceItem).some((o) => o.value === key)) apply({ taskResourceAttributesKey: null });
  } else {
    // Time: the variant belongs to the PERSON; another person (or the free text of the first version) clears it
    const key = merged.taskResourceAttributesKey;
    if (key && !personVariants(data, merged.taskResourceItem).some((v) => v.key === key)) apply({ taskResourceAttributesKey: null });
  }

  apply(computeLineJSON(merged, suggestForLine(data, genus, merged, day)));
  if (fx) apply(computeFx(fx, data, genus, merged));
  return patch;
}
