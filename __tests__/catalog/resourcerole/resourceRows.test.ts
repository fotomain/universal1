// The demo rows of insert_rows_resource_table.sql: Human / Material / Expense Resources with their management genus - on top of the
// sheet's roles. Checked as the dashboard sees them: counts, genus, units and rates, no issues in the Checks, the SQL against the fixture.
import * as fs from 'fs';
import * as path from 'path';
import rowsSeed from './resourceRowsSeed.json';
import { genusRows, seedProductSide, seedRoleCatalog } from './resourceRoleTestKit';
import { plannedVariants } from '../../../kit8/catalog/product/crud/productCatalogTools';
import { validateProductCatalog } from '../../../kit8/catalog/product/crud/productValidation';
import { currentRate, roleAsProductData, variantsOfRole, vatPercentOfRole, vatRateOfRole } from '../../../kit8/catalog/resourcerole/crud/resourceRoleCatalogTools';
import { buildResourceRoleLabels } from '../../../kit8/catalog/resourcerole/crud/resourceRoleLabels';
import { validateResourceRoleCatalog } from '../../../kit8/catalog/resourcerole/crud/resourceRoleValidation';

const d = seedRoleCatalog({ withResources: true });
const byId = (rows: { rowGUID: string }[], id: string) => rows.find((r) => r.rowGUID === id) as any;
const rolesOf = (type: string) => d.resourceRole.filter((r) => r.rowOwnerGUID === type);
const titles = (type: string) => rolesOf(type).map((r) => r.rowJSON.title);
const sql = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/insert_rows_resource_table.sql'), 'utf8');

describe('what the insert adds', () => {
  it('four role types, each with its management genus', () => {
    expect(d.resourceRoleType).toHaveLength(5 + 4);
    expect(byId(d.resourceRoleType, 'revenueResources').rowJSON).toMatchObject({ title: 'Revenue Resources', managementGenus: 'revenueGenus', variantMode: 'none' });
    expect(byId(d.resourceRoleType, 'humanResources').rowJSON).toMatchObject({ title: 'Human Resources', managementGenus: 'timeGenus', baseUnit: 'unit_hour', variantMode: 'perType' });
    expect(byId(d.resourceRoleType, 'materialResources').rowJSON).toMatchObject({ title: 'Material Resources', managementGenus: 'materialGenus', variantMode: 'none' });
    expect(byId(d.resourceRoleType, 'expenseResources').rowJSON).toMatchObject({ title: 'Expense Resources', managementGenus: 'expenseGenus', variantMode: 'none' });
    for (const t of ['humanResources', 'materialResources', 'expenseResources', 'revenueResources']) {
      expect(genusRows().some((g) => g.rowGUID === byId(d.resourceRoleType, t).rowJSON.managementGenus)).toBe(true);
    }
  });

  it('Human Resources: the five roles', () => {
    expect(titles('humanResources')).toEqual(['Project Manager', 'Business Analyst', 'Data Analyst', 'Frontend Developer', 'Backend Developer']);
  });

  it('Material Resources: 10 realistic materials, the wood plates first', () => {
    const t = titles('materialResources');
    expect(t).toHaveLength(10);
    expect(t.slice(0, 2)).toEqual(['Wood plate 20x20', 'Birch plate 20x20']);
    expect(new Set(t).size).toBe(10);
    expect(rolesOf('materialResources').every((r) => String(r.rowJSON.description).length > 30)).toBe(true);
  });

  it('Expense Resources: 10 rows in the domains Logistic, Transport, Advertisement, Service', () => {
    const folderTitle = (g: string) => byId(d.resourceRoleFolder, g).rowJSON.title;
    const perDomain: Record<string, number> = {};
    for (const r of rolesOf('expenseResources')) perDomain[folderTitle(r.rowParentGUID)] = (perDomain[folderTitle(r.rowParentGUID)] ?? 0) + 1;
    expect(rolesOf('expenseResources')).toHaveLength(10);
    expect(perDomain).toEqual({ Logistic: 3, Transport: 3, Advertisement: 2, Service: 2 });
    // the domains are sub-folders of "Expenses"
    expect(byId(d.resourceRoleFolder, 'fld_res_exp_transport').rowParentGUID).toBe('fld_res_exp');
  });
});

