// ResourceRoleDashboard - one screen for the resource roles of "W1 V3 ER DESCRIPTORS PLAN": the work-resource twin of ProductDashboard
// (role type -> role -> Properties + Variants + hourly Rates, built on the SAME descriptor tables as the products).
//   Overview        headline numbers, roles per type / folder, Checks (rules R1-R14) with one-click fixes
//   Roles & folders the Roles table with the role FOLDERS tree beside it (FolderTreeReusable + ReusableTable): pick a folder = its
//                   roles, drag roles onto a folder, create / rename / move / delete folders; right-click a role -> Edit = the role card
//                   (Main, Rates, Variants, Properties)
//   15 tables       full CRUD with ReusableTable (all-rows mode): add / duplicate / reorder / delete + Undo, in-place editing (owner /
//                   parent columns too), search, column sort + filter, export / share, realtime
//   Filters         above every table: master -> detail (the values of ONE role ...); new rows get the filter values
//   Commands        Generate variants (cartesian product of descriptor values), Rebuild variant titles / keys, Delete orphans
// Route: /catalog/resourcerole/dashboard (?tab=<table key>|overview|rolesTree &focusRowGUID=<rowGUID>)
// SQL: kit8/sql/init/create_resource_role_tables.sql (after create_product_tables.sql)
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { showSnackbar } from '../../../redux/uxuiSlice';
import IconApp from '../../../ui/components/common/IconApp';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../../pm/store/store_pm';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import ReusableTableOptionPicker from '../../../ui/components/table/reusable/ReusableTableOptionPicker';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow } from '../../../ui/components/table/reusable/reusableTableTypes';
import { optionLabel } from '../../../ui/components/table/reusable/tableRows';
import { TREE_ALL_ID } from '../../../ui/components/tree/folderTreeModel';
import { todayISO } from '../../product/productModel';
import { isSideOwnedKey } from '../../product/crud/catalogSides';
import { variantsToRebuild } from '../../product/crud/productCatalogTools';
import GenerateVariantsWindow from '../../product/dashboard/GenerateVariantsWindow';
import { RESOURCE_ROLE_TABLES, RESOURCE_ROLE_TABLE_KEYS, ResourceRoleTableKey } from '../resourceRoleModel';
import { isSet, roleAsProductData } from '../crud/resourceRoleCatalogTools';
import { buildResourceRoleLabels } from '../crud/resourceRoleLabels';
import { issuesByTable, validateResourceRoleCatalog } from '../crud/resourceRoleValidation';
import { useResourceRoleCatalogData } from './useResourceRoleCatalogData';
import {
  buildResourceRoleTables, matchesScopeFilters, newRowFromRoleFilters, ROLE_DASHBOARD_GROUPS, ROLE_DASHBOARD_TABLE_ORDER, ScopeFilterDef,
} from './resourceRoleDashboardTables';
import ResourceRoleDashboardOverview from './ResourceRoleDashboardOverview';
import ResourceRolesWithTree from './ResourceRolesWithTree';
import { createPlannedRoleVariants, deleteRoleRows, rebuildRoleVariants } from './resourceRoleDashboardActions';

type Tab = 'overview' | 'rolesTree' | ResourceRoleTableKey;
/** where a table was opened from (a row menu: Rates, Property values ...): the back arrow of the table returns there */
interface Origin { tab: Tab; params: Record<string, string | undefined>; rowGUID?: string }
const isTableKey = (t: unknown): t is ResourceRoleTableKey => typeof t === 'string' && RESOURCE_ROLE_TABLE_KEYS.includes(t as ResourceRoleTableKey);

