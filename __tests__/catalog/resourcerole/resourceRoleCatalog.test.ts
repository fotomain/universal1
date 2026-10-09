// Resource role catalog - the pure parts on the SQL seed: the two sides of the shared tables, the rules (variants of a role,
// generated variants, valid rate), the labels and the Checks (rules R1-R14), and the SQL file against the model.
import * as fs from 'fs';
import * as path from 'path';
import { rawProductTables, rawRoleTables, seedProductSide, seedRoleCatalog } from './resourceRoleTestKit';
import roleSeed from './resourceRoleSeed.json';
import { sideOf, SIDE_OWNED_KEYS } from '../../../kit8/catalog/product/crud/catalogSides';
import { plannedVariants, variantsToRebuild } from '../../../kit8/catalog/product/crud/productCatalogTools';
import { validateProductCatalog } from '../../../kit8/catalog/product/crud/productValidation';
import { RESOURCE_ROLE_OWN_KEYS, RESOURCE_ROLE_OWN_TABLES, RESOURCE_ROLE_TABLE_KEYS, RESOURCE_ROLE_TABLES } from '../../../kit8/catalog/resourcerole/resourceRoleModel';
import { resourceRoleSystemMetaData } from '../../../kit8/catalog/resourcerole/resourceRoleMetaData';
import {
  currentRate, priceTypeForRoles, ResourceRoleCatalogData, roleAsProductData, roleKeyOfSlot, variantAllowedForRole, variantOwnerOfRole, variantsOfRole, vatRateOfRole,
} from '../../../kit8/catalog/resourcerole/crud/resourceRoleCatalogTools';
import { buildResourceRoleLabels } from '../../../kit8/catalog/resourcerole/crud/resourceRoleLabels';
import { validateResourceRoleCatalog } from '../../../kit8/catalog/resourcerole/crud/resourceRoleValidation';

const byId = (rows: { rowGUID: string }[], id: string) => rows.find((r) => r.rowGUID === id) as any;
const issuesOf = (d: ResourceRoleCatalogData) => validateResourceRoleCatalog(d);
const messages = (d: ResourceRoleCatalogData, rule: string) => issuesOf(d).filter((i) => i.rule === rule).map((i) => i.message);

describe('the two sides of the shared tables', () => {
  it('the role side holds the role rows only, the product side keeps its own counts', () => {
    const role = seedRoleCatalog();
    expect(role.resourceRoleType).toHaveLength(5);
    expect(role.resourceRole).toHaveLength(8);
    expect(role.rolePrice).toHaveLength(32);
    expect(role.descriptorDestination).toHaveLength(10);
    expect(role.descriptorPlan).toHaveLength(18);
    expect(role.propertyValue).toHaveLength(11);
    expect(role.variant).toHaveLength(9);
    expect(role.variantValue).toHaveLength(18);
    const product = seedProductSide();
    expect(product.descriptorDestination).toHaveLength(19);
    expect(product.descriptorPlan).toHaveLength(44);
    expect(product.propertyValue).toHaveLength(272);
    expect(product.variant).toHaveLength(185);
    expect(product.variantValue).toHaveLength(360);
  });

  it('descriptors, values, price lists and units are shared by both sides', () => {
    const role = seedRoleCatalog();
    const product = seedProductSide();
    expect(role.descriptorGenus).toHaveLength(23 + 4);
    expect(product.descriptorGenus).toHaveLength(23 + 4);
    expect(role.priceType.map((p) => p.rowGUID).sort()).toEqual(['pt_bill', 'pt_cost', 'pt_customerA', 'pt_purchase', 'pt_retail', 'pt_wholesale']);
    expect(role.measureUnit.some((u) => u.rowGUID === 'unit_hour')).toBe(true);
  });

  it('no row is on both sides; every other shared row is on exactly one', () => {
    const raw = rawRoleTables();
    // hiding the rows of a side that owns nothing hides nothing
    for (const k of SIDE_OWNED_KEYS) expect(sideOf(raw).data[k]).toHaveLength(raw[k].length);
    const role = seedRoleCatalog();
    const product = seedProductSide();
    for (const k of SIDE_OWNED_KEYS) {
      const both = role[k].filter((r) => product[k].some((p) => p.rowGUID === r.rowGUID));
      expect(both).toEqual([]);
      expect(role[k].length + product[k].length).toBe(raw[k].length);
    }
  });

  it('a row without an owner yet (just added) stays on both sides', () => {
    const raw = rawRoleTables();
    raw.variant.push({ rowGUID: 'new', rowOwnerGUID: 'empty', rowParentGUID: 'empty', orderInList: 0, rowJSON: {} });
    const side = sideOf(raw, rawProductTables().productType, rawProductTables().product).data;
    expect(side.variant.some((v) => v.rowGUID === 'new')).toBe(true);
    expect(sideOf(raw, raw.resourceRoleType, raw.resourceRole).data.variant.some((v) => v.rowGUID === 'new')).toBe(true);
  });
});

