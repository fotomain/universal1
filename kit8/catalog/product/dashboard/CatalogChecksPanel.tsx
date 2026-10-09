// The "Checks" panel of a catalog dashboard: the findings of the validation rules (R1-R14) with severity filter, one-click fixes
// (rebuild variant title + key, sql_for_delete orphan rows) and a link to the row. Shared by the product and the resource role dashboard
// (idPrefix 'product' | 'role' keeps their test ids apart).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import type { ProductIssue } from '../crud/productValidation';

export interface CatalogChecksPanelProps<T extends string> {
  issues: ProductIssue<T>[];
  /** rule code -> its text */
  rules: Record<string, string>;
  /** a table key -> its menu title */
  tableTitle: (table: T) => string;
  idPrefix: string;
  /** shown when there is nothing to report */
  allOkText: string;
  onOpenTable: (table: T, focusRowGUID: string) => void;
  onRebuildVariants: (only?: string[]) => void;
  /** the findings with fix 'deleteRow' */
  onDeleteOrphans: (orphans: ProductIssue<T>[]) => void;
}

export default function CatalogChecksPanel<T extends string>({ issues, rules, tableTitle, idPrefix, allOkText, onOpenTable, onRebuildVariants, onDeleteOrphans }: CatalogChecksPanelProps<T>) {
  const { themeColors: c } = useDesignSystem();
  const [showAll, setShowAll] = useState(false);
  const [severity, setSeverity] = useState<'all' | 'error' | 'warning'>('all');
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const shown = issues.filter((i) => severity === 'all' || i.severity === severity);
  const rebuildable = issues.filter((i) => i.fix === 'rebuildVariant');
  const orphans = issues.filter((i) => i.fix === 'deleteRow');
  return (
    <View testID={`${idPrefix}-checks`} style={[styles.card, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.checksHead}>
        <Text style={[styles.cardTitle, { color: c.text, marginBottom: 0, flex: 1 }]}>Checks</Text>
        {(['all', 'error', 'warning'] as const).map((s) => (
          <Pressable key={s} testID={`${idPrefix}-checks-filter-${s}`} onPress={() => setSeverity(s)} style={[styles.pill, { borderColor: severity === s ? c.primary : c.border, backgroundColor: severity === s ? c.primary + '18' : 'transparent' }]}>
            <Text style={{ color: severity === s ? c.primary : c.text, fontSize: 12, fontWeight: '600' }}>{s === 'all' ? `All ${issues.length}` : s === 'error' ? `Errors ${errors}` : `Warnings ${warnings}`}</Text>
          </Pressable>
        ))}
      </View>
      {(rebuildable.length > 0 || orphans.length > 0) && (
        <View style={styles.fixBar}>
          {rebuildable.length > 0 && (
            <Pressable testID={`${idPrefix}-checks-rebuild-all`} onPress={() => onRebuildVariants()} style={[styles.fixBtn, { borderColor: c.primary }]}>
              <IconApp name="autorenew" size={14} color={c.primary} />
              <Text style={{ color: c.primary, fontWeight: '700' }}>Rebuild {rebuildable.length} variant title{rebuildable.length === 1 ? '' : 's'} / key{rebuildable.length === 1 ? '' : 's'}</Text>
            </Pressable>
          )}
          {orphans.length > 0 && (
            <Pressable testID={`${idPrefix}-checks-delete-orphans`} onPress={() => onDeleteOrphans(orphans)} style={[styles.fixBtn, { borderColor: c.error }]}>
              <IconApp name="delete_sweep" size={14} color={c.error} />
              <Text style={{ color: c.error, fontWeight: '700' }}>Delete {orphans.length} orphan row{orphans.length === 1 ? '' : 's'}</Text>
            </Pressable>
          )}
        </View>
      )}
      {shown.length === 0 && (
        <View style={styles.okRow}><IconApp name="verified" size={18} color={c.primary} /><Text style={{ color: c.text }}>{issues.length ? 'Nothing of this kind.' : allOkText}</Text></View>
      )}
      {(showAll ? shown : shown.slice(0, 25)).map((i, n) => (
        <View key={`${i.rule}-${i.table}-${i.rowGUID}-${n}`} testID={`${idPrefix}-issue-${i.rule}-${i.rowGUID}`} style={[styles.issue, { borderTopColor: c.border }]}>
          <IconApp name={i.severity === 'error' ? 'error' : 'warning'} size={16} color={i.severity === 'error' ? c.error : '#b26a00'} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.text }}>{i.message}</Text>
            <Text style={{ color: c.text, opacity: 0.55, fontSize: 12 }}>{i.rule} · {rules[i.rule] ?? ''} · {tableTitle(i.table)}</Text>
          </View>
          {i.fix === 'rebuildVariant' && (
            <Pressable testID={`${idPrefix}-issue-fix-${i.rowGUID}`} onPress={() => onRebuildVariants([i.rowGUID])} hitSlop={6}><Text style={{ color: c.primary, fontWeight: '700' }}>Fix</Text></Pressable>
          )}
          <Pressable testID={`${idPrefix}-issue-open-${i.rowGUID}`} onPress={() => onOpenTable(i.table, i.rowGUID)} hitSlop={6}><Text style={{ color: c.primary, fontWeight: '700' }}>Open</Text></Pressable>
        </View>
      ))}
      {shown.length > 25 && (
        <Pressable testID={`${idPrefix}-checks-more`} onPress={() => setShowAll((v) => !v)} style={{ paddingTop: 8 }}>
          <Text style={{ color: c.primary, fontWeight: '700' }}>{showAll ? 'Show fewer' : `Show all ${shown.length}`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  checksHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  pill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  fixBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  fixBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  issue: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