export default function ResourceRoleDashboard() {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useGlobalSearchParams<Record<string, string>>();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);

  const { data, status, reload, productOwned } = useResourceRoleCatalogData(true);
  const adapted = useMemo(() => roleAsProductData(data), [data]);
  const labels = useMemo(() => buildResourceRoleLabels(data, adapted), [data, adapted]);
  const issues = useMemo(() => validateResourceRoleCatalog(data), [data]);
  const issuesPerTable = useMemo(() => issuesByTable(issues), [issues]);

  // ---- tab + filters (the tab lives in the route: deep links, Back button) ----
  const tab: Tab = params.tab === 'rolesTree' ? 'rolesTree' : isTableKey(params.tab) ? params.tab : 'overview';
  const [filters, setFilters] = useState<Partial<Record<ResourceRoleTableKey, Record<string, string | null>>>>({});
  const [generateFor, setGenerateFor] = useState<string | null | undefined>(undefined);
  const [pickFilter, setPickFilter] = useState<ScopeFilterDef | null>(null);
  const [origin, setOrigin] = useState<Origin | null>(null);
  /** the folder picked in "Roles & folders" (kept while another table is open) */
  const [treeFolder, setTreeFolder] = useState<string>(TREE_ALL_ID);
  const here = useRef({ tab });
  here.current = { tab };

  const go = useCallback((next: Tab, extra: Record<string, string | undefined> = {}) => {
    (router as any).setParams({ tab: next, focusRowGUID: undefined, ...extra });
  }, [router]);
  const openTable = useCallback((key: ResourceRoleTableKey, f: Record<string, string> = {}, focusRowGUID?: string, fromRowGUID?: string) => {
    setFilters((all) => ({ ...all, [key]: f }));
    const from = here.current.tab;
    if (from !== key) setOrigin({ tab: from, params: {}, rowGUID: fromRowGUID });
    go(key, focusRowGUID ? { focusRowGUID } : {});
  }, [go]);

  const tables = useMemo(() => buildResourceRoleTables(data, labels, {
    today: todayISO(),
    openTable: (key, f, fromRowGUID) => openTable(key, f, undefined, fromRowGUID),
  }), [data, labels, openTable]);

  const tableKey = isTableKey(tab) ? tab : null;
  const cfg = tableKey ? tables[tableKey] : null;
  const filterValues = (tableKey && filters[tableKey]) || {};
  const filterSig = JSON.stringify(filterValues);
  // the descriptor tables are shared with the product catalog: rows of the product side (their owner is a product type / product) are not listed here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rowFilter = useMemo(() => {
    const scoped = cfg && cfg.filters.some((f) => isSet(filterValues[f.key]));
    const other = tableKey && isSideOwnedKey(tableKey) ? productOwned[tableKey] : undefined;
    if (!scoped && !other?.size) return undefined;
    return (row: ReusableTableRow) => !other?.has(row.rowGUID) && (!scoped || matchesScopeFilters(row, cfg!.filters, filterValues));
  }, [tableKey, filterSig, cfg?.filters, productOwned]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const newRowDefaults = useMemo(() => (tableKey && cfg ? () => newRowFromRoleFilters(cfg.filters, filterValues, RESOURCE_ROLE_TABLES[tableKey].catalogOwner) : undefined), [tableKey, filterSig, cfg?.filters]);
  const defaultRowJSON = useMemo(() => (tableKey ? RESOURCE_ROLE_TABLES[tableKey].emptyRowJSON : undefined), [tableKey]);
  const setFilter = (key: string, value: string | null) => tableKey && setFilters((all) => ({ ...all, [tableKey]: { ...(all[tableKey] || {}), [key]: value } }));

  const readError = Object.values(status).find((s) => s.error)?.error;
  const allLoaded = Object.values(status).every((s) => s.loaded);
  const empty = allLoaded && data.resourceRole.length === 0 && data.resourceRoleType.length === 0;

  const doRebuild = (only?: string[]) => {
    const n = rebuildRoleVariants(dispatch, data, only);
    dispatch(showSnackbar({ message: n ? `${n} variant${n === 1 ? '' : 's'} rebuilt` : 'All variant titles and keys are up to date' }));
  };
  const doDelete = (key: ResourceRoleTableKey, rows: { rowGUID: string; rowOwnerGUID?: string }[]) => {
    const n = deleteRoleRows(dispatch, key, rows);
    if (n > 1) dispatch(showSnackbar({ message: `${n} rows deleted from ${tables[key].title}` }));
  };
  const toRebuild = useMemo(() => variantsToRebuild(adapted).length, [adapted]);

  // ---- navigation ----
  const navItem = (key: Tab, label: string, icon: string, n?: number, bad?: number) => {
    const active = tab === key;
    return (
      <Pressable key={key} testID={`role-nav-${key}`} onPress={() => { setOrigin(null); go(key); }} accessibilityRole="tab" aria-selected={active}
        style={({ hovered }: any) => [wide ? styles.navRow : styles.navChip, {
          backgroundColor: active ? c.primary + '1c' : hovered ? c.primary + '0b' : wide ? 'transparent' : c.surface,
          borderColor: active ? c.primary : c.border, borderLeftColor: active ? c.primary : 'transparent',
        }]}>
        <IconApp name={icon} size={16} color={active ? c.primary : c.text} />
        <Text numberOfLines={1} style={{ flex: wide ? 1 : undefined, color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{label}</Text>
        {n !== undefined && <Text style={{ color: c.text, opacity: 0.55, fontSize: 12 }}>{n}</Text>}
        {!!bad && <View testID={`role-nav-${key}-issues`} style={[styles.badge, { backgroundColor: c.error }]}><Text style={styles.badgeText}>{bad}</Text></View>}
      </Pressable>
    );
  };
  const nav = (
    <>
      {navItem('overview', 'Overview', 'dashboard', undefined, issues.filter((i) => i.severity === 'error').length || undefined)}
      {navItem('rolesTree', 'Roles & folders', 'account_tree', data.resourceRole.length)}
      {ROLE_DASHBOARD_GROUPS.map((g) => (
        <React.Fragment key={g}>
          {wide && <Text style={[styles.navGroup, { color: c.text }]}>{g}</Text>}
          {ROLE_DASHBOARD_TABLE_ORDER.filter((k) => tables[k].group === g).map((k) => navItem(k, tables[k].title, tables[k].icon, data[k].length, (issuesPerTable[k] || []).filter((i) => i.severity === 'error').length || undefined))}
        </React.Fragment>
      ))}
    </>
  );

  // ---- back arrow: the table was opened from a row menu of another tab ----
  const tabTitle = (t: Tab) => (t === 'overview' ? 'Overview' : t === 'rolesTree' ? 'Roles & folders' : tables[t].title);
  const goBack = () => {
    if (!origin) return;
    setOrigin(null);
    go(origin.tab, { ...origin.params, focusRowGUID: origin.rowGUID });
  };

  // ---- one table ----
  const tableView = cfg && tableKey && (
    <View style={{ gap: 10 }}>
      <View style={styles.tableHead}>
        {origin && origin.tab !== tableKey && (
          <PMIconButton tipScope="app" testID="role-table-back" icon="arrow_back" title={`Back to ${tabTitle(origin.tab)}${origin.rowGUID ? ' (the row you came from)' : ''}`} color={c.primary} onPress={goBack} />
        )}
        <IconApp name={cfg.icon} size={22} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID="role-table-title" style={[styles.h2, { color: c.text }]}>{cfg.title}</Text>
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 13 }}>{RESOURCE_ROLE_TABLES[tableKey].purpose}</Text>
        </View>
      </View>
      {(issuesPerTable[tableKey] || []).length > 0 && (
        <Pressable testID="role-table-issues" onPress={() => go('overview')} style={[styles.issueBar, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="warning" size={16} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>{(issuesPerTable[tableKey] || []).length} check{(issuesPerTable[tableKey] || []).length === 1 ? '' : 's'} need attention in this table: {(issuesPerTable[tableKey] || [])[0].message}</Text>
          <Text style={{ color: c.primary, fontWeight: '700' }}>Checks</Text>
        </Pressable>
      )}
      {cfg.filters.length > 0 && (
        <View style={styles.filterBar} testID="role-filters">
          {cfg.filters.map((f) => {
            const v = filterValues[f.key];
            const on = isSet(v);
            return (
              <View key={f.key} style={[styles.filterChip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary + '14' : c.surface }]}>
                <Pressable testID={`role-filter-${f.key}`} onPress={() => setPickFilter(f)} style={styles.filterPress}>
                  <IconApp name="filter_alt" size={14} color={on ? c.primary : c.text} />
                  <Text numberOfLines={1} style={{ color: on ? c.primary : c.text, fontSize: 13, maxWidth: 260 }}>{f.label}: {on ? optionLabel(f.options, v) : 'all'}</Text>
                </Pressable>
                {on && <Pressable testID={`role-filter-${f.key}-clear`} onPress={() => setFilter(f.key, null)} hitSlop={6}><IconApp name="close" size={14} color={c.primary} /></Pressable>}
              </View>
            );
          })}
          {cfg.filters.some((f) => isSet(filterValues[f.key])) && <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>New rows get the filter values.</Text>}
        </View>
      )}
      <ReusableTable
        key={tableKey}
        testID={`role-table-${tableKey}`}
        entityName={RESOURCE_ROLE_TABLES[tableKey].entity}
        crudListTitle={cfg.title}
        itemLabel={RESOURCE_ROLE_TABLES[tableKey].itemLabel}
        listOwnerGUID={REUSABLE_TABLE_ALL}
        listParentGUID={REUSABLE_TABLE_ALL}
        visualColumns={cfg.columns}
        defaultRowJSON={defaultRowJSON}
        rowFilter={rowFilter}
        newRowDefaults={newRowDefaults}
        crudPanelEnabled={cfg.crud !== false}
        selectionEnabled={cfg.crud !== false}
        contextMenuEnabled={cfg.crud !== false}
        extraMenuItems={cfg.extraMenuItems}
        selectRowCheckBoxForm={selectRowCheckBoxForm}
        dragAndDropColumns
        resizeColumnWidth
        realtime
        emptyText={cfg.filters.some((f) => isSet(filterValues[f.key])) ? 'No rows for this filter. Press "+" to add one.' : undefined}
        uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
        toolbarExtra={tableKey === 'variant' || tableKey === 'variantValue' ? (
          <View style={styles.extra}>
            {tableKey === 'variant' && <PMIconButton tipScope="app" testID="role-generate-variants" icon="library_add" title="Generate variants" color={c.primary} onPress={() => setGenerateFor(isSet(filterValues.owner) ? filterValues.owner : null)} />}
            <PMIconButton tipScope="app" testID="role-rebuild-variants" icon="autorenew" title={`Rebuild variant titles and keys from their values (${toRebuild})`} color={c.text} badge={toRebuild || undefined} onPress={() => doRebuild()} />
          </View>
        ) : undefined}
      />
    </View>
  );

  return (
    <View testID="role-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="engineering" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Resource roles</Text>
          <Text numberOfLines={1} style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>Role type → role → properties + variants + rates · {data.resourceRole.length} roles · {data.variant.length} variants · {data.rolePrice.length} rates</Text>
        </View>
        <PMIconButton tipScope="app" testID="role-generate-variants-header" icon="library_add" title="Generate variants" color={c.primary} onPress={() => setGenerateFor(null)} />
        <PMIconButton tipScope="app" testID="role-reload" icon="refresh" title="Read all role tables again" color={c.text} onPress={reload} />
      </View>
      {(readError || empty) && (
        <View testID="role-setup" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {readError ? `The role tables could not be read (${readError}). ` : 'The role tables are empty. '}
            Run kit8/sql/init/create_product_tables.sql and then kit8/sql/init/create_resource_role_tables.sql in the Supabase SQL editor (tables, rules, realtime + demo data with 8 roles) and sign in.
          </Text>
        </View>
      )}
      <View style={[styles.body, { flexDirection: wide ? 'row' : 'column' }]}>
        {wide ? (
          <ScrollView style={[styles.side, { borderRightColor: c.border, backgroundColor: c.surface }]} contentContainerStyle={{ paddingVertical: 8 }} testID="role-nav">{nav}</ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips} testID="role-nav">{nav}</ScrollView>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { padding: wide ? 16 : 10 }, tab === 'rolesTree' ? { paddingBottom: 12 } : null]} keyboardShouldPersistTaps="handled">
          {tab === 'overview' && (
            <ResourceRoleDashboardOverview data={data} labels={labels} issues={issues} wide={wide} tableTitle={(k) => tables[k].title}
              onOpenTable={(k, f, focus) => openTable(k, f || {}, focus)} onRebuildVariants={doRebuild} onDeleteRows={doDelete} />
          )}
          {tab === 'rolesTree' && (
            <ResourceRolesWithTree data={data} cfg={tables.resourceRole} tables={tables} onReload={reload} selectRowCheckBoxForm={selectRowCheckBoxForm}
              selectedFolderId={treeFolder} onSelectedFolderChange={setTreeFolder} />
          )}
          {tableView}
        </ScrollView>
      </View>
      {pickFilter && (
        <ReusableTableOptionPicker testID="role-filter-picker" title={pickFilter.label} options={pickFilter.options} multi={false}
          selected={isSet(filterValues[pickFilter.key]) ? [filterValues[pickFilter.key] as string] : []}
          onClose={() => setPickFilter(null)} onPick={(v) => { setFilter(pickFilter.key, v[0] ?? null); setPickFilter(null); }} />
      )}
      {generateFor !== undefined && (
        <GenerateVariantsWindow data={adapted} labels={labels} initialOwnerGUID={generateFor} onClose={() => setGenerateFor(undefined)}
          onCreate={(owner, planned) => {
            const n = createPlannedRoleVariants(dispatch, data, owner, planned);
            setGenerateFor(undefined);
            dispatch(showSnackbar({ message: `${n} variant${n === 1 ? '' : 's'} created for ${labels.ownerLabel(owner)}` }));
            openTable('variant', { owner });
          }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  h2: { fontSize: 18, fontWeight: '800' },
  setup: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  body: { flex: 1, minHeight: 0 },
  side: { width: 230, flexGrow: 0, borderRightWidth: 1 },
  navGroup: { fontSize: 11, fontWeight: '800', opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 7, borderLeftWidth: 3, marginRight: 8, borderTopRightRadius: 8, borderBottomRightRadius: 8, borderWidth: 0 },
  navChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 16 },
  chips: { gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  content: { gap: 12, paddingBottom: 40, ...Platform.select({ web: { maxWidth: 1600 } as any, default: {} }) },
  tableHead: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  issueBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  filterBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  filterPress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  extra: { flexDirection: 'row', alignItems: 'center' },
});
