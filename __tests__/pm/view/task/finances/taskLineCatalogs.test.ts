import {
  defaultPriceType, emptyTaskLineCatalogs, genusOfRole, lineContractCurrency, lineProblems, productVariantOptions, roleVariantOptions,
  rolesOfGenus, suggestForLine, TaskLineCatalogData,
} from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { computeTaskLineRowJSON } from '../../../../../kit8/pm/view/task/finances/taskLineCompute';
import { taskLineGenusDef } from '../../../../../kit8/pm/view/task/finances/taskLineModel';

const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any, orderInList = 0) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });
const TIME = taskLineGenusDef('timeGenus')!;
const MATERIAL = taskLineGenusDef('materialGenus')!;
const DAY = '2026-10-09';

function catalogs(): TaskLineCatalogData {
  const d = emptyTaskLineCatalogs();
  d.managementGenus = [row('timeGenus', 'managementGenusCatalog', 'costsGenus', { title: 'Time' }), row('materialGenus', 'managementGenusCatalog', 'costsGenus', { title: 'Material' })];
  d.valueAddedTax = [row('vat_0', 'valueAddedTaxCatalog', 'empty', { vatTablePercent: 0 }), row('vat_21', 'valueAddedTaxCatalog', 'empty', { vatTablePercent: 21 })];
  d.measureUnit = [row('unit_hour', 'measureUnitCatalog', 'empty', { title: 'hour' }), row('unit_pcs', 'measureUnitCatalog', 'empty', { title: 'pcs' }), row('unit_kg', 'measureUnitCatalog', 'empty', { title: 'kg' })];
  d.priceType = [row('pt_retail', 'priceTypeCatalog', 'empty', { title: 'Retail' }, 2), row('pt_cost', 'priceTypeCatalog', 'empty', { title: 'Cost' }, 1)];
  // roles: Human resources (time genus, perType variants) > Data analyst; Materials (material genus) > Wood plate role
  d.resourceRoleType = [
    row('type_hr', 'resourceRoleTypeCatalog', 'empty', { title: 'Human resources', managementGenus: 'timeGenus', baseUnit: 'unit_hour', roleVATDefaultRate: 'vat_0', variantMode: 'perType' }),
    row('type_mat', 'resourceRoleTypeCatalog', 'empty', { title: 'Materials', managementGenus: 'materialGenus', baseUnit: 'unit_pcs', roleVATDefaultRate: 'vat_21', variantMode: 'none' }),
    row('type_none', 'resourceRoleTypeCatalog', 'empty', { title: 'No genus', managementGenus: null, baseUnit: 'unit_hour', variantMode: 'none' }),
  ];
  d.resourceRole = [
    row('role_da', 'type_hr', 'empty', { title: 'Data analyst' }),
    row('role_wood', 'type_mat', 'empty', { title: 'Wood plate role' }),
    row('role_x', 'type_none', 'empty', { title: 'Role without genus' }),
  ];
  d.variant = [
    row('v_remote', 'type_hr', 'empty', { title: 'remote, 3 years', descriptorKey: 'dp1=remote|dp2=3y' }, 1),
    row('v_onsite', 'type_hr', 'empty', { title: 'on site', descriptorKey: 'dp1=onsite' }, 2),
    row('v_birch', 'type_wood', 'empty', { title: 'birch', descriptorKey: 'dp3=birch' }, 1),
  ];
  d.rolePrice = [
    row('rp_all', 'role_da', 'empty', { priceTypeGUID: 'pt_cost', price: 40, measureUnit: 'unit_hour', validFrom: '2026-01-01' }),
    row('rp_remote', 'role_da', 'v_remote', { priceTypeGUID: 'pt_cost', price: 55, measureUnit: 'unit_hour', validFrom: '2026-01-01' }),
    row('rp_future', 'role_da', 'empty', { priceTypeGUID: 'pt_cost', price: 99, measureUnit: 'unit_hour', validFrom: '2030-01-01' }),
  ];
  d.productType = [row('type_wood', 'productTypeCatalog', 'empty', { title: 'Wood', baseUnit: 'unit_pcs', productVATDefaultRate: 'vat_21', variantMode: 'perType' })];
  d.product = [
    row('wood_box', 'type_wood', 'empty', { title: 'Wood box', measureUnitDefault: 'unit_pcs', measureUnitForInventory: 'unit_pcs', productVATRate: null }),
    row('wood_free', 'type_wood', 'empty', { title: 'Wood, no price', measureUnitDefault: 'unit_kg', measureUnitForInventory: 'unit_kg', productVATRate: 'vat_0' }),
  ];
  d.productPrice = [row('pp1', 'wood_box', 'empty', { priceTypeGUID: 'pt_cost', price: 12.5, measureUnit: 'unit_pcs', validFrom: '2026-01-01' })];
  d.contract = [
    row('c_eur', 'partnerA', 'partner', { contractCurrency: 'EUR' }), row('c_usd', 'p1', 'person', { contractCurrency: 'USD' }),
    // the contracts of the persons: an employee (3360 per Month = 20 per hour), a contractor (240 per Day = 30 per hour), a one-time contract (no hourly price)
    row('c_emp', 'p_emp', 'person', { contractCurrency: 'EUR', contractSumBeforeVAT: 3360, contractPaymentsPeriod: 'Month' }),
    row('c_con', 'p_con', 'person', { contractCurrency: 'EUR', contractSumBeforeVAT: 240, contractPaymentsPeriod: 'Day' }),
    row('c_once', 'p_con', 'person', { contractCurrency: 'EUR', contractSumBeforeVAT: 5000, contractPaymentsPeriod: 'OneTime' }),
  ];
  // two persons with their own variants (separate from the variants of the role)
  d.person = [row('p_emp', 'personCatalog', 'empty', { personType: 'personTypeEmployee' }), row('p_con', 'personCatalog', 'empty', { personType: 'personTypeContractor' })];
  d.descriptorPlan = [row('dp_emp_v1', 'ds_emp_var', 'seniority', { required: true, sort: 10 }), row('dp_emp_v2', 'ds_emp_var', 'workLanguage', { required: true, sort: 20 })];
  d.variant.push(row('pvar_emp_1', 'p_emp', 'empty', { title: 'Senior, English', descriptorKey: 'dp_emp_v1=dv13|dp_emp_v2=dv15', isActive: true }));
  d.resourceContractTemplate = [row('tpl_mat', 'materialGenus', 'empty', { title: 'Material supply' }), row('tpl_time', 'timeGenus', 'empty', { title: 'Time service' })];
  return d;
}

