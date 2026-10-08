// Product catalog - rules of the descriptor model (R6 / R9 / R10 / R13), variant generation, barcodes, labels.
import {
  buildVariantTitle, computedVariant, currentPrice, descriptorKey, isValidGtin, nextEan13, plannedVariants, propertyLinesOfProduct,
  setOfType, variantLinesOfOwner, variantOwnerOfProduct, variantsOfProduct, variantsToRebuild,
} from '../../../kit8/catalog/product/crud/productCatalogTools';
import { buildProductLabels } from '../../../kit8/catalog/product/crud/productLabels';
import { productSystemMetaData } from '../../../kit8/catalog/product/productMetaData';
import { PRODUCT_TABLE_KEYS, PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import { seedCatalog } from './productTestKit';

const data = seedCatalog();
const product = (g: string) => data.product.find((p) => p.rowGUID === g)!;

describe('seed (create_product_tables.sql)', () => {
  it('has the sheet rows and 100 more products', () => {
    expect(data.product).toHaveLength(106);
    expect(product('prod2').rowJSON.title).toBe('iPhone 11');
    expect(data.productType.map((t) => t.rowGUID)).toEqual(expect.arrayContaining(['smartphone1', 'tablet1', 'meal1', 'laptop1', 'shoes1', 'book1']));
    // every table fits one PostgREST page (readData reads 1000 rows)
    for (const k of PRODUCT_TABLE_KEYS) expect(data[k].length).toBeLessThan(1000);
  });
  it('one SystemMetaData entity per table', () => {
    const md = productSystemMetaData();
    expect(Object.keys(md)).toHaveLength(17);
    expect(md.productReusable.tableName).toBe('productTable');
    expect(md[PRODUCT_TABLES.variant.entity].defaultData).toEqual({ title: null, descriptorKey: null, isActive: true });
  });
});

describe('R6: variants of a product', () => {
  it('perType: the type owns them', () => {
    expect(variantOwnerOfProduct(data, product('prod2'))).toBe('smartphone1');
    expect(variantsOfProduct(data, product('prod2')).map((v) => v.rowGUID)).toEqual(expect.arrayContaining(['pv1', 'pv2', 'pv3']));
  });
  it('sharedWithType: tablets use the smartphone variants', () => {
    expect(variantOwnerOfProduct(data, product('prod3'))).toBe('smartphone1');
    expect(variantsOfProduct(data, product('prod3')).length).toBe(variantsOfProduct(data, product('prod1')).length);
  });
  it('perProduct: only its own', () => {
    expect(variantsOfProduct(data, product('prod5')).map((v) => v.rowGUID)).toEqual(['pv4', 'pv5']);
    expect(variantsOfProduct(data, product('prod6')).map((v) => v.rowGUID)).toEqual(['pv6']);
  });
  it('none: no variants', () => {
    const book = data.product.find((p) => p.rowOwnerGUID === 'book1')!;
    expect(variantOwnerOfProduct(data, book)).toBeNull();
    expect(variantsOfProduct(data, book)).toEqual([]);
  });
});

describe('descriptor sets', () => {
  it('property / variant lines of a type, in sort order', () => {
    expect(setOfType(data, 'smartphone1', 'variant')).toBe('ds_sp_var');
    expect(variantLinesOfOwner(data, 'smartphone1').map((l) => l.rowParentGUID)).toEqual(['color', 'deviceMemory']);
    // a tablet's variants are described by the smartphone variant set
    expect(variantLinesOfOwner(data, 'prod3').map((l) => l.rowGUID)).toEqual(['dp1', 'dp2']);
    expect(propertyLinesOfProduct(data, product('prod1'))[0].rowGUID).toBe('dp3');
  });
});

describe('R9 / R10: key + title', () => {
  it('descriptorKey = sorted pairs', () => {
    expect(descriptorKey([{ planGUID: 'dp2', valueGUID: 'dv3' }, { planGUID: 'dp1', valueGUID: 'dv1' }])).toBe('dp1=dv1|dp2=dv3');
    expect(descriptorKey([{ planGUID: 'dp1', valueGUID: '' }])).toBe('');
  });
  it('title from the template; a missing value drops its separator', () => {
    expect(buildVariantTitle('{color} / {deviceMemory}', { color: 'Red', deviceMemory: '256 GB' })).toBe('Red / 256 GB');
    expect(buildVariantTitle('{portionSize}, {sauceKind}', { portionSize: 'Double' })).toBe('Double');
    expect(buildVariantTitle('{portionSize}, {sauceKind}', { sauceKind: 'Oil' })).toBe('Oil');
    expect(buildVariantTitle('Size {s} ({c})', { s: 'M', c: 'Red' })).toBe('Size M (Red)');
    expect(buildVariantTitle(null, { a: 'X', b: 'Y' }, ['b', 'a'])).toBe('Y / X');
  });
  it('the seed variants agree with their values', () => {
    expect(computedVariant(data, data.variant.find((v) => v.rowGUID === 'pv1')!)).toEqual({ title: 'Red / 256 GB', descriptorKey: 'dp1=dv1|dp2=dv3' });
    expect(variantsToRebuild(data)).toEqual([]);
  });
  it('a changed value makes the variant "to rebuild"', () => {
    const d = seedCatalog();
    d.variantValue.find((x) => x.rowGUID === 'pvd1')!.rowJSON.descriptorValueGUID = 'dv2';
    const r = variantsToRebuild(d);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ title: 'Midnight black / 256 GB', descriptorKey: 'dp1=dv2|dp2=dv3' });
  });
});

