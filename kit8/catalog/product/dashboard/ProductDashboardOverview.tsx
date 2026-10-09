// Product dashboard - Overview: headline numbers, products per type / folder, and the Checks panel (rules R1-R13
// of the descriptors plan) with one-click fixes (rebuild variant title + key, sql_for_delete orphan rows).
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { PRODUCT_TABLES, ProductTableKey } from '../productModel';
import { isSet, ProductCatalogData, rowTitle, variantsOfProduct } from '../crud/productCatalogTools';
import type { ProductLabels } from '../crud/productLabels';
import { ProductIssue, RULES } from '../crud/productValidation';
import CatalogChecksPanel from './CatalogChecksPanel';

export interface ProductDashboardOverviewProps {
  data: ProductCatalogData;
  labels: ProductLabels;
  issues: ProductIssue[];
  /** a table name -> its menu title */
  tableTitle: (key: ProductTableKey) => string;
  onOpenTable: (key: ProductTableKey, filters?: Record<string, string>, focusRowGUID?: string) => void;
  onRebuildVariants: (only?: string[]) => void;
  onDeleteRows: (key: ProductTableKey, rows: { rowGUID: string; rowOwnerGUID?: string }[]) => void;
  /** the screen is wide: 2 columns */
  wide: boolean;
}

