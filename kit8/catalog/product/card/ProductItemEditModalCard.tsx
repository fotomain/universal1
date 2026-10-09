// ProductItemEditModalCard - edits ONE product in a modal window (the EditRowModalCard of the Products table).
//   Main        every editable column of the Products table as a form: title, SKU, product type, folder, a Units section (unit for inventory +
//               default unit, both required, both from measureUnitTable), VAT rate, description, active
//   Prices      the prices of the product (productPriceTable) - a ReusableTable of its rows, add / edit / delete in place
//   Variants    the variants of the product (variantTable): owned by its type / by the product, see variantOwnerOfProduct
//   Properties  the property values of the product (propertyValueTable)
// The three tables reuse the column definitions of the dashboard (buildDashboardTables), so a cell works exactly as there.
// Opened by ReusableTable: row menu "Edit" (right-click / long-press / ⋮) or a click on a row with uxuiTable.inlineEdit = false.
//
// DESIGN SYSTEMS: every control is a design-system component of the app (they follow the active system: paper, tamagui, ant, expo,
// googlemd3web, applemacui, native): TextInputApp (text / number / description), SwitchApp (yes / no), SelectorFromApp (lists),
// SegmentButtonsApp (the tabs), ButtonApp (Done / close), TextApp (texts), IconApp. Only the window itself (corners, border, shadow,
// header band, backdrop) is drawn here, by productModalLook(), with the same look as CardApp / ModalAskComponent of that system.
// Text fields save ~0.6 s after typing stops and when the card closes (TextInputApp has no blur event).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import type { DesignSystemType } from '../../../redux/uxuiSlice';
import IconApp from '../../../ui/components/common/IconApp';
import TextApp from '../../../ui/components/common/TextApp';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import SelectorFromApp from '../../../ui/components/common/SelectorFromApp';
import SegmentButtonsApp from '../../../ui/components/common/SegmentButtonsApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import ReusableTableCell from '../../../ui/components/table/reusable/ReusableTableCell';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { EditRowModalCardProps, ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { cellValue, optionsOf, parseNumberInput } from '../../../ui/components/table/reusable/tableRows';
import { PRODUCT_TABLES, ProductTableKey } from '../productModel';
import { isSet, ProductCatalogData, rowTitle, variantOwnerOfProduct, variantsOfProduct } from '../crud/productCatalogTools';
import type { DashboardTableConfig } from '../dashboard/productDashboardTables';

export type ProductItemTab = 'main' | 'prices' | 'variants' | 'properties';

export interface ProductItemEditModalCardProps extends EditRowModalCardProps {
  data: ProductCatalogData;
  /** buildDashboardTables(): the column definitions of the Prices / Variants / Properties tables */
  tables: Record<ProductTableKey, DashboardTableConfig>;
  /** the tab to start with (default 'main') */
  initialTab?: ProductItemTab;
}

const TABS: { key: ProductItemTab; label: string; icon: string }[] = [
  { key: 'main', label: 'Main', icon: 'inventory_2' },
  { key: 'prices', label: 'Prices', icon: 'sell' },
  { key: 'variants', label: 'Variants', icon: 'style' },
  { key: 'properties', label: 'Properties', icon: 'tune' },
];

/** how the window of the card looks in a design system (the rest is drawn by the design-system components inside) */
export interface ProductModalLook {
  radius: number;
  borderWidth: number;
  /** 'none' | 'elevation' (native shadow) | 'soft' (a large soft shadow) */
  shadow: 'none' | 'elevation' | 'soft';
  /** the header band has its own background (Ant) */
  headerBand: string | null;
  /** the dimming behind the window */
  backdrop: string;
  /** hairline between header / tabs / body / footer */
  hairline: number;
}

/** corners, border, shadow of the window per design system - the same values as CardApp / ModalAskComponent */
export function productModalLook(system: DesignSystemType, isDark: boolean, appleBackdrop?: string): ProductModalLook {
  const dim = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)';
  switch (system) {
    case 'applemacui': return { radius: 20, borderWidth: 0, shadow: 'soft', headerBand: null, backdrop: appleBackdrop ?? dim, hairline: 0.5 };
    case 'paper':
    case 'googlemd3web': return { radius: 28, borderWidth: 0, shadow: 'elevation', headerBand: null, backdrop: dim, hairline: 1 };
    case 'tamagui': return { radius: 16, borderWidth: 1, shadow: 'soft', headerBand: null, backdrop: dim, hairline: 1 };
    case 'ant': return { radius: 8, borderWidth: 1, shadow: 'soft', headerBand: isDark ? '#1a2234' : '#fafafa', backdrop: dim, hairline: 1 };
    case 'expo': return { radius: 20, borderWidth: 1.5, shadow: 'none', headerBand: null, backdrop: dim, hairline: 1 };
    case 'native':
    default: return { radius: 6, borderWidth: 1, shadow: 'none', headerBand: null, backdrop: dim, hairline: 1 };
  }
}