describe('generate variants', () => {
  it('every combination of the required descriptors minus the existing ones', () => {
    const existing = data.variant.filter((v) => v.rowOwnerGUID === 'smartphone1').length;
    const colors = data.descriptorValue.filter((v) => v.rowOwnerGUID === 'color').length;
    const memory = data.descriptorValue.filter((v) => v.rowOwnerGUID === 'deviceMemory').length;
    const planned = plannedVariants(data, 'smartphone1');
    expect(planned).toHaveLength(colors * memory - existing);
    expect(new Set(planned.map((p) => p.descriptorKey)).size).toBe(planned.length);
    expect(planned.every((p) => p.values.length === 2)).toBe(true);
  });
  it('only the chosen values; optional descriptors stay empty', () => {
    const planned = plannedVariants(data, 'prod5', { only: { portionSize: ['dv5'] } });
    // meal: portionSize is required, sauce optional -> one variant "Normal" (prod5 has "Normal, Cream sauce", not "Normal")
    expect(planned.map((p) => p.title)).toEqual(['Normal']);
    expect(planned[0].descriptorKey).toBe('dp5=dv5');
  });
  it('no variant set -> nothing', () => {
    expect(plannedVariants(data, 'book1')).toEqual([]);
  });
});

describe('R13: the valid price', () => {
  const prices = [
    { rowGUID: 'a', rowOwnerGUID: 'p', rowParentGUID: 'empty', orderInList: 1, rowJSON: { priceTypeGUID: 'r', price: 10, validFrom: '2026-01-01' } },
    { rowGUID: 'b', rowOwnerGUID: 'p', rowParentGUID: 'empty', orderInList: 2, rowJSON: { priceTypeGUID: 'r', price: 12, validFrom: '2026-06-01' } },
    { rowGUID: 'c', rowOwnerGUID: 'p', rowParentGUID: 'v1', orderInList: 3, rowJSON: { priceTypeGUID: 'r', price: 15, validFrom: '2026-03-01' } },
    { rowGUID: 'd', rowOwnerGUID: 'p', rowParentGUID: 'empty', orderInList: 4, rowJSON: { priceTypeGUID: 'r', price: 99, validFrom: '2027-01-01' } },
  ];
  it('latest validFrom <= day', () => {
    expect(currentPrice(prices, 'p', null, 'r', '2026-05-31')?.rowGUID).toBe('a');
    expect(currentPrice(prices, 'p', null, 'r', '2026-10-08')?.rowGUID).toBe('b');
    expect(currentPrice(prices, 'p', null, 'r', '2025-12-31')).toBeNull();
  });
  it('a variant row beats the all-variants row; other variants fall back', () => {
    expect(currentPrice(prices, 'p', 'v1', 'r', '2026-10-08')?.rowGUID).toBe('c');
    expect(currentPrice(prices, 'p', 'v2', 'r', '2026-10-08')?.rowGUID).toBe('b');
  });
  it('seed: older + newer retail price of a product', () => {
    const p = data.product.find((x) => x.rowGUID === 'prod7')!;
    expect(currentPrice(data.productPrice, p.rowGUID, null, 'pt_retail', '2026-08-01')).not.toBeNull();
    expect(currentPrice(data.productPrice, p.rowGUID, null, 'pt_retail', '2026-10-08')!.rowJSON.validFrom).toBe('2026-10-01');
  });
});

describe('barcodes', () => {
  it('GTIN check digit', () => {
    expect(isValidGtin('4006381333931')).toBe(true);
    expect(isValidGtin('4006381333932')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);
    expect(isValidGtin('abc')).toBe(false);
    // every generated seed barcode is valid
    expect(data.productBarcode.filter((b) => b.rowGUID !== 'bc1' && b.rowGUID !== 'bc2').every((b) => isValidGtin(b.rowJSON.barcode))).toBe(true);
  });
  it('next free EAN-13 after the existing ones', () => {
    const codes = data.productBarcode.map((b) => b.rowJSON.barcode);
    const next = nextEan13(codes);
    expect(isValidGtin(next)).toBe(true);
    expect(codes).not.toContain(next);
    expect(next.startsWith('4750001')).toBe(true);
    expect(nextEan13([])).toBe('4750001000016');
  });
});

describe('labels + pick lists', () => {
  const L = buildProductLabels(data);
  it('folder path, owner, variant, plan line, value text', () => {
    expect(L.folderPath('fld_mobile')).toBe('Electronics › Mobile devices');
    expect(L.ownerLabel('smartphone1')).toBe('Type · Smartphone');
    expect(L.ownerLabel('prod5')).toBe('Product · Chicken nuggets');
    expect(L.variantLabel('pv1')).toBe('Smartphone · Red / 256 GB');
    expect(L.planLabel('dp1')).toBe('Smartphone – variants · Color');
    expect(L.valueText(data.propertyValue.find((x) => x.rowGUID === 'pp2')!)).toBe('Apple');
    expect(L.valueText(data.propertyValue.find((x) => x.rowGUID === 'pp5')!)).toBe('290');
  });
  it('variant owners = perType types + perProduct products', () => {
    const owners = L.options.variantOwners.map((o) => o.value);
    expect(owners).toContain('smartphone1');
    expect(owners).toContain('prod5');
    expect(owners).not.toContain('tablet1');
    expect(owners).not.toContain('prod1');
    expect(L.options.valuesOf('color')[0]).toMatchObject({ value: 'dv1', label: 'Red', color: '#D32F2F' });
  });
});
