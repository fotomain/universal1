// Task lines - the derived fields of a line after a cell changed (pure; the table's computeRowJSON). Order of the rules:
//  1. taskManagementGenusLine = the genus of the tab (the contract templates offered depend on it)
//  2. the KIND of a Time line (person | equipment | work center, taskLineResource.ts): a resource of the other kind (a person on an equipment line) and a role of the other kind
//     are cleared with their variant and contract - changing the kind is like changing the partner, the cells that depended on it go; a work center follows its BASE: a Person
//     work center has a person's roles and the contract of its person, an Equipment / Partner work center an equipment's roles and no contract. The menu "Resource: Person | Equipment |
//     Partner" (taskWorkCenterKind) makes the line a WORK CENTER line and chooses which work centers are offered: a work center of another kind goes, a work center chosen is the menu's kind;
//     a role attribute / product attribute the new role / product does not have is cleared; the variant of a person / equipment must be one of ITS variants
//     (empty = automatic: the variant that covers the role, see taskLinePersonMatch.ts)
//  3. unit, VAT, price from the catalogs while they are empty / still follow them - for a person the price is the cost of his CONTRACT, else the
//     rate of the role; the price source; the sums (taskLineMoney.ts)
//  4. the sums in the accounting / budget currency of the project, as a snapshot of the exchange rate (taskLineFx.ts) - only when `fx` is given
//  4b. the business unit of the line (taskLineBusinessUnit.ts): from the first source that has a unit taking the kind of the line, while the line follows the sources
//  5. taskIsPosted = false: this function runs when a cell of the line was changed by the user, and ANY change of the line's data makes its posted
//     days (task_line_plan) out of date. Only the SQL procedure create_task_line_plan sets it true again.
import { computeLineJSON } from './taskLineMoney';
import { productVariantOptions, roleVariantOptions, suggestForLine, TaskLineCatalogData } from './taskLineCatalogs';
import { personVariants } from './taskLinePersonMatch';
import { lineBaseItem, lineResourceKind, lineWorkCenter, lineWorkerKind, resourceBelongsToOtherKind, roleResourceKind } from './taskLineResource';
import { computeFx, LineFxContext } from './taskLineFx';
import type { TaskLineGenusDef, TaskLineRowJSON } from './taskLineModel';
import { businessUnitPatch, ProjectCenters } from './taskLineBusinessUnit';

export function computeTaskLineRowJSON(
  data: TaskLineCatalogData,
  genus: TaskLineGenusDef,
  json: Partial<TaskLineRowJSON>,
  day?: string,
  fx?: LineFxContext | null,
  /** the four business unit centers of the project (the last source of the unit of the line) */
  project?: ProjectCenters | null,
): Partial<TaskLineRowJSON> {
  const patch: Partial<TaskLineRowJSON> = { taskIsPosted: false };
  let merged: Partial<TaskLineRowJSON> = { ...json, taskIsPosted: false };
  const apply = (p: Partial<TaskLineRowJSON>) => { Object.assign(patch, p); merged = { ...merged, ...p }; };

  if (merged.taskManagementGenusLine !== genus.genus) apply({ taskManagementGenusLine: genus.genus });

  // the menu of work center kinds was used: the line books work centers now (a person / equipment it held directly is of the other catalog: cleared below)
  if (genus.resource !== 'product' && merged.taskWorkCenterKind && lineResourceKind(genus, merged) !== 'workCenter') apply({ taskResourceKind: 'workCenter' });

  const kind = lineResourceKind(genus, merged);
  if (kind === 'workCenter') {
    const wc = lineWorkCenter(data, genus, merged);
    const wcKind = wc?.rowJSON?.workCenterKind;
    if (wc && merged.taskWorkCenterKind && wcKind !== merged.taskWorkCenterKind) apply({ taskResourceItem: null, taskResourceAttributesKey: null, taskResourceContract: null });   // the menu changed: a work center of the other kind goes
    else if (wc && merged.taskWorkCenterKind !== wcKind) apply({ taskWorkCenterKind: wcKind });                                                                                    // a work center was chosen: the menu follows it
  }
  if (kind !== 'product') {
    // Time: the kind changed - the resource of the other kind, the contract of a person on an equipment line and a role of the other kind go
    if (resourceBelongsToOtherKind(data, kind, merged.taskResourceItem)) apply({ taskResourceItem: null, taskResourceAttributesKey: null, taskResourceContract: null });
    const worker = lineWorkerKind(data, genus, merged);
    if (worker === 'equipment' && merged.taskResourceContract) apply({ taskResourceContract: null });
    // a work center: the contract must be one of ITS person (another work center of another person took the line)
    if (kind === 'workCenter' && merged.taskResourceContract) {
      const contract = data.contract.find((c) => c.rowGUID === merged.taskResourceContract);
      if (contract && contract.rowOwnerGUID !== lineBaseItem(data, genus, merged)) apply({ taskResourceContract: null });
    }
    const role = data.resourceRole.find((r) => r.rowGUID === merged.resourceRoleItem);
    if (role && roleResourceKind(data, role) !== worker) apply({ resourceRoleItem: null, resourceRoleAttributeSetKey: null });
  }

  const roleKey = merged.resourceRoleAttributeSetKey;
  if (roleKey && !roleVariantOptions(data, merged.resourceRoleItem).some((o) => o.value === roleKey)) apply({ resourceRoleAttributeSetKey: null });
  if (kind === 'product') {
    const key = merged.taskResourceAttributesKey;
    if (key && !productVariantOptions(data, merged.taskResourceItem).some((o) => o.value === key)) apply({ taskResourceAttributesKey: null });
  } else {
    // Time: the variant belongs to the PERSON / EQUIPMENT; another one (or the free text of the first version) clears it
    const key = merged.taskResourceAttributesKey;
    if (key && !personVariants(data, merged.taskResourceItem).some((v) => v.key === key)) apply({ taskResourceAttributesKey: null });
  }

  apply(computeLineJSON(merged, suggestForLine(data, genus, merged, day)));
  if (fx) apply(computeFx(fx, data, genus, merged));
  apply(businessUnitPatch(data, genus, merged, project));
  return patch;
}