describe('model', () => {
  it('four own tables; the shared ones are the product tables', () => {
    expect(RESOURCE_ROLE_OWN_KEYS).toEqual(['resourceRoleType', 'resourceRoleFolder', 'resourceRole', 'rolePrice']);
    expect(RESOURCE_ROLE_TABLE_KEYS).toHaveLength(15);
    expect(RESOURCE_ROLE_TABLES.variant.entity).toBe('variantReusable');
    expect(RESOURCE_ROLE_TABLES.rolePrice.table).toBe('rolePriceTable');
    expect(roleKeyOfSlot('productType')).toBe('resourceRoleType');
    expect(roleKeyOfSlot('descriptorPlan')).toBe('descriptorPlan');
  });

  it('the price table is the same as the product price table', () => {
    expect(Object.keys(RESOURCE_ROLE_OWN_TABLES.rolePrice.emptyRowJSON()).sort()).toEqual(['measureUnit', 'price', 'priceTypeGUID', 'validFrom']);
    expect(RESOURCE_ROLE_OWN_TABLES.rolePrice.emptyRowJSON().measureUnit).toBe('unit_hour');
  });

  it('SystemMetaData entries for the four tables', () => {
    const md = resourceRoleSystemMetaData();
    expect(Object.keys(md).sort()).toEqual(['resourceRoleFolderReusable', 'resourceRoleReusable', 'resourceRoleTypeReusable', 'rolePriceReusable']);
    expect(md.rolePriceReusable).toMatchObject({ tableName: 'rolePriceTable', itemLabel: 'Cost' });
  });
});

describe('rules (the product rules on the role data)', () => {
  const d = seedRoleCatalog();
  const role = (g: string) => byId(d.resourceRole, g);

  it('variants of a role: perType -> the variants of its role type', () => {
    expect(variantOwnerOfRole(d, role('role3'))).toBe('dataAnalyst');
    expect(variantsOfRole(d, role('role3')).map((v) => v.rowGUID)).toEqual(['pv10', 'pv11']);
    expect(variantsOfRole(d, role('role4')).map((v) => v.rowGUID)).toEqual(['pv10', 'pv11']);
    expect(variantsOfRole(d, role('role1')).map((v) => v.rowGUID)).toEqual(['pv7', 'pv8']);
    expect(variantAllowedForRole(d, role('role1'), 'pv7')).toBe(true);
    expect(variantAllowedForRole(d, role('role1'), 'pv10')).toBe(false);
    expect(variantAllowedForRole(d, role('role1'), 'empty')).toBe(true);
  });

  it('valid rate: the latest validFrom <= day; a variant row beats the "all variants" row; per price list', () => {
    const t = (g: string) => byId(d.resourceRoleType, g);
    const rate = (r: string, v: string | null, pt: string, day = '2026-10-09') => currentRate(d.rolePrice, role(r), t(role(r).rowOwnerGUID), v, pt, day)?.rowJSON.price;
    expect(rate('role3', null, 'pt_bill')).toBe(45);
    expect(rate('role3', 'pv11', 'pt_bill')).toBe(60);
    expect(rate('role3', 'pv10', 'pt_bill')).toBe(30);
    expect(rate('role3', null, 'pt_cost')).toBe(27);
    expect(rate('role3', null, 'pt_customerA')).toBe(42);
    // a variant without its own cost rate uses the "all variants" row
    expect(rate('role1', 'pv7', 'pt_cost')).toBe(36);
    // before the first validFrom: no rate
    expect(rate('role3', null, 'pt_bill', '2026-09-30')).toBeUndefined();
  });

  it('rate history: a newer row wins from its day on', () => {
    const rates = [...d.rolePrice, { rowGUID: 'rpN', rowOwnerGUID: 'role3', rowParentGUID: 'empty', orderInList: 0, rowJSON: { priceTypeGUID: 'pt_bill', price: 50, measureUnit: 'unit_hour', validFrom: '2026-11-01' } }];
    const at = (day: string) => currentRate(rates, role('role3'), byId(d.resourceRoleType, 'dataAnalyst'), null, 'pt_bill', day)?.rowJSON.price;
    expect(at('2026-10-31')).toBe(45);
    expect(at('2026-11-01')).toBe(50);
  });

  it('price lists for roles: appliesTo resourceRoleType', () => {
    expect(d.priceType.filter((p) => priceTypeForRoles(p)).map((p) => p.rowGUID).sort()).toEqual(['pt_bill', 'pt_cost', 'pt_customerA']);
  });

  it('VAT: the role type default, a role can have its own', () => {
    expect(vatRateOfRole(d, role('role3'))?.rowGUID).toBe('vat_21');
    const own = { ...role('role3'), rowJSON: { ...role('role3').rowJSON, roleVATRate: 'vat_12' } };
    expect(vatRateOfRole(d, own)?.rowGUID).toBe('vat_12');
  });

  it('generated variants: seniority x language of the role type minus the existing ones, titles by the type template', () => {
    const planned = plannedVariants(roleAsProductData(d), 'projectManager');
    expect(planned).toHaveLength(4 * 3 - 2);
    expect(planned.map((p) => p.title)).toContain('Junior, English');
    expect(planned.map((p) => p.title)).not.toContain('Senior, English');
    expect(planned.find((p) => p.title === 'Lead, Russian')!.descriptorKey).toBe('dp10=dv14|dp11=dv17');
  });

  it('the seed variants have the title and key their values give', () => {
    expect(variantsToRebuild(roleAsProductData(d))).toEqual([]);
  });
});