describe('roles of a genus', () => {
  const d = catalogs();
  it('the genus of a role is the genus of its role type', () => {
    expect(genusOfRole(d, d.resourceRole[0])).toBe('timeGenus');
    expect(genusOfRole(d, d.resourceRole[2])).toBeNull();
    expect(genusOfRole(d, undefined)).toBeNull();
  });
  it('a Time line offers the time roles only', () => {
    expect(rolesOfGenus(d, 'timeGenus').map((r) => r.rowGUID)).toEqual(['role_da']);
    expect(rolesOfGenus(d, 'materialGenus').map((r) => r.rowGUID)).toEqual(['role_wood']);
    expect(rolesOfGenus(d, 'expenseGenus')).toEqual([]);
  });
});

describe('variant options', () => {
  const d = catalogs();
  it('the descriptorKey is the value, the variant title the label (variants of the role type, rule R6)', () => {
    expect(roleVariantOptions(d, 'role_da')).toEqual([{ value: 'dp1=remote|dp2=3y', label: 'remote, 3 years' }, { value: 'dp1=onsite', label: 'on site' }]);
    expect(roleVariantOptions(d, 'role_wood')).toEqual([]);
    expect(roleVariantOptions(d, null)).toEqual([]);
    expect(productVariantOptions(d, 'wood_box')).toEqual([{ value: 'dp3=birch', label: 'birch' }]);
  });
});

