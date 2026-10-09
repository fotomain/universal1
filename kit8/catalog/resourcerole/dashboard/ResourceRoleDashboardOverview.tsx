// Resource role dashboard - Overview: headline numbers, roles per type / folder, and the Checks panel (rules R1-R14 of the
// descriptors plan) with one-click fixes (rebuild variant title + key, delete orphan rows).
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { BarList } from '../../product/dashboard/ProductDashboardOverview';
import CatalogChecksPanel from '../../product/dashboard/CatalogChecksPanel';
import { RESOURCE_ROLE_TABLES, ResourceRoleTableKey } from '../resourceRoleModel';
import { isSet, ResourceRoleCatalogData, rowTitle, variantsOfRole } from '../crud/resourceRoleCatalogTools';
import type { ResourceRoleLabels } from '../crud/resourceRoleLabels';
import { ResourceRoleIssue, ROLE_RULES } from '../crud/resourceRoleValidation';

export interface ResourceRoleDashboardOverviewProps {
  data: ResourceRoleCatalogData;
  labels: ResourceRoleLabels;
  issues: ResourceRoleIssue[];
  /** a table name -> its menu title */
  tableTitle: (key: ResourceRoleTableKey) => string;
  onOpenTable: (key: ResourceRoleTableKey, filters?: Record<string, string>, focusRowGUID?: string) => void;
  onRebuildVariants: (only?: string[]) => void;
  onDeleteRows: (key: ResourceRoleTableKey, rows: { rowGUID: string; rowOwnerGUID?: string }[]) => void;
  /** the screen is wide: 2 columns */
  wide: boolean;
}

export default function ResourceRoleDashboardOverview({ data, labels: L, issues, tableTitle, onOpenTable, onRebuildVariants, onDeleteRows, wide }: ResourceRoleDashboardOverviewProps) {
  const { themeColors: c } = useDesignSystem();

  const stats = useMemo(() => {
    const active = data.resourceRole.filter((r) => r.rowJSON?.isActive !== false).length;
    const bookable = data.resourceRole.reduce((n, r) => n + Math.max(1, variantsOfRole(data, r).length), 0);
    return { active, bookable };
  }, [data]);
  const perType = useMemo(() => data.resourceRoleType.map((t) => ({ key: t.rowGUID, label: rowTitle(t), value: data.resourceRole.filter((r) => r.rowOwnerGUID === t.rowGUID).length }))
    .sort((a, b) => b.value - a.value), [data.resourceRoleType, data.resourceRole]);
  const perTopFolder = useMemo(() => {
    const top = (g: string) => { let cur = g; const seen = new Set<string>(); for (;;) { const f = data.resourceRoleFolder.find((x) => x.rowGUID === cur); if (!f || !isSet(f.rowParentGUID) || seen.has(cur)) return cur; seen.add(cur); cur = f.rowParentGUID; } };
    const m = new Map<string, number>();
    for (const r of data.resourceRole) { const k = isSet(r.rowParentGUID) ? top(r.rowParentGUID) : 'empty'; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([key, value]) => ({ key, label: key === 'empty' ? 'No folder' : L.roleTitle('resourceRoleFolder', key), value })).sort((a, b) => b.value - a.value);
  }, [data.resourceRole, data.resourceRoleFolder, L]);

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;

  const tiles: { key: string; label: string; value: string; hint: string; icon: string; open?: ResourceRoleTableKey }[] = [
    { key: 'roles', label: 'Roles', value: String(data.resourceRole.length), hint: `${stats.active} active`, icon: 'engineering', open: 'resourceRole' },
    { key: 'types', label: 'Role types', value: String(data.resourceRoleType.length), hint: `${data.resourceRoleFolder.length} folders`, icon: 'category', open: 'resourceRoleType' },
    { key: 'variants', label: 'Variants', value: String(data.variant.length), hint: `${data.variantValue.length} values`, icon: 'style', open: 'variant' },
    { key: 'bookable', label: 'Bookable items', value: String(stats.bookable), hint: 'role × variant', icon: 'event_available' },
    { key: 'descriptors', label: 'Descriptors', value: String(L.options.roleGenus.length), hint: `${data.descriptorPlan.length} plan lines`, icon: 'label', open: 'descriptorGenus' },
    { key: 'rates', label: 'Rates', value: String(data.rolePrice.length), hint: `${L.options.rateTypes.length} price types`, icon: 'sell', open: 'rolePrice' },
    { key: 'properties', label: 'Property values', value: String(data.propertyValue.length), hint: 'requirements of the roles', icon: 'tune', open: 'propertyValue' },
    { key: 'checks', label: 'Checks', value: issues.length ? String(issues.length) : 'OK', hint: issues.length ? `${errors} errors · ${warnings} warnings` : 'no issues', icon: issues.length ? 'warning' : 'verified' },
  ];

  return (
    <View testID="role-overview" style={{ gap: 12 }}>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <Pressable key={t.key} testID={`role-tile-${t.key}`} disabled={!t.open} onPress={() => t.open && onOpenTable(t.open)}
            style={({ hovered }: any) => [styles.tile, { borderColor: c.border, backgroundColor: hovered && t.open ? c.primary + '0d' : c.surface, flexBasis: wide ? '23%' : '46%' }]}>
            <View style={styles.tileHead}>
              <IconApp name={t.icon} size={16} color={t.key === 'checks' && errors ? c.error : c.primary} />
              <Text style={[styles.tileLabel, { color: c.text }]}>{t.label}</Text>
            </View>
            <Text testID={`role-tile-${t.key}-value`} style={[styles.tileValue, { color: c.text }]}>{t.value}</Text>
            <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{t.hint}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.split, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={{ flex: 1 }}><BarList testID="role-per-type" title="Roles per type" rows={perType} onPress={(k) => onOpenTable('resourceRole', { type: k })} /></View>
        <View style={{ flex: 1 }}><BarList testID="role-per-folder" title="Roles per top folder" rows={perTopFolder} /></View>
      </View>

      <CatalogChecksPanel idPrefix="role" issues={issues} rules={ROLE_RULES} tableTitle={tableTitle} allOkText="All rules of the descriptors plan are met."
        onOpenTable={(table, focus) => onOpenTable(table, {}, focus)} onRebuildVariants={onRebuildVariants}
        onDeleteOrphans={(orphans) => {
          const byTable = new Map<ResourceRoleTableKey, { rowGUID: string; rowOwnerGUID?: string }[]>();
          orphans.forEach((o) => { const row = data[o.table].find((r) => r.rowGUID === o.rowGUID); byTable.set(o.table, [...(byTable.get(o.table) || []), { rowGUID: o.rowGUID, rowOwnerGUID: row?.rowOwnerGUID }]); });
          byTable.forEach((rows, key) => onDeleteRows(key, rows));
        }} />

      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>How the catalog is built</Text>
        {(['resourceRoleType', 'descriptorGenus', 'descriptorDestination', 'descriptorPlan', 'resourceRole', 'propertyValue', 'variant', 'rolePrice'] as ResourceRoleTableKey[]).map((k) => (
          <Pressable key={k} onPress={() => onOpenTable(k)} style={styles.howRow} testID={`role-how-${k}`}>
            <Text style={{ color: c.primary, fontWeight: '700', width: 150 }}>{tableTitle(k)}</Text>
            <Text style={{ color: c.text, opacity: 0.8, flex: 1 }}>{RESOURCE_ROLE_TABLES[k].purpose}</Text>
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
  howRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
});