/** a text typed into a field: shown at once, saved 0.6 s after the last key and when the field goes away (card closed / tab changed) */
export function useDebouncedCommit(value: string, commit: (text: string) => void): [string, (text: string) => void] {
  const [draft, setDraft] = useState(value);
  const live = useRef({ draft, commit });
  live.current.commit = commit;
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (!dirty.current) { setDraft(value); live.current.draft = value; } }, [value]);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (dirty.current) { dirty.current = false; live.current.commit(live.current.draft); }
  }, []);
  useEffect(() => flush, [flush]);
  const change = useCallback((text: string) => {
    dirty.current = true;
    live.current.draft = text;
    setDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }, [flush]);
  return [draft, change];
}

/** one text / number column as a TextInputApp */
export function TextField({ col, row, setCell, testID }: { col: VisualColumn; row: ReusableTableRow; setCell: EditRowModalCardProps['setCell']; testID: string }) {
  const numeric = col.type === 'integer' || col.type === 'number';
  const current = cellValue(row, col);
  const shown = current === null || current === undefined ? '' : String(current);
  const [draft, change] = useDebouncedCommit(shown, (text) => {
    if (!numeric) { if (text !== shown) setCell(col.key, text); return; }
    const n = parseNumberInput(text, { integer: col.type === 'integer', min: (col as any).min, max: (col as any).max });
    if (n !== current) setCell(col.key, n);
  });
  const multiline = col.key === 'description';
  return (
    <TextInputApp testID={testID} label={col.title} value={draft} onChangeText={change} placeholder={(col as any).placeholder}
      disabled={col.editable === false} multiline={multiline} numberOfLines={multiline ? 3 : 1} keyboardType={numeric ? 'numeric' : 'default'} />
  );
}

/** one select column as a SelectorFromApp ('' = none) */
export function SelectField({ col, row, setCell, testID }: { col: VisualColumn; row: ReusableTableRow; setCell: EditRowModalCardProps['setCell']; testID: string }) {
  const options = optionsOf(col as any, row);
  const allowEmpty = (col as any).allowEmpty !== false;
  const value = cellValue(row, col);
  const list = useMemo(() => [...(allowEmpty ? [{ label: '— none —', value: '' }] : []), ...options.map((o) => ({ label: o.label, value: o.value }))], [allowEmpty, options]);
  return (
    <SelectorFromApp testID={testID} label={col.title} value={typeof value === 'string' ? value : ''} options={list} placeholder={(col as any).placeholder ?? 'Select…'}
      disabled={col.editable === false} onValueChange={(v) => setCell(col.key, v === '' ? null : v)} />
  );
}

/** the field of one column in the Main tab, in the design system's own control */
export function MainField({ col, columns, row, setCell, patchRow, testID }: { col: VisualColumn; columns: VisualColumn[]; row: ReusableTableRow; setCell: EditRowModalCardProps['setCell']; patchRow: EditRowModalCardProps['patchRow']; testID: string }) {
  const id = `${testID}-cell-${row.rowGUID}-${col.key}`;
  if (col.type === 'text' || col.type === 'integer' || col.type === 'number') return <TextField col={col} row={row} setCell={setCell} testID={id} />;
  if (col.type === 'select') return <SelectField col={col} row={row} setCell={setCell} testID={id} />;
  if (col.type === 'boolean') {
    return <SwitchApp testID={id} label={col.title} value={cellValue(row, col) === true} disabled={col.editable === false} onValueChange={(v) => setCell(col.key, v)} />;
  }
  // multiSelect / date / color / json / catalog: the table's own cell (themed by the design system colors)
  return (
    <View style={modalCardStyles.cellBox}>
      <TextApp variant="caption">{col.title}</TextApp>
      <ReusableTableCell col={col} columns={columns} row={row} rowIndex={0} rounded dense testID={testID} onChange={(key, value) => setCell(key, value)} onPatch={patchRow} />
    </View>
  );
}

