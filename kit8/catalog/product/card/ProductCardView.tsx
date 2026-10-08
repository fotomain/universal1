// Product card - everything about ONE product on one page (read-only): type, folder, unit, the Property values of
// its type's property set, the Variants it may use (rule R6) with today's prices (rule R13) and barcodes, packs,
// series. "Edit" links open the dashboard tables filtered by the product.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import ReusableTableOptionPicker from '../../../ui/components/table/reusable/ReusableTableOptionPicker';
import { ProductTableKey, todayISO } from '../productModel';
import {
  currentPrice, isSet, ProductCatalogData, priceTypeForProducts, propertyLinesOfProduct, rowTitle, variantOwnerOfProduct, variantsOfProduct,
} from '../crud/productCatalogTools';
import type { ProductLabels } from '../crud/productLabels';

export interface ProductCardViewProps {
  data: ProductCatalogData;
  labels: ProductLabels;
  productGUID: string | null;
  onPickProduct: (guid: string | null) => void;
  onOpenTable: (key: ProductTableKey, filters: Record<string, string>) => void;
  today?: string;
}

export default function ProductCardView({ data, labels: L, productGUID, onPickProduct, onOpenTable, today = todayISO() }: ProductCardViewProps) {
  const { themeColors: c } = useDesignSystem();
  const [picking, setPicking] = useState(false);
  const product = useMemo(() => data.product.find((p) => p.rowGUID === productGUID), [data.product, productGUID]);
  const type = product ? data.productType.find((t) => t.rowGUID === product.rowOwnerGUID) : undefined;
  const lines = useMemo(() => propertyLinesOfProduct(data, product), [data, product]);
  const variants = useMemo(() => variantsOfProduct(data, product), [data, product]);
  const priceTypes = data.priceType.filter((p) => priceTypeForProducts(p));
  const barcodes = product ? data.productBarcode.filter((b) => b.rowOwnerGUID === product.rowGUID) : [];
  const packs = product ? data.productPackaging.filter((k) => k.rowOwnerGUID === product.rowGUID || k.rowOwnerGUID === product.rowOwnerGUID) : [];
  const series = type ? data.productSeries.filter((s) => s.rowOwnerGUID === type.rowGUID) : [];
  const price = (variantGUID: string | null, pt: string) => {
    if (!product) return '';
    const p = currentPrice(data.productPrice, product.rowGUID, variantGUID, pt, today);
    const cur = data.priceType.find((x) => x.rowGUID === pt)?.rowJSON?.currency ?? '';
    return p && typeof p.rowJSON?.price === 'number' ? `${p.rowJSON.price.toFixed(2)} ${cur}` : '—';
  };
  const link = (label: string, key: ProductTableKey, filters: Record<string, string>, id: string) => (
    <Pressable testID={`product-card-edit-${id}`} onPress={() => onOpenTable(key, filters)} hitSlop={6} style={styles.link}>
      <IconApp name="edit" size={14} color={c.primary} />
      <Text style={{ color: c.primary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  const section = (title: string, right: React.ReactNode, children: React.ReactNode, id: string) => (
    <View testID={`product-card-${id}`} style={[styles.section, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.sectionHead}><Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>{right}</View>
      {children}
    </View>
  );
  const kv = (k: string, v: string, id: string) => (
    <View key={id} style={[styles.kv, { borderBottomColor: c.border }]}>
      <Text style={{ color: c.text, opacity: 0.65, width: 170 }}>{k}</Text>
      <Text testID={`product-card-value-${id}`} style={{ color: c.text, flex: 1, fontWeight: '500' }}>{v || '—'}</Text>
    </View>
  );

  return (
    <View testID="product-card" style={{ gap: 12 }}>
      <Pressable testID="product-card-pick" onPress={() => setPicking(true)} style={[styles.picker, { borderColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="search" size={18} color={c.text} />
        <Text numberOfLines={1} style={{ flex: 1, color: c.text, opacity: product ? 1 : 0.55, fontSize: 15 }}>{product ? `${rowTitle(product)}${product.rowJSON?.sku ? ` · ${product.rowJSON.sku}` : ''}` : 'Choose a product…'}</Text>
        <IconApp name="expand_more" size={18} color={c.text} />
      </Pressable>
      {picking && <ReusableTableOptionPicker testID="product-card-picker" title="Product" options={L.options.products} multi={false} allowEmpty={false} selected={productGUID ? [productGUID] : []}
        onClose={() => setPicking(false)} onPick={(v) => { setPicking(false); onPickProduct(v[0] ?? null); }} />}
      {!product ? (
        <Text style={{ color: c.text, opacity: 0.6, padding: 12 }}>{data.product.length ? 'Choose a product to see its card.' : 'No products yet.'}</Text>
      ) : (
        <>
          <View style={[styles.hero, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text testID="product-card-title" style={[styles.heroTitle, { color: c.text }]}>{rowTitle(product)}</Text>
            {!!product.rowJSON?.description && <Text style={{ color: c.text, opacity: 0.75 }}>{product.rowJSON.description}</Text>}
            <View style={styles.badges}>
              {[rowTitle(type), L.folderPath(product.rowParentGUID), product.rowJSON?.isActive === false ? 'Inactive' : 'Active'].filter(Boolean).map((b) => (
                <View key={b} style={[styles.badge, { backgroundColor: c.primary + '14' }]}><Text style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>{b}</Text></View>
              ))}
            </View>
          </View>
          {section('Main data', link('Edit', 'product', {}, 'product'), (
            <>
              {kv('SKU', String(product.rowJSON?.sku ?? ''), 'sku')}
              {kv('Unit', L.title('measureUnit', product.rowJSON?.unit), 'unit')}
              {kv('Variants', type?.rowJSON?.variantMode === 'none' || !variantOwnerOfProduct(data, product) ? 'none' : `${variants.length} (${L.ownerLabel(variantOwnerOfProduct(data, product))})`, 'variants')}
              {priceTypes.map((pt) => kv(`${rowTitle(pt)}${pt.rowJSON?.vatIncluded ? ' (VAT incl.)' : ''}`, price(null, pt.rowGUID), `price-${pt.rowGUID}`))}
            </>
          ), 'main')}
          {section('Properties', link('Edit', 'propertyValue', { product: product.rowGUID }, 'properties'), lines.length === 0
            ? <Text style={{ color: c.text, opacity: 0.6 }}>The product type has no property set.</Text>
            : lines.map((l) => {
              const pv = data.propertyValue.find((x) => x.rowOwnerGUID === product.rowGUID && x.rowParentGUID === l.rowGUID);
              return kv(`${L.title('descriptorGenus', l.rowParentGUID)}${l.rowJSON?.required ? ' *' : ''}`, pv ? L.valueText(pv) : '', `prop-${l.rowGUID}`);
            }), 'properties')}
          {variants.length > 0 && section(`Variants (${variants.length})`, link('Prices', 'productPrice', { product: product.rowGUID }, 'prices'), (
            <View>
              <View style={[styles.vRow, { borderBottomColor: c.border }]}>
                <Text style={[styles.vHead, { color: c.text, flex: 2 }]}>Variant</Text>
                {priceTypes.slice(0, 3).map((pt) => <Text key={pt.rowGUID} style={[styles.vHead, { color: c.text, flex: 1, textAlign: 'right' }]}>{rowTitle(pt)}</Text>)}
                <Text style={[styles.vHead, { color: c.text, flex: 1.4, textAlign: 'right' }]}>Barcode</Text>
              </View>
              {variants.map((v) => (
                <View key={v.rowGUID} testID={`product-card-variant-${v.rowGUID}`} style={[styles.vRow, { borderBottomColor: c.border, opacity: v.rowJSON?.isActive === false ? 0.5 : 1 }]}>
                  <Text style={{ color: c.text, flex: 2 }}>{rowTitle(v)}</Text>
                  {priceTypes.slice(0, 3).map((pt) => <Text key={pt.rowGUID} style={{ color: c.text, flex: 1, textAlign: 'right' }}>{price(v.rowGUID, pt.rowGUID)}</Text>)}
                  <Text style={{ color: c.text, flex: 1.4, textAlign: 'right', opacity: 0.8 }}>{barcodes.filter((b) => b.rowParentGUID === v.rowGUID).map((b) => b.rowJSON?.barcode).join(', ') || '—'}</Text>
                </View>
              ))}
            </View>
          ), 'variants')}
          {section(`Barcodes, packs, series`, link('Barcodes', 'productBarcode', { product: product.rowGUID }, 'barcodes'), (
            <>
              {kv('Barcodes', barcodes.filter((b) => !isSet(b.rowParentGUID)).map((b) => b.rowJSON?.barcode).join(', ') || (barcodes.length ? `${barcodes.length} (per variant)` : ''), 'barcodes')}
              {kv('Packs', packs.map((k) => `${rowTitle(k)} (${k.rowJSON?.ratio ?? '?'} ${L.title('measureUnit', k.rowParentGUID)})`).join(', '), 'packs')}
              {kv(type?.rowJSON?.useSerialNumbers ? 'Serial numbers / batches' : 'Batches', series.map((s) => rowTitle(s) + (s.rowJSON?.expiresAt ? ` → ${s.rowJSON.expiresAt}` : '')).join(', '), 'series')}
            </>
          ), 'logistics')}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44 },
  hero: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 6 },
  heroTitle: { fontSize: 22, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  section: { borderWidth: 1, borderRadius: 12, padding: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kv: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  vRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  vHead: { fontWeight: '700', fontSize: 12, opacity: 0.7 },
});