describe('labels', () => {
  const d = seedRoleCatalog();
  const L = buildResourceRoleLabels(d);

  it('role wording, role pick lists', () => {
    expect(L.ownerLabel('dataAnalyst')).toBe('Role type · Data analyst');
    expect(L.ownerLabel('role4')).toBe('Role · SQL data analyst');
    expect(L.roleTitle('resourceRoleType', 'dataAnalyst')).toBe('Data analyst');
    expect(L.roleTitle('resourceRole', 'role5')).toBe('React Native developer');
    expect(L.folderPath('fld_role_fe')).toBe('Engineering › Frontend');
    expect(L.variantLabel('pv11')).toBe('Data analyst · Senior, English');
    expect(L.options.variantOwners.map((o) => o.label)).toEqual(expect.arrayContaining(['Role type · Data analyst']));
    expect(L.options.variantOwners.every((o) => o.label.startsWith('Role type · '))).toBe(true);
    expect(L.options.roles.map((o) => o.value)).toHaveLength(8);
  });

  it('rate price lists and descriptors are those meant for roles', () => {
    expect(L.options.rateTypes.map((o) => o.value).sort()).toEqual(['pt_bill', 'pt_cost', 'pt_customerA']);
    expect(L.options.roleGenus.map((o) => o.value).sort()).toEqual(['certification', 'minExperienceYears', 'seniority', 'workLanguage']);
    expect(L.valueText(byId(d.propertyValue, 'pp7'))).toBe('5');
    expect(L.valueText(byId(d.propertyValue, 'pp8'))).toBe('PMP');
  });
});