/** the table of ONE owner's rows of a catalog table, with the owner column left out (it is the product / role / owner itself) */
export function OwnerRowsTable({ entity, itemLabel, emptyRowJSON, cfg, ownerGUID, hideColumn, testID }: {
  entity: string; itemLabel: string; emptyRowJSON: () => Record<string, any>;
  /** the dashboard configuration of the table (title, columns, row menu) */
  cfg: Pick<DashboardTableConfig, 'title' | 'columns' | 'extraMenuItems'>;
  ownerGUID: string; hideColumn: string; testID: string;
}) {
  const columns = useMemo<VisualColumn[]>(() => cfg.columns.filter((col) => col.key !== hideColumn), [cfg.columns, hideColumn]);
  const rowFilter = useMemo(() => (row: ReusableTableRow) => row.rowOwnerGUID === ownerGUID, [ownerGUID]);
  const newRowDefaults = useMemo(() => () => ({ rowOwnerGUID: ownerGUID }), [ownerGUID]);
  return (
    <ReusableTable
      testID={testID}
      entityName={entity}
      crudListTitle={cfg.title}
      itemLabel={itemLabel}
      listOwnerGUID={REUSABLE_TABLE_ALL}
      listParentGUID={REUSABLE_TABLE_ALL}
      visualColumns={columns}
      defaultRowJSON={emptyRowJSON}
      rowFilter={rowFilter}
      newRowDefaults={newRowDefaults}
      extraMenuItems={cfg.extraMenuItems}
      realtime
      resizeColumnWidth
      emptyText={`No ${itemLabel.toLowerCase()}s yet. Press "+" to add one.`}
      uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
    />
  );
}

/** OwnerRowsTable of a product table */
function OwnerTable({ tableKey, tables, ownerGUID, hideColumn, testID }: {
  tableKey: 'productPrice' | 'variant' | 'propertyValue'; tables: ProductItemEditModalCardProps['tables']; ownerGUID: string; hideColumn: string; testID: string;
}) {
  const def = PRODUCT_TABLES[tableKey];
  return <OwnerRowsTable entity={def.entity} itemLabel={def.itemLabel} emptyRowJSON={def.emptyRowJSON} cfg={tables[tableKey]} ownerGUID={ownerGUID} hideColumn={hideColumn} testID={testID} />;
}