describe('VAT 21 %', () => {
  it('every Material role has VAT 21 % on the role itself', () => {
    expect(rolesOf('materialResources').map((r) => r.rowJSON.roleVATRate)).toEqual(Array(10).fill('vat_21'));
    for (const r of rolesOf('materialResources')) expect(vatRateOfRole(d, r)!.rowJSON.vatTablePercent).toBe(21);
  });
  it('the Revenues branch: Revenue Resources with Stage #1 Revenue and Stage #2 Revenue, VAT 21 %, in the folder Revenues', () => {
    expect(titles('revenueResources')).toEqual(['Stage #1 Revenue', 'Stage #2 Revenue']);
    for (const r of rolesOf('revenueResources')) {
      expect(r.rowParentGUID).toBe('fld_res_rev');
      expect(r.rowJSON.roleVATRate).toBe('vat_21');
      expect(vatRateOfRole(d, r)!.rowJSON.vatTablePercent).toBe(21);
    }
    expect(byId(d.resourceRoleFolder, 'fld_res_rev').rowJSON.title).toBe('Revenues');
  });
  it('an empty VAT is 0 %: no own rate and no default of the role type', () => {
    const e = seedRoleCatalog({ withResources: true });
    byId(e.resourceRoleType, 'expenseResources').rowJSON.roleVATDefaultRate = null;
    const role = byId(e.resourceRole, 'exp_van');
    expect(role.rowJSON.roleVATRate).toBeNull();
    expect(vatRateOfRole(e, role)!.rowGUID).toBe('vat_0');
    expect(vatPercentOfRole(e, role)).toBe(0);
    // an own rate wins, the default of the type is used when the role has none
    expect(vatPercentOfRole(e, byId(e.resourceRole, 'mat_epoxy'))).toBe(21);
    expect(vatPercentOfRole(d, byId(d.resourceRole, 'exp_van'))).toBe(21);
    byId(e.resourceRole, 'exp_van').rowJSON.roleVATRate = 'vat_12';
    expect(vatPercentOfRole(e, byId(e.resourceRole, 'exp_van'))).toBe(12);
    expect(vatPercentOfRole(e, undefined)).toBe(0);
  });
  it('the SQL gives role types with an empty default VAT rate 0 %', () => {
    expect(sql).toMatch(/UPDATE public\."resourceRoleTypeTable"[\s\S]*roleVATDefaultRate[\s\S]*"vat_0"[\s\S]*coalesce\("rowJSON"->>'roleVATDefaultRate', ''\) = ''/);
    expect(sql).toContain("('vat_0', 'valueAddedTaxCatalog'");
  });
  it('every role type has the 21 % default; Human and Expense roles use it', () => {
    for (const t of ['humanResources', 'materialResources', 'expenseResources', 'revenueResources']) expect(byId(d.resourceRoleType, t).rowJSON.roleVATDefaultRate).toBe('vat_21');
    for (const r of [...rolesOf('humanResources'), ...rolesOf('expenseResources')]) expect(vatRateOfRole(d, r)!.rowGUID).toBe('vat_21');
  });
  it('the SQL also sets it on materials inserted by an earlier version of the script', () => {
    expect(sql).toMatch(/UPDATE public\."resourceRoleTable"[\s\S]*"rowOwnerGUID" = 'materialResources'[\s\S]*roleVATRate/);
  });
});

