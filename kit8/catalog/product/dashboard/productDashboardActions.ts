// Product dashboard - commands that change several rows (dispatched to the reusable sagas of the product entities):
// create planned variants (+ their values), rebuild variant titles / keys, delete rows, give a barcode the next EAN-13.
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { PRODUCT_TABLES, ProductTableKey } from '../productModel';
import type { DefRow } from '../productModel';
import { nextEan13, PlannedVariant, ProductCatalogData, variantsToRebuild } from '../crud/productCatalogTools';

type Dispatch = (a: any) => any;
const actionsOf = (key: ProductTableKey) => SystemMetaData[PRODUCT_TABLES[key].entity]?.actions;

/** the next orderInList after the rows of a table */
const nextOrder = (rows: DefRow<any>[]) => rows.reduce((m, r) => Math.max(m, Number(r.orderInList) || 0), 0) + 1000;

/** creates the variants (owner = type or product) and one variantValue row per descriptor value; returns the count */
export function createPlannedVariants(dispatch: Dispatch, data: ProductCatalogData, ownerGUID: string, planned: PlannedVariant[], uuid: () => string = Crypto.randomUUID): number {
  const va = actionsOf('variant');
  const vva = actionsOf('variantValue');
  if (!va?.createOne || !vva?.createOne) return 0;
  let order = nextOrder(data.variant);
  let vvOrder = nextOrder(data.variantValue);
  for (const p of planned) {
    const rowGUID = uuid();
    dispatch(va.createOne({ rowGUID, rowOwnerGUID: ownerGUID, rowParentGUID: 'empty', orderInList: order, rowJSON: { title: p.title, descriptorKey: p.descriptorKey, isActive: true } }));
    order += 1000;
    for (const v of p.values) {
      dispatch(vva.createOne({ rowGUID: uuid(), rowOwnerGUID: rowGUID, rowParentGUID: v.planGUID, orderInList: vvOrder, rowJSON: { descriptorValueGUID: v.valueGUID } }));
      vvOrder += 1000;
    }
  }
  return planned.length;
}

/** variant title + descriptorKey from its values (rules R9 / R10); only = these variants; returns the count */
export function rebuildVariants(dispatch: Dispatch, data: ProductCatalogData, only?: string[]): number {
  const va = actionsOf('variant');
  if (!va?.updateOne) return 0;
  const list = variantsToRebuild(data).filter((x) => !only || only.includes(x.variant.rowGUID));
  for (const x of list) dispatch(va.updateOne({ rowGUID: x.variant.rowGUID, rowOwnerGUID: x.variant.rowOwnerGUID, rowJSON: { title: x.title, descriptorKey: x.descriptorKey } }));
  return list.length;
}

export function deleteRows(dispatch: Dispatch, key: ProductTableKey, rows: { rowGUID: string; rowOwnerGUID?: string }[]): number {
  const a = actionsOf(key);
  if (!a?.deleteOne) return 0;
  rows.forEach((r) => dispatch(a.deleteOne({ rowGUID: r.rowGUID, ...(r.rowOwnerGUID ? { rowOwnerGUID: r.rowOwnerGUID } : {}) })));
  return rows.length;
}

/** the next free EAN-13 (prefix of the existing codes) into the barcode row */
export function assignNextBarcode(dispatch: Dispatch, data: ProductCatalogData, row: { rowGUID: string; rowOwnerGUID?: string }): string | null {
  const a = actionsOf('productBarcode');
  if (!a?.updateOne) return null;
  const code = nextEan13(data.productBarcode.map((b) => String(b.rowJSON?.barcode ?? '')));
  dispatch(a.updateOne({ rowGUID: row.rowGUID, rowOwnerGUID: row.rowOwnerGUID, rowJSON: { barcode: code } }));
  return code;
}