describe('default price list', () => {
  it('the first fitting price list by order', () => {
    expect(defaultPriceType(catalogs(), true)?.rowGUID).toBe('pt_cost');
    const d = catalogs();
    d.priceType = [row('pt_prod', 'priceTypeCatalog', 'empty', { appliesTo: ['product'] }, 1), row('pt_role', 'priceTypeCatalog', 'empty', { appliesTo: ['resourceRoleType'] }, 2)];
    expect(defaultPriceType(d, true)?.rowGUID).toBe('pt_role');
    expect(defaultPriceType(d, false)?.rowGUID).toBe('pt_prod');
    d.priceType = [];
    expect(defaultPriceType(d, true)).toBeNull();
  });
});

describe('suggestForLine', () => {
  const d = catalogs();
  it('nothing chosen = no suggestion', () => {
    expect(suggestForLine(d, TIME, {}, DAY)).toBeNull();
  });
  it('a role: its rate now, the base unit of its type, its VAT', () => {
    expect(suggestForLine(d, TIME, { resourceRoleItem: 'role_da' }, DAY)).toEqual({ price: 40, priceSource: 'role', measureUnit: 'unit_hour', vatPercent: 0 });
  });
  it('the rate of the chosen role attributes beats the "all variants" rate; a future rate is not valid yet', () => {
    expect(suggestForLine(d, TIME, { resourceRoleItem: 'role_da', resourceRoleAttributeSetKey: 'dp1=remote|dp2=3y' }, DAY)?.price).toBe(55);
    expect(suggestForLine(d, TIME, { resourceRoleItem: 'role_da' }, '2031-01-01')?.price).toBe(99);
  });
  it('a product: its price, default unit and VAT (the type default 21 % or its own 0 %); the role is the fallback for a product without price', () => {
    expect(suggestForLine(d, MATERIAL, { taskResourceItem: 'wood_box' }, DAY)).toEqual({ price: 12.5, priceSource: 'product', measureUnit: 'unit_pcs', vatPercent: 21 });
    expect(suggestForLine(d, MATERIAL, { taskResourceItem: 'wood_free' }, DAY)).toEqual({ price: null, priceSource: null, measureUnit: 'unit_kg', vatPercent: 0 });
    expect(suggestForLine(d, MATERIAL, { resourceRoleItem: 'role_wood', taskResourceItem: 'wood_free' }, DAY)?.measureUnit).toBe('unit_kg');
  });
  it('Time never reads a product', () => {
    expect(suggestForLine(d, TIME, { taskResourceItem: 'wood_box' }, DAY)).toBeNull();
  });
  it('no price list = no price, the rest is still suggested', () => {
    const none = { ...d, priceType: [] };
    expect(suggestForLine(none, TIME, { resourceRoleItem: 'role_da' }, DAY)).toEqual({ price: null, priceSource: null, measureUnit: 'unit_hour', vatPercent: 0 });
  });
});