export default function ProductItemEditModalCard({ row, itemLabel, visualColumns, setCell, patchRow, onClose, testID, data, tables, initialTab = 'main' }: ProductItemEditModalCardProps) {
  const { themeColors: c, activeSystem, isDark, appleMacUITheme: apple } = useDesignSystem();
  const { width, height } = useWindowDimensions();
  const look = productModalLook(activeSystem, isDark, activeSystem === 'applemacui' ? apple?.colors?.backdrop : undefined);
  const [tab, setTab] = useState<ProductItemTab>(initialTab);
  const product = data.product.find((p) => p.rowGUID === row.rowGUID) ?? (row as any);
  const variantOwner = variantOwnerOfProduct(data, product);
  const counts: Record<ProductItemTab, number | undefined> = {
    main: undefined,
    prices: data.productPrice.filter((p) => p.rowOwnerGUID === row.rowGUID).length,
    variants: variantsOfProduct(data, product).length,
    properties: data.propertyValue.filter((p) => p.rowOwnerGUID === row.rowGUID).length,
  };
  const fields = useMemo(() => visualColumns.filter((col) => col.type !== 'rowNumber' && col.type !== 'custom'), [visualColumns]);
  const title = rowTitle(row as any);
  const unitName = (guid: unknown) => (isSet(guid) ? rowTitle(data.measureUnit.find((u) => u.rowGUID === guid) as any) : '');
  const unitTitle = unitName(product?.rowJSON?.measureUnitForInventory);
  const defaultUnitTitle = unitName(product?.rowJSON?.measureUnitDefault);
  const unitsOk = !!unitTitle && !!defaultUnitTitle;
  const sameUnit = unitsOk && product.rowJSON.measureUnitForInventory === product.rowJSON.measureUnitDefault;
  const subtitle = [product?.rowJSON?.sku, data.productType.find((t) => t.rowGUID === product?.rowOwnerGUID)?.rowJSON?.title].filter(Boolean).join(' · ');
  const hair = { borderColor: c.border, borderWidth: 0, borderBottomWidth: look.hairline };
  const shadow = look.shadow === 'elevation' ? { elevation: 8 }
    : look.shadow === 'soft' ? (Platform.OS === 'web' ? ({ boxShadow: '0 12px 40px rgba(0,0,0,0.3)' } as any) : { elevation: 8 })
    : null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={[modalCardStyles.backdrop, { backgroundColor: look.backdrop }]} onPress={onClose}>
        <Pressable testID={testID} onPress={() => {}}
          style={[modalCardStyles.window, shadow, { backgroundColor: c.surface, borderColor: c.border, borderWidth: look.borderWidth, borderRadius: look.radius, width: Math.min(width - 24, 980), height: Math.min(height - 40, 760) }]}>
          <View style={[modalCardStyles.head, hair, look.headerBand ? { backgroundColor: look.headerBand } : null]}>
            <IconApp name="inventory_2" size={22} color={c.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <TextApp testID={`${testID}-title`} variant="title" numberOfLines={1}>{title && title !== row.rowGUID ? title : `New ${itemLabel.toLowerCase()}`}</TextApp>
              {!!subtitle && <TextApp variant="caption" numberOfLines={1} style={{ opacity: 0.65 }}>{subtitle}</TextApp>}
            </View>
            <ButtonApp testID={`${testID}-close`} variant="toolbar" icon="close" accessibilityLabel="Close" onPress={onClose} />
          </View>

          <View style={[modalCardStyles.tabs, hair]}>
            <SegmentButtonsApp testID={`${testID}-tabs`} compact value={tab} onValueChange={(v) => setTab(v as ProductItemTab)}
              buttons={TABS.map((t) => ({ value: t.key, label: counts[t.key] === undefined ? t.label : `${t.label} (${counts[t.key]})`, icon: t.icon, testID: `${testID}-tab-${t.key}` }))} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={modalCardStyles.body} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {tab === 'main' && (
              <View testID={`${testID}-main`} style={modalCardStyles.form}>
                {fields.map((col) => (
                  <React.Fragment key={col.key}>
                    {/* Units: the unit products are counted / stocked in + the unit they are offered, ordered and reported in */}
                    {col.key === 'measureUnitForInventory' && (
                      <View style={modalCardStyles.section}><TextApp testID={`${testID}-section-units`} variant="subtitle">Units</TextApp></View>
                    )}
                    <View style={[modalCardStyles.field, width >= 760 && col.key !== 'description' ? { width: '48.5%' } : { width: '100%' }]}>
                      <MainField col={col} columns={visualColumns} row={row} setCell={setCell} patchRow={patchRow} testID={`${testID}-main`} />
                    </View>
                    {col.key === 'measureUnitDefault' && (
                      <View style={modalCardStyles.section}>
                        <TextApp testID={`${testID}-unit-hint`} variant="caption" style={{ opacity: unitsOk ? 0.65 : 1, color: unitsOk ? undefined : c.error }}>
                          {unitsOk
                            ? (sameUnit ? 'Counted, stocked and offered in the same unit.' : `Counted and stocked in ${unitTitle}, offered / ordered / reported in ${defaultUnitTitle}.`)
                            : 'A product needs one unit for inventory and one default unit (both from the units catalog).'}
                        </TextApp>
                      </View>
                    )}
                  </React.Fragment>
                ))}
              </View>
            )}
            {tab === 'prices' && <OwnerTable tableKey="productPrice" tables={tables} ownerGUID={row.rowGUID} hideColumn="product" testID={`${testID}-prices`} />}
            {tab === 'properties' && <OwnerTable tableKey="propertyValue" tables={tables} ownerGUID={row.rowGUID} hideColumn="product" testID={`${testID}-properties`} />}
            {tab === 'variants' && (isSet(variantOwner)
              ? (
                <View style={{ gap: 8 }}>
                  {variantOwner !== row.rowGUID && (
                    <TextApp testID={`${testID}-variants-owner`} variant="caption" style={{ opacity: 0.7 }}>
                      {`Variants of ${rowTitle(data.productType.find((t) => t.rowGUID === variantOwner) ?? data.product.find((p) => p.rowGUID === variantOwner) ?? ({ rowGUID: variantOwner } as any))} - shared with the other products of that owner.`}
                    </TextApp>
                  )}
                  <OwnerTable key={variantOwner} tableKey="variant" tables={tables} ownerGUID={variantOwner} hideColumn="owner" testID={`${testID}-variants`} />
                </View>
              )
              : <TextApp testID={`${testID}-variants-none`} style={{ opacity: 0.7 }}>The product type has no variants: the product itself is sold.</TextApp>)}
          </ScrollView>

          <View style={[modalCardStyles.foot, { borderColor: c.border, borderTopWidth: look.hairline }]}>
            <TextApp variant="caption" style={{ opacity: 0.55, flex: 1 }}>Changes are saved as you make them.</TextApp>
            <ButtonApp testID={`${testID}-done`} title="Done" variant="contained" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const modalCardStyles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  window: { overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  tabs: { paddingHorizontal: 12, paddingVertical: 8 },
  body: { padding: 16, gap: 12 },
  form: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  field: { gap: 4 },
  section: { width: '100%', marginTop: 4 },
  cellBox: { gap: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
});
