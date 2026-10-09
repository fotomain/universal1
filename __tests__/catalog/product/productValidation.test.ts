// Product catalog - the Checks report (rules R1-R13 of the descriptors plan).
import { issuesByTable, validateProductCatalog } from '../../../kit8/catalog/product/crud/productValidation';
import { seedCatalog } from './productTestKit';

const rules = (issues: { rule: string }[]) => issues.map((i) => i.rule);

describe('validateProductCatalog', () => {
  it('the seed has no errors (only the sheet barcode samples may lack a valid check digit)', () => {
    const issues = validateProductCatalog(seedCatalog());
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(issues.filter((i) => i.rule !== 'GTIN')).toEqual([]);
  });

  it('R1: missing owner / type / orphan rows (with a sql_for_delete fix)', () => {
    const d = seedCatalog();
    d.product.find((p) => p.rowGUID === 'prod1')!.rowOwnerGUID = 'nope';
    d.propertyValue.push({ rowGUID: 'orphan', rowOwnerGUID: 'gone', rowParentGUID: 'dp3', orderInList: 1, rowJSON: {} });
    const issues = validateProductCatalog(d);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'R1', table: 'product', rowGUID: 'prod1' }),
      expect.objectContaining({ rule: 'R1', table: 'propertyValue', rowGUID: 'orphan', fix: 'deleteRow' }),
    ]));
  });

  it('R2 / R3 / R11: descriptor not allowed for the mode, used twice per type, not for products', () => {
    const d = seedCatalog();
    // brand is Property only -> into the smartphone VARIANT set; it is also in the property set (R3)
    d.descriptorPlan.push({ rowGUID: 'bad', rowOwnerGUID: 'ds_sp_var', rowParentGUID: 'brand', orderInList: 1, rowJSON: { required: false, sort: 99 } });
    d.descriptorGenus.find((g) => g.rowGUID === 'calories')!.rowJSON.targetKinds = ['resourceRoleType'];
    const r = rules(validateProductCatalog(d));
    expect(r).toEqual(expect.arrayContaining(['R2', 'R3', 'R11']));
  });

  it('R4 / R5: wrong plan line, value of another descriptor, scalar typed wrong', () => {
    const d = seedCatalog();
    d.propertyValue.find((x) => x.rowGUID === 'pp1')!.rowJSON.descriptorValueGUID = 'dv1'; // Red is not a Brand
    d.propertyValue.find((x) => x.rowGUID === 'pp5')!.rowJSON.value = 'lots'; // calories: number
    d.propertyValue.push({ rowGUID: 'x', rowOwnerGUID: 'prod2', rowParentGUID: 'dp7', orderInList: 1, rowJSON: { value: 1 } }); // meal line on a phone
    const issues = validateProductCatalog(d);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'R5', rowGUID: 'pp1' }),
      expect.objectContaining({ rule: 'R5', rowGUID: 'pp5' }),
      expect.objectContaining({ rule: 'R4', rowGUID: 'x' }),
    ]));
  });

  it('R6 / R7: variant owned the wrong way, price / barcode of a foreign variant', () => {
    const d = seedCatalog();
    d.variant.push({ rowGUID: 'v-bad', rowOwnerGUID: 'prod1', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: 'x', descriptorKey: '' } }); // smartphone = perType
    d.productPrice.push({ rowGUID: 'p-bad', rowOwnerGUID: 'prod5', rowParentGUID: 'pv1', orderInList: 1, rowJSON: { priceTypeGUID: 'pt_retail', price: 1, validFrom: '2026-10-01' } });
    d.productBarcode.push({ rowGUID: 'b-bad', rowOwnerGUID: 'prod6', rowParentGUID: 'pv4', orderInList: 1, rowJSON: { barcode: '4006381333931' } });
    const issues = validateProductCatalog(d);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'R6', rowGUID: 'v-bad' }),
      expect.objectContaining({ rule: 'R7', rowGUID: 'p-bad' }),
      expect.objectContaining({ rule: 'R7', rowGUID: 'b-bad' }),
    ]));
  });

  it('R8: a required property without value; two values of one line', () => {
    const d = seedCatalog();
    d.propertyValue = d.propertyValue.filter((x) => x.rowGUID !== 'pp2'); // iPhone 11 brand
    d.propertyValue.push({ rowGUID: 'dup', rowOwnerGUID: 'prod1', rowParentGUID: 'dp3', orderInList: 1, rowJSON: { descriptorValueGUID: 'dv10' } });
    const issues = validateProductCatalog(d);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'R8', table: 'product', rowGUID: 'prod2', severity: 'warning' }),
      expect.objectContaining({ rule: 'R8', rowGUID: 'dup', severity: 'error' }),
    ]));
  });

  it('R9 / R10: stale key / title (fix = rebuild), duplicate combination', () => {
    const d = seedCatalog();
    d.variant.find((v) => v.rowGUID === 'pv2')!.rowJSON.title = 'Black-ish';
    d.variant.find((v) => v.rowGUID === 'pv3')!.rowJSON.descriptorKey = 'dp1=dv1|dp2=dv3';
    const issues = validateProductCatalog(d);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'R10', rowGUID: 'pv2', fix: 'rebuildVariant' }),
      expect.objectContaining({ rule: 'R9', rowGUID: 'pv3', fix: 'rebuildVariant' }),
      expect.objectContaining({ rule: 'R9', rowGUID: 'pv3', severity: 'error' }),
    ]));
  });

  it('R13: price list not for products; types: shared without a source', () => {
    const d = seedCatalog();
    d.priceType.find((p) => p.rowGUID === 'pt_wholesale')!.rowJSON.appliesTo = ['resourceRoleType'];
    d.productType.find((t) => t.rowGUID === 'tablet1')!.rowJSON.variantSharedTypeGUID = null;
    const byTable = issuesByTable(validateProductCatalog(d));
    expect(rules(byTable.productPrice || [])).toContain('R13');
    expect(byTable.productType?.[0]).toMatchObject({ rule: 'R6', rowGUID: 'tablet1' });
  });
});