describe('units and rates', () => {
  const rate = (role: string, pt: string, variant: string | null = null) => {
    const r = byId(d.resourceRole, role);
    return currentRate(d.rolePrice, r, byId(d.resourceRoleType, r.rowOwnerGUID), variant, pt, '2026-10-09');
  };

  it('a revenue stage has a Bill rate per stage and no cost', () => {
    expect(rate('rev_stage_1', 'pt_bill')!.rowJSON).toMatchObject({ price: 12000, measureUnit: 'unit_pcs' });
    expect(rate('rev_stage_2', 'pt_bill')!.rowJSON.price).toBe(18000);
    expect(rate('rev_stage_1', 'pt_cost')).toBeNull();
  });

  it('every human, material and expense role has a Bill rate and a Cost rate (the bill is higher), in its own unit', () => {
    for (const r of [...rolesOf('humanResources'), ...rolesOf('materialResources'), ...rolesOf('expenseResources')]) {
      const bill = rate(r.rowGUID, 'pt_bill');
      const cost = rate(r.rowGUID, 'pt_cost');
      expect([r.rowGUID, !!bill, !!cost]).toEqual([r.rowGUID, true, true]);
      expect(bill!.rowJSON.price).toBeGreaterThan(cost!.rowJSON.price);
      expect(bill!.rowJSON.measureUnit).toBe(cost!.rowJSON.measureUnit);
    }
  });

  it('the unit of the price fits the thing: hour, pcs, m, m², l, kg, km, day, month', () => {
    const unit = (role: string) => rate(role, 'pt_bill')!.rowJSON.measureUnit;
    expect(unit('hr_pm')).toBe('unit_hour');
    expect(unit('mat_wood_plate_20')).toBe('unit_pcs');
    expect(unit('mat_copper_cable')).toBe('unit_m');
    expect(unit('mat_alu_sheet')).toBe('unit_m2');
    expect(unit('mat_varnish')).toBe('unit_l');
    expect(unit('mat_epoxy')).toBe('unit_kg');
    expect(unit('exp_van')).toBe('unit_km');
    expect(unit('exp_social')).toBe('unit_day');
    expect(unit('exp_billboard')).toBe('unit_month');
    expect(rate('mat_wood_plate_20', 'pt_bill')!.rowJSON.price).toBe(3.9);
    expect(rate('mat_birch_plate_20', 'pt_cost')!.rowJSON.price).toBe(3.1);
  });

  it('Human Resources has Senior / Middle variants; a Senior, English bill rate beats the default one', () => {
    expect(variantsOfRole(d, byId(d.resourceRole, 'hr_pm')).map((v) => v.rowJSON.title)).toEqual(['Middle, English', 'Senior, English', 'Senior, Latvian']);
    expect(rate('hr_pm', 'pt_bill')!.rowJSON.price).toBe(62);
    expect(rate('hr_pm', 'pt_bill', 'pv_hr_sen_en')!.rowJSON.price).toBe(78);
    // no own Senior, Latvian rate: the default one
    expect(rate('hr_pm', 'pt_bill', 'pv_hr_sen_lv')!.rowJSON.price).toBe(62);
    expect(variantsOfRole(d, byId(d.resourceRole, 'mat_epoxy'))).toEqual([]);
  });

  it('generated variants of Human Resources: 4 levels x 3 languages minus the 3 that exist', () => {
    expect(plannedVariants(roleAsProductData(d), 'humanResources')).toHaveLength(9);
  });
});

describe('Checks and labels', () => {
  it('no issues in the role Checks, none in the product Checks next to the new rows', () => {
    expect(validateResourceRoleCatalog(d)).toEqual([]);
    expect(validateProductCatalog(seedProductSide({ withResources: true })).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('a role type with an unknown management genus is reported', () => {
    const e = seedRoleCatalog({ withResources: true });
    byId(e.resourceRoleType, 'materialResources').rowJSON.managementGenus = 'nopeGenus';
    expect(validateResourceRoleCatalog(e).map((i) => i.message)).toEqual(['Role type "Material Resources": management genus "nopeGenus" is missing']);
  });

  it('the pick list of the genus: the items with their path, not the folders', () => {
    const L = buildResourceRoleLabels(d);
    expect(L.options.managementGenus.find((o) => o.value === 'timeGenus')!.label).toBe('Costs › Time');
    expect(L.options.managementGenus.map((o) => o.value).sort()).toEqual(['expenseGenus', 'inboundPaymentGenus', 'materialGenus', 'outboundPaymentGenus', 'revenueGenus', 'timeGenus']);
  });
});

describe('SQL: insert_rows_resource_table.sql', () => {
  it('inserts exactly the rows of the fixture, idempotently', () => {
    for (const [table, rows] of Object.entries(rowsSeed as Record<string, any[]>)) {
      const block = sql.slice(sql.indexOf(`INSERT INTO public."${table}"`));
      const n = (block.slice(0, block.indexOf('ON CONFLICT')).match(/^  \('/gm) || []).length;
      expect([table, n]).toEqual([table, rows.length]);
    }
    // + the 0 % VAT row
    expect((sql.match(/ON CONFLICT \("rowGUID"\) DO NOTHING/g) || []).length).toBe(Object.keys(rowsSeed).length + 1);
  });

  it('needs the three create scripts and gives the sheet\'s five role types the time genus', () => {
    expect(sql).toContain('create_resource_role_tables.sql first');
    expect(sql).toContain('create_management_genus_table.sql first');
    expect(sql).toMatch(/UPDATE public\."resourceRoleTypeTable"[\s\S]*projectManager', 'businessAnalyst', 'dataAnalyst', 'frontendDeveloper', 'backendDeveloper'[\s\S]*managementGenus/);
  });
});