describe('computeTaskLineRowJSON (the table\'s computeRowJSON)', () => {
  const d = catalogs();
  it('Time: choosing the role fills price, unit, VAT and the sums follow the quantity', () => {
    const first = computeTaskLineRowJSON(d, TIME, { resourceRoleItem: 'role_da', qtyTaskLine: 10 }, DAY);
    expect(first).toMatchObject({ priceTaskLine: 40, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, priceSourceTaskLine: 'role', sumForContract: 400, sumVATForContract: 0 });
    const next = computeTaskLineRowJSON(d, TIME, { resourceRoleItem: 'role_da', qtyTaskLine: 12, ...first }, DAY);
    expect(next).toEqual({ sumForContract: 480 });
  });
  it('changing the role attributes re-prices the line that still follows the catalog', () => {
    const base = { resourceRoleItem: 'role_da', qtyTaskLine: 1, ...computeTaskLineRowJSON(d, TIME, { resourceRoleItem: 'role_da', qtyTaskLine: 1 }, DAY) };
    expect(computeTaskLineRowJSON(d, TIME, { ...base, resourceRoleAttributeSetKey: 'dp1=remote|dp2=3y' }, DAY)).toMatchObject({ priceTaskLine: 55, sumForContract: 55 });
  });
  it('a role attribute the new role does not have is cleared', () => {
    expect(computeTaskLineRowJSON(d, TIME, { resourceRoleItem: 'role_wood', resourceRoleAttributeSetKey: 'dp1=remote|dp2=3y' }, DAY)).toMatchObject({ resourceRoleAttributeSetKey: null });
    expect(computeTaskLineRowJSON(d, MATERIAL, { taskResourceItem: 'wood_free', taskResourceAttributesKey: 'dp3=oak' }, DAY)).toMatchObject({ taskResourceAttributesKey: null });
    expect(computeTaskLineRowJSON(d, MATERIAL, { taskResourceItem: 'wood_box', taskResourceAttributesKey: 'dp3=birch' }, DAY).taskResourceAttributesKey).toBeUndefined();
  });
  it('taskManagementGenusLine follows the genus of the tab (the contract templates offered depend on it)', () => {
    expect(computeTaskLineRowJSON(d, MATERIAL, {}, DAY)).toMatchObject({ taskManagementGenusLine: 'materialGenus' });
    expect(computeTaskLineRowJSON(d, MATERIAL, { taskManagementGenusLine: 'materialGenus' }, DAY).taskManagementGenusLine).toBeUndefined();
    expect(computeTaskLineRowJSON(d, TIME, { taskManagementGenusLine: 'materialGenus' }, DAY)).toMatchObject({ taskManagementGenusLine: 'timeGenus' });
  });
  it('Time: the variant must be a variant of THE PERSON (another person, free text of the first version = cleared); automatic (empty) stays empty', () => {
    expect(computeTaskLineRowJSON(d, TIME, { taskResourceItem: 'p_emp', taskResourceAttributesKey: 'dp_emp_v1=dv13|dp_emp_v2=dv15' }, DAY).taskResourceAttributesKey).toBeUndefined();
    expect(computeTaskLineRowJSON(d, TIME, { taskResourceItem: 'p_con', taskResourceAttributesKey: 'dp_emp_v1=dv13|dp_emp_v2=dv15' }, DAY)).toMatchObject({ taskResourceAttributesKey: null });
    expect(computeTaskLineRowJSON(d, TIME, { taskResourceItem: 'p_emp', taskResourceAttributesKey: 'remote, 3 years' }, DAY)).toMatchObject({ taskResourceAttributesKey: null });
    expect(computeTaskLineRowJSON(d, TIME, { taskResourceItem: 'p_emp' }, DAY).taskResourceAttributesKey).toBeUndefined();
  });
});

describe('lineContractCurrency / lineProblems', () => {
  const d = catalogs();
  it('currency: the partner contract, else the resource contract, else the project\'s', () => {
    expect(lineContractCurrency(d, { taskLinePartnerContract: 'c_eur', taskResourceContract: 'c_usd' }, 'GBP')).toBe('EUR');
    expect(lineContractCurrency(d, { taskResourceContract: 'c_usd' }, 'GBP')).toBe('USD');
    expect(lineContractCurrency(d, {}, 'GBP')).toBe('GBP');
    expect(lineContractCurrency(d, {}, null)).toBe('');
  });
  it('problems: a role of another genus, a deleted role / product, a price without quantity', () => {
    expect(lineProblems(d, TIME, { resourceRoleItem: 'role_da', qtyTaskLine: 1, priceTaskLine: 2 })).toEqual([]);
    expect(lineProblems(d, TIME, { resourceRoleItem: 'role_wood' })).toEqual(['The role is not a Time role']);
    expect(lineProblems(d, TIME, { resourceRoleItem: 'role_gone' })).toEqual(['The role does not exist any more']);
    expect(lineProblems(d, MATERIAL, { taskResourceItem: 'gone' })).toEqual(['The product does not exist any more']);
    expect(lineProblems(d, TIME, { priceTaskLine: 5 })).toEqual(['Quantity is empty']);
  });
});

