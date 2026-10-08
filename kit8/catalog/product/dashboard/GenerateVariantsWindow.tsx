// Product dashboard - "Generate variants": every combination of the chosen values of the REQUIRED descriptors of
// the owner's variant set (Color × Memory ...), minus the combinations that already exist. Creates the variants +
// their variant values; title and descriptorKey follow the type template (rules R9 / R10).
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import ReusableTableOptionPicker from '../../../ui/components/table/reusable/ReusableTableOptionPicker';
import { plannedVariants, ProductCatalogData, rowTitle, sortBySort, variantLinesOfOwner } from '../crud/productCatalogTools';
import type { ProductLabels } from '../crud/productLabels';

export interface GenerateVariantsWindowProps {
  data: ProductCatalogData;
  labels: ProductLabels;
  initialOwnerGUID?: string | null;
  onCreate: (ownerGUID: string, planned: ReturnType<typeof plannedVariants>) => void;
  onClose: () => void;
}

const MAX = 200;

export default function GenerateVariantsWindow({ data, labels, initialOwnerGUID, onCreate, onClose }: GenerateVariantsWindowProps) {
  const { themeColors: c } = useDesignSystem();
  const [owner, setOwner] = useState<string | null>(initialOwnerGUID && labels.options.variantOwners.some((o) => o.value === initialOwnerGUID) ? initialOwnerGUID : null);
  const [picking, setPicking] = useState(false);
  /** genus -> chosen value GUIDs (default: all values) */
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const lines = useMemo(() => (owner ? variantLinesOfOwner(data, owner).filter((l) => l.rowJSON?.required) : []), [data, owner]);
  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const l of lines) next[l.rowParentGUID] = data.descriptorValue.filter((v) => v.rowOwnerGUID === l.rowParentGUID).map((v) => v.rowGUID);
    setChosen(next);
  }, [owner]); // eslint-disable-line react-hooks/exhaustive-deps
  const planned = useMemo(() => (owner ? plannedVariants(data, owner, { only: chosen, limit: MAX }) : []), [data, owner, chosen]);
  const toggle = (genus: string, v: string) => setChosen((p) => ({ ...p, [genus]: (p[genus] || []).includes(v) ? p[genus].filter((x) => x !== v) : [...(p[genus] || []), v] }));
  const noneChosen = lines.some((l) => (chosen[l.rowParentGUID] || []).length === 0);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable testID="generate-variants" style={[styles.window, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => {}}>
          <Text style={[styles.title, { color: c.text }]}>Generate variants</Text>
          <Text style={{ color: c.text, opacity: 0.7, marginBottom: 12 }}>Every combination of the chosen values of the required descriptors. Existing combinations are skipped.</Text>
          <Pressable testID="generate-variants-owner" onPress={() => setPicking(true)} style={[styles.select, { borderColor: c.border }]}>
            <Text numberOfLines={1} style={{ flex: 1, color: c.text, opacity: owner ? 1 : 0.5 }}>{owner ? labels.ownerLabel(owner) : 'Choose a product type (per type) or a product (per product)…'}</Text>
            <IconApp name="expand_more" size={18} color={c.text} />
          </Pressable>
          <ScrollView style={{ maxHeight: 360 }}>
            {owner && lines.length === 0 && <Text style={{ color: c.error, marginVertical: 8 }}>This owner's variant set has no required descriptors.</Text>}
            {lines.map((l) => (
              <View key={l.rowGUID} style={{ marginTop: 12 }}>
                <Text style={{ color: c.text, fontWeight: '700', marginBottom: 6 }}>{labels.title('descriptorGenus', l.rowParentGUID)}</Text>
                <View style={styles.chips}>
                  {sortBySort(data.descriptorValue.filter((v) => v.rowOwnerGUID === l.rowParentGUID)).map((v) => {
                    const on = (chosen[l.rowParentGUID] || []).includes(v.rowGUID);
                    return (
                      <Pressable key={v.rowGUID} testID={`generate-variants-value-${v.rowGUID}`} onPress={() => toggle(l.rowParentGUID, v.rowGUID)}
                        style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary + '18' : 'transparent' }]}>
                        {v.rowJSON?.hex ? <View style={[styles.dot, { backgroundColor: v.rowJSON.hex, borderColor: c.border }]} /> : null}
                        <Text style={{ color: on ? c.primary : c.text, fontWeight: on ? '700' : '400' }}>{rowTitle(v)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {owner && lines.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text testID="generate-variants-count" style={{ color: c.text, fontWeight: '700' }}>
                  {noneChosen ? 'Choose at least one value of every descriptor.' : `${planned.length}${planned.length >= MAX ? '+' : ''} new variant${planned.length === 1 ? '' : 's'}`}
                </Text>
                {planned.slice(0, 12).map((p) => <Text key={p.descriptorKey} style={{ color: c.text, opacity: 0.75 }}>• {p.title}</Text>)}
                {planned.length > 12 && <Text style={{ color: c.text, opacity: 0.6 }}>… and {planned.length - 12} more</Text>}
              </View>
            )}
          </ScrollView>
          <View style={styles.buttons}>
            <Pressable testID="generate-variants-cancel" onPress={onClose} style={[styles.btn, { borderColor: c.border }]}><Text style={{ color: c.text }}>Cancel</Text></Pressable>
            <Pressable testID="generate-variants-create" disabled={!owner || planned.length === 0} onPress={() => owner && onCreate(owner, planned)}
              style={[styles.btn, { borderColor: c.primary, backgroundColor: c.primary, opacity: !owner || planned.length === 0 ? 0.4 : 1 }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Create {planned.length || ''}</Text>
            </Pressable>
          </View>
          {picking && (
            <ReusableTableOptionPicker testID="generate-variants-owner-picker" title="Variant owner" options={labels.options.variantOwners} multi={false} allowEmpty={false}
              selected={owner ? [owner] : []} onClose={() => setPicking(false)} onPick={(v) => { setPicking(false); setOwner(v[0] ?? null); }} />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  window: { width: '100%', maxWidth: 560, borderWidth: 1, borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  select: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, height: 38, alignItems: 'center', justifyContent: 'center' },
});