/** one horizontal bar per entry (magnitude, single series): label · bar · value */
export function BarList({ title, rows, testID, onPress }: { title: string; rows: { key: string; label: string; value: number }[]; testID: string; onPress?: (key: string) => void }) {
  const { themeColors: c } = useDesignSystem();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View testID={testID} style={[styles.card, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
      {rows.length === 0 && <Text style={{ color: c.text, opacity: 0.6 }}>No data yet.</Text>}
      {rows.map((r) => (
        <Pressable key={r.key} testID={`${testID}-${r.key}`} onPress={onPress ? () => onPress(r.key) : undefined} accessibilityLabel={`${r.label}: ${r.value}`}
          style={({ hovered }: any) => [styles.barRow, hovered && onPress ? { backgroundColor: c.primary + '0d' } : null]}>
          <Text numberOfLines={1} style={[styles.barLabel, { color: c.text }]}>{r.label}</Text>
          <View style={styles.barTrack}>
            {/* 4 px rounded data end, anchored at the left baseline */}
            <View style={[styles.bar, { width: `${Math.max(2, (r.value / max) * 100)}%`, backgroundColor: c.primary }]} />
          </View>
          <Text style={[styles.barValue, { color: c.text }]}>{r.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ProductDashboardOverview({ data, labels: L, issues, tableTitle, onOpenTable, onRebuildVariants, onDeleteRows, wide }: ProductDashboardOverviewProps) {
  const { themeColors: c } = useDesignSystem();

  const stats = useMemo(() => {
    const active = data.product.filter((p) => p.rowJSON?.isActive !== false).length;
    const sellable = data.product.reduce((n, p) => n + Math.max(1, variantsOfProduct(data, p).length), 0);
    return { active, sellable };
  }, [data]);
  const perType = useMemo(() => data.productType.map((t) => ({ key: t.rowGUID, label: rowTitle(t), value: data.product.filter((p) => p.rowOwnerGUID === t.rowGUID).length }))
    .sort((a, b) => b.value - a.value), [data.productType, data.product]);
  const perTopFolder = useMemo(() => {
    const top = (g: string) => { let cur = g; const seen = new Set<string>(); for (;;) { const f = data.productFolder.find((x) => x.rowGUID === cur); if (!f || !isSet(f.rowParentGUID) || seen.has(cur)) return cur; seen.add(cur); cur = f.rowParentGUID; } };
    const m = new Map<string, number>();
    for (const p of data.product) { const k = isSet(p.rowParentGUID) ? top(p.rowParentGUID) : 'empty'; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([key, value]) => ({ key, label: key === 'empty' ? 'No folder' : L.title('productFolder', key), value })).sort((a, b) => b.value - a.value);
  }, [data.product, data.productFolder, L]);

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;

  const tiles: { key: string; label: string; value: string; hint: string; icon: string; open?: ProductTableKey }[] = [
    { key: 'products', label: 'Products', value: String(data.product.length), hint: `${stats.active} active`, icon: 'inventory_2', open: 'product' },
    { key: 'types', label: 'Product types', value: String(data.productType.length), hint: `${data.productFolder.length} folders`, icon: 'category', open: 'productType' },
    { key: 'variants', label: 'Variants', value: String(data.variant.length), hint: `${data.variantValue.length} values`, icon: 'style', open: 'variant' },
    { key: 'sellable', label: 'Sellable items', value: String(stats.sellable), hint: 'product × variant', icon: 'shopping_cart' },
    { key: 'descriptors', label: 'Descriptors', value: String(data.descriptorGenus.length), hint: `${data.descriptorValue.length} values`, icon: 'label', open: 'descriptorGenus' },
    { key: 'prices', label: 'Prices', value: String(data.productPrice.length), hint: `${data.priceType.length} price types`, icon: 'sell', open: 'productPrice' },
    { key: 'barcodes', label: 'Barcodes', value: String(data.productBarcode.length), hint: `${data.productPackage.length} packs`, icon: 'barcode', open: 'productBarcode' },
    { key: 'checks', label: 'Checks', value: issues.length ? String(issues.length) : 'OK', hint: issues.length ? `${errors} errors · ${warnings} warnings` : 'no issues', icon: issues.length ? 'warning' : 'verified' },
  ];

  return (
    <View testID="product-overview" style={{ gap: 12 }}>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <Pressable key={t.key} testID={`product-tile-${t.key}`} disabled={!t.open} onPress={() => t.open && onOpenTable(t.open)}
            style={({ hovered }: any) => [styles.tile, { borderColor: c.border, backgroundColor: hovered && t.open ? c.primary + '0d' : c.surface, flexBasis: wide ? '23%' : '46%' }]}>
            <View style={styles.tileHead}>
              <IconApp name={t.icon} size={16} color={t.key === 'checks' && errors ? c.error : c.primary} />
              <Text style={[styles.tileLabel, { color: c.text }]}>{t.label}</Text>
            </View>
            <Text testID={`product-tile-${t.key}-value`} style={[styles.tileValue, { color: c.text }]}>{t.value}</Text>
            <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{t.hint}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.split, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={{ flex: 1 }}><BarList testID="product-per-type" title="Products per type" rows={perType} onPress={(k) => onOpenTable('product', { type: k })} /></View>
        <View style={{ flex: 1 }}><BarList testID="product-per-folder" title="Products per top folder" rows={perTopFolder} /></View>
      </View>

      <CatalogChecksPanel idPrefix="product" issues={issues} rules={RULES} tableTitle={tableTitle} allOkText="All rules of the descriptors plan are met."
        onOpenTable={(table, focus) => onOpenTable(table as ProductTableKey, {}, focus)} onRebuildVariants={onRebuildVariants}
        onDeleteOrphans={(orphans) => {
          const byTable = new Map<ProductTableKey, { rowGUID: string; rowOwnerGUID?: string }[]>();
          orphans.forEach((o) => { const row = data[o.table].find((r) => r.rowGUID === o.rowGUID); byTable.set(o.table, [...(byTable.get(o.table) || []), { rowGUID: o.rowGUID, rowOwnerGUID: row?.rowOwnerGUID }]); });
          byTable.forEach((rows, key) => onDeleteRows(key, rows));
        }} />

      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>How the catalog is built</Text>
        {(['productType', 'descriptorGenus', 'descriptorDestination', 'descriptorPlan', 'product', 'propertyValue', 'variant', 'productPrice'] as ProductTableKey[]).map((k) => (
          <Pressable key={k} onPress={() => onOpenTable(k)} style={styles.howRow} testID={`product-how-${k}`}>
            <Text style={{ color: c.primary, fontWeight: '700', width: 150 }}>{tableTitle(k)}</Text>
            <Text style={{ color: c.text, opacity: 0.8, flex: 1 }}>{PRODUCT_TABLES[k].purpose}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 12, minWidth: 140 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  tileValue: { fontSize: 26, fontWeight: '800', marginVertical: 2 },
  split: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderRadius: 6 },
  barLabel: { width: 130, fontSize: 13 },
  barTrack: { flex: 1, height: 12 },
  bar: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  barValue: { width: 36, textAlign: 'right', fontSize: 13, fontWeight: '600' },
  howRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
});