describe('the cost of a person: his contract first, else the rate of the role', () => {
  const d = catalogs();
  const withRole = { resourceRoleItem: 'role_da' };
  it('the contract of the person gives the price per hour (employee: Month / 168 h, contractor: Day / 8 h)', () => {
    expect(suggestForLine(d, TIME, { ...withRole, taskResourceItem: 'p_emp', taskResourceContract: 'c_emp' }, DAY)).toEqual({ price: 20, priceSource: 'contract', measureUnit: 'unit_hour', vatPercent: 0 });
    expect(suggestForLine(d, TIME, { ...withRole, taskResourceItem: 'p_con', taskResourceContract: 'c_con' }, DAY)).toMatchObject({ price: 30, priceSource: 'contract' });
  });
  it('no contract on the line = the rate of the resource role', () => {
    expect(suggestForLine(d, TIME, { ...withRole, taskResourceItem: 'p_emp' }, DAY)).toMatchObject({ price: 40, priceSource: 'role' });
  });
  it('a contract with no hourly price (one-time, unknown, other unit) falls back to the role rate', () => {
    expect(suggestForLine(d, TIME, { ...withRole, taskResourceContract: 'c_once' }, DAY)).toMatchObject({ price: 40, priceSource: 'role' });
    expect(suggestForLine(d, TIME, { ...withRole, taskResourceContract: 'gone' }, DAY)).toMatchObject({ price: 40, priceSource: 'role' });
    expect(suggestForLine(d, TIME, { ...withRole, taskResourceContract: 'c_emp', measureUnitTaskLine: 'unit_pcs' }, DAY)).toMatchObject({ priceSource: 'role' });
  });
  it('a contract is enough without a role: the price and the hour', () => {
    expect(suggestForLine(d, TIME, { taskResourceContract: 'c_emp' }, DAY)).toEqual({ price: 20, priceSource: 'contract', measureUnit: 'unit_hour', vatPercent: null });
  });
  it('the price follows the contract until the user types one: choosing / removing the contract re-prices the line', () => {
    const first = computeTaskLineRowJSON(d, TIME, { ...withRole, qtyTaskLine: 10 }, DAY);
    expect(first).toMatchObject({ priceTaskLine: 40, priceSourceTaskLine: 'role', sumForContract: 400 });
    const withContract = { ...withRole, qtyTaskLine: 10, ...first, taskResourceContract: 'c_emp' };
    const second = computeTaskLineRowJSON(d, TIME, withContract, DAY);
    expect(second).toMatchObject({ priceTaskLine: 20, priceAutoTaskLine: 20, priceSourceTaskLine: 'contract', sumForContract: 200 });
    const back = computeTaskLineRowJSON(d, TIME, { ...withContract, ...second, taskResourceContract: null }, DAY);
    expect(back).toMatchObject({ priceTaskLine: 40, priceSourceTaskLine: 'role', sumForContract: 400 });
    // typed by the user: stays
    const typed = computeTaskLineRowJSON(d, TIME, { ...withContract, ...second, priceTaskLine: 33 }, DAY);
    expect(typed).toMatchObject({ priceSourceTaskLine: 'manual', sumForContract: 330 });
  });
});

describe('the contract template of a Material / Expense / Revenue line', () => {
  const d = catalogs();
  it('must exist and belong to the genus of the line', () => {
    expect(lineProblems(d, MATERIAL, { taskManagementGenusLine: 'materialGenus', resourceContractTemplateTaskLine: 'tpl_mat' })).toEqual([]);
    expect(lineProblems(d, MATERIAL, { taskManagementGenusLine: 'materialGenus', resourceContractTemplateTaskLine: 'tpl_time' })).toEqual(['The contract template is not a Material template']);
    expect(lineProblems(d, MATERIAL, { resourceContractTemplateTaskLine: 'tpl_time' })).toEqual(['The contract template is not a Material template']); // genus from the tab
    expect(lineProblems(d, MATERIAL, { resourceContractTemplateTaskLine: 'gone' })).toEqual(['The contract template does not exist any more']);
  });
});