describe('Checks (R1-R14)', () => {
  it('the seed of the sheet has no issues; the product side stays clean next to it', () => {
    expect(issuesOf(seedRoleCatalog())).toEqual([]);
    expect(validateProductCatalog(seedProductSide()).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('R13: a rate in a product-only price list', () => {
    const d = seedRoleCatalog();
    byId(d.rolePrice, 'rp1').rowJSON.priceTypeGUID = 'pt_retail';
    expect(messages(d, 'R13')).toEqual(['Price of "IT project manager": "Retail" is not a role price list']);
    expect(issuesOf(d).find((i) => i.rule === 'R13')!.table).toBe('rolePrice');
  });

  it('R7: a rate for a variant of another role type', () => {
    const d = seedRoleCatalog();
    byId(d.rolePrice, 'rp3').rowParentGUID = 'pv10';
    expect(messages(d, 'R7')).toEqual(['Price of "IT project manager": "Junior, English" is not one of its variants']);
  });

  it('R4: a property of another role type; R1: a rate without unit / with a missing unit', () => {
    const d = seedRoleCatalog();
    byId(d.propertyValue, 'pp7').rowParentGUID = 'dp12';
    expect(messages(d, 'R4')[0]).toContain('is not in its type\'s property set');
    const e = seedRoleCatalog();
    byId(e.rolePrice, 'rp1').rowJSON.measureUnit = null;
    byId(e.rolePrice, 'rp2').rowJSON.measureUnit = 'unit_nope';
    expect(messages(e, 'R1')).toEqual(['Price of "IT project manager": choose the unit the price is for', 'Price of "IT project manager": unit "unit_nope" is missing']);
  });

  it('R1: a role needs a role type; a missing VAT rate / base unit is reported with role words', () => {
    const d = seedRoleCatalog();
    byId(d.resourceRole, 'role1').rowOwnerGUID = 'nope';
    byId(d.resourceRole, 'role2').rowJSON.roleVATRate = 'vat_99';
    byId(d.resourceRoleType, 'dataAnalyst').rowJSON.baseUnit = 'unit_nope';
    byId(d.resourceRoleType, 'backendDeveloper').rowJSON.baseUnit = null;
    const m = issuesOf(d);
    const text = (rule: string, sev?: string) => m.filter((i) => i.rule === rule && (!sev || i.severity === sev)).map((i) => i.message);
    expect(text('R1')).toEqual(expect.arrayContaining([
      'Role "IT project manager": choose its role type',
      'Role "ERP business analyst": VAT rate "vat_99" is missing',
      'Role type "Data analyst": base unit "unit_nope" is missing',
      'Role type "Backend developer": choose the base unit of its cost (hour)',
    ]));
    // roles have no unit for inventory / SKU
    expect(m.some((i) => /unit for inventory|SKU/.test(i.message))).toBe(false);
  });

  it('R11: a product-only descriptor in a role set; R6: perType needs a variant set', () => {
    const d = seedRoleCatalog();
    byId(d.descriptorPlan, 'dp10').rowParentGUID = 'color';
    expect(messages(d, 'R11')).toEqual(['"Color" is not meant for role types - set "Project manager – variants"']);
    const e = seedRoleCatalog();
    e.descriptorDestination = e.descriptorDestination.filter((x) => x.rowGUID !== 'ds_pm_var');
    e.descriptorPlan = e.descriptorPlan.filter((x) => x.rowOwnerGUID !== 'ds_pm_var');
    byId(e.resourceRoleType, 'projectManager').rowJSON.variantSet = null;
    expect(messages(e, 'R6')).toContain('Role type "Project manager": variant mode "perType" needs a variant set');
  });

  it('R10 / R9: a stale variant title is found and rebuildable', () => {
    const d = seedRoleCatalog();
    byId(d.variant, 'pv7').rowJSON.title = 'Wrong';
    const i = issuesOf(d).find((x) => x.rule === 'R10')!;
    expect(i).toMatchObject({ table: 'variant', rowGUID: 'pv7', fix: 'rebuildVariant' });
    expect(variantsToRebuild(roleAsProductData(d)).map((x) => [x.variant.rowGUID, x.title])).toEqual([['pv7', 'Senior, English']]);
  });

  it('R14: a rate in the role itself belongs in the Cost table', () => {
    const d = seedRoleCatalog();
    byId(d.resourceRole, 'role3').rowJSON.ratePerHour = 45;
    expect(messages(d, 'R14')).toEqual(['Role "BI data analyst (Power BI)": "ratePerHour" belongs in the Cost table (rolePriceTable), not in the role']);
  });

  it('R8: a required property without value; folders: a missing parent', () => {
    const d = seedRoleCatalog();
    d.propertyValue = d.propertyValue.filter((p) => p.rowGUID !== 'pp7');
    byId(d.resourceRoleFolder, 'fld_role_fe').rowParentGUID = 'nope';
    expect(messages(d, 'R8')).toEqual(['Role "IT project manager": required property "Min. experience, years" has no value']);
    expect(messages(d, 'R1')).toEqual(['Folder "Frontend": its parent folder is missing']);
  });

  it('orphans: a rate of a deleted role can be deleted in one click', () => {
    const d = seedRoleCatalog();
    d.resourceRole = d.resourceRole.filter((r) => r.rowGUID !== 'role8');
    const orphans = issuesOf(d).filter((i) => i.fix === 'deleteRow');
    expect(orphans.map((i) => i.table).sort()).toEqual(['propertyValue'].concat(Array(4).fill('rolePrice')).sort());
  });
});

describe('SQL: create_resource_role_tables.sql', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/create_resource_role_tables.sql'), 'utf8');
  const del = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/delete_resource_role_tables.sql'), 'utf8');

  it('creates the four role tables, secured and in realtime', () => {
    for (const k of RESOURCE_ROLE_OWN_KEYS) {
      const t = RESOURCE_ROLE_OWN_TABLES[k].table;
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public."${t}"`);
      expect(sql).toContain(`SELECT public.kit8_setup_def_table('${t}')`);
      expect(del).toContain(`'${t}'`);
    }
    expect(sql.match(/FOREACH t IN ARRAY ARRAY\['resourceRoleTypeTable', 'resourceRoleFolderTable', 'resourceRoleTable', 'rolePriceTable'\]/g)).toHaveLength(2);
    expect(sql).toContain('create_product_tables.sql first');
  });

  it('inserts exactly the rows of the seed fixture', () => {
    for (const [table, rows] of Object.entries(roleSeed as Record<string, any[]>)) {
      const block = sql.slice(sql.indexOf(`INSERT INTO public."${table}"`));
      const end = block.indexOf('ON CONFLICT');
      const n = (block.slice(0, end).match(/^  \('/gm) || []).length;
      expect([table, n]).toEqual([table, rows.length]);
    }
  });

  it('a rate has the product price fields (measureUnit, not unit)', () => {
    expect(sql).toContain('"measureUnit": "unit_hour"');
    expect(sql).not.toMatch(/"unit": "unit_hour"/);
  });
});
