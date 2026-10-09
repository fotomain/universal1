// PersonDashboard - one screen for the PEOPLE of "W1 V3 ER DESCRIPTORS PLAN": the person twin of ResourceRoleDashboardCRUD (person type -> person ->
// Properties + Variants, built on the SAME descriptor tables as the products and the roles). ReusableTable approach, no folders.
//   Checks      the rules R1-R12 + P1 (kit8/catalog/person/personValidation.ts) with the table + row to fix
//   9 tables    full CRUD with ReusableTable (all-rows mode): add / duplicate / reorder / sql_for_delete + Undo, in-place editing (owner / parent
//               columns too), search, column sort + filter, export / share, realtime
//   Filters     above every table: master -> detail (the properties of ONE person ...); new rows get the filter values
//   Commands    Generate variants (Seniority x Working language ...), Rebuild variant titles / keys
// Route: /catalog/person/dashboard (?tab=<table key>|checks &focusRowGUID=<rowGUID>)
// SQL: kit8/sql/init/create_person_type_table.sql then create_person_descriptors.sql
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import IconApp from '../../../ui/components/common/IconApp';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import { usePMStore } from '../../../pm/store/store_pm';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import ReusableTableOptionPicker from '../../../ui/components/table/reusable/ReusableTableOptionPicker';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow } from '../../../ui/components/table/reusable/reusableTableTypes';
import { optionLabel } from '../../../ui/components/table/reusable/tableRows';
import { todayISO } from '../../product/productModel';
import { isSideOwnedKey } from '../../product/crud/catalogSides';
import { isSet, variantsToRebuild } from '../../product/crud/productCatalogTools';
import { buildProductLabels } from '../../product/crud/productLabels';
import { createPlannedVariants, rebuildVariants } from '../../product/dashboard/productDashboardActions';
import GenerateVariantsWindow from '../../product/dashboard/GenerateVariantsWindow';
import { PERSON_ROUTES } from '../personModel';
import { personAsProductData } from '../personTypeModel';
import { issuesByTable, PERSON_RULES, PersonTableKey, validatePersonCatalog } from '../personValidation';
import { PERSON_DASHBOARD_GROUPS, PERSON_DASHBOARD_TABLE_ORDER, PERSON_TABLE_KEYS, PERSON_TABLES } from './personDashboardModel';
import { usePersonCatalogData } from './usePersonCatalogData';
import { buildPersonTables, computePersonRowJSON, matchesScopeFilters, newRowFromPersonFilters, ScopeFilterDef } from './personDashboardTables';

type Tab = 'checks' | PersonTableKey;
/** where a table was opened from (a row menu: Properties, Variants ...): the back arrow of the table returns there */
interface Origin { tab: Tab; rowGUID?: string }
const isTableKey = (t: unknown): t is PersonTableKey => typeof t === 'string' && (PERSON_TABLE_KEYS as string[]).includes(t);

export default function PersonDashboard() {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useGlobalSearchParams<Record<string, string>>();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);

  const { data, status, reload, otherOwned } = usePersonCatalogData(true);
  const adapted = useMemo(() => personAsProductData(data), [data]);
  const labels = useMemo(() => buildProductLabels(adapted), [adapted]);
  const issues = useMemo(() => validatePersonCatalog(data), [data]);
  const issuesPerTable = useMemo(() => issuesByTable(issues), [issues]);
  const errors = issues.filter((i) => i.severity === 'error').length;

  // ---- tab + filters (the tab lives in the route: deep links, Back button) ----
  const tab: Tab = params.tab === 'checks' ? 'checks' : isTableKey(params.tab) ? params.tab : 'person';
  const [filters, setFilters] = useState<Partial<Record<PersonTableKey, Record<string, string | null>>>>({});
  const [generateFor, setGenerateFor] = useState<string | null | undefined>(undefined);
  const [pickFilter, setPickFilter] = useState<ScopeFilterDef | null>(null);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const here = useRef({ tab });
  here.current = { tab };

  const go = useCallback((next: Tab, extra: Record<string, string | undefined> = {}) => {
    (router as any).setParams({ tab: next, focusRowGUID: undefined, ...extra });
  }, [router]);
  const openTable = useCallback((key: PersonTableKey, f: Record<string, string> = {}, focusRowGUID?: string, fromRowGUID?: string) => {
    setFilters((all) => ({ ...all, [key]: f }));
    const from = here.current.tab;
    if (from !== key) setOrigin({ tab: from, rowGUID: fromRowGUID });
    go(key, focusRowGUID ? { focusRowGUID } : {});
  }, [go]);

  const tables = useMemo(() => buildPersonTables(data, labels, {
    today: todayISO(),
    openTable: (key, f, fromRowGUID) => openTable(key, f, undefined, fromRowGUID),
    openPerson: (guid) => (router as any).push({ pathname: PERSON_ROUTES.edit, params: { rowGUID: guid } }),
  }), [data, labels, openTable, router]);

  const tableKey = isTableKey(tab) ? tab : null;
  const cfg = tableKey ? tables[tableKey] : null;
  const filterValues = (tableKey && filters[tableKey]) || {};
  const filterSig = JSON.stringify(filterValues);
  // the descriptor tables are shared with the products and the roles: rows of the other sides are not listed here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rowFilter = useMemo(() => {
    const scoped = cfg && cfg.filters.some((f) => isSet(filterValues[f.key]));
    const other = tableKey && isSideOwnedKey(tableKey) ? otherOwned[tableKey] : undefined;
    if (!scoped && !other?.size) return undefined;
    return (row: ReusableTableRow) => !other?.has(row.rowGUID) && (!scoped || matchesScopeFilters(row, cfg!.filters, filterValues));
  }, [tableKey, filterSig, cfg?.filters, otherOwned]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const newRowDefaults = useMemo(() => (tableKey && cfg ? () => newRowFromPersonFilters(cfg.filters, filterValues, PERSON_TABLES[tableKey].catalogOwner) : undefined), [tableKey, filterSig, cfg?.filters]);
  const defaultRowJSON = useMemo(() => (tableKey ? PERSON_TABLES[tableKey].emptyRowJSON : undefined), [tableKey]);
  const setFilter = (key: string, value: string | null) => tableKey && setFilters((all) => ({ ...all, [tableKey]: { ...(all[tableKey] || {}), [key]: value } }));

  const readError = Object.values(status).find((s) => s.error)?.error;
  const allLoaded = Object.values(status).every((s) => s.loaded);
  const empty = allLoaded && data.person.length === 0 && data.personType.length === 0;

  const doRebuild = () => {
    const n = rebuildVariants(dispatch, adapted);
    dispatch(showSnackbar({ message: n ? `${n} variant${n === 1 ? '' : 's'} rebuilt` : 'All variant titles and keys are up to date' }));
  };
  const toRebuild = useMemo(() => variantsToRebuild(adapted).length, [adapted]);

  // ---- navigation ----
  const navItem = (key: Tab, label: string, icon: string, n?: number, bad?: number) => {
    const active = tab === key;
    return (
      <Pressable key={key} testID={`person-nav-${key}`} onPress={() => { setOrigin(null); go(key); }} accessibilityRole="tab" aria-selected={active}
        style={({ hovered }: any) => [wide ? styles.navRow : styles.navChip, {
          backgroundColor: active ? c.primary + '1c' : hovered ? c.primary + '0b' : wide ? 'transparent' : c.surface,
          borderColor: active ? c.primary : c.border, borderLeftColor: active ? c.primary : 'transparent',
        }]}>
        <IconApp name={icon} size={16} color={active ? c.primary : c.text} />
        <Text numberOfLines={1} style={{ flex: wide ? 1 : undefined, color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{label}</Text>
        {n !== undefined && <Text style={{ color: c.text, opacity: 0.55, fontSize: 12 }}>{n}</Text>}
        {!!bad && <View testID={`person-nav-${key}-issues`} style={[styles.badge, { backgroundColor: c.error }]}><Text style={styles.badgeText}>{bad}</Text></View>}
      </Pressable>
    );
  };
  const nav = (
    <>
      {navItem('checks', 'Checks', 'fact_check', issues.length, errors || undefined)}
      {PERSON_DASHBOARD_GROUPS.map((g) => (
        <React.Fragment key={g}>
          {wide && <Text style={[styles.navGroup, { color: c.text }]}>{g}</Text>}
          {PERSON_DASHBOARD_TABLE_ORDER.filter((k) => tables[k].group === g).map((k) => navItem(k, tables[k].title, tables[k].icon, (data as any)[k]?.length, (issuesPerTable[k] || []).filter((i) => i.severity === 'error').length || undefined))}
        </React.Fragment>
      ))}
    </>
  );

  const tabTitle = (t: Tab) => (t === 'checks' ? 'Checks' : tables[t].title);
  const goBack = () => {
    if (!origin) return;
    const o = origin;
    setOrigin(null);
    go(o.tab, { focusRowGUID: o.rowGUID });
  };

  // ---- Checks ----
  const checksView = (
    <View style={{ gap: 8 }} testID="person-checks">
      <Text style={[styles.h2, { color: c.text }]}>Checks</Text>
      <Text style={{ color: c.text, opacity: 0.65, fontSize: 13 }}>
        {issues.length === 0 ? 'No problems found.' : `${issues.length} finding${issues.length === 1 ? '' : 's'}: ${errors} error${errors === 1 ? '' : 's'}.`} Press a line to open its table.
      </Text>
      {issues.map((i, n) => (
        <Pressable key={`${i.rule}-${i.rowGUID}-${n}`} testID={`person-issue-${n}`} onPress={() => openTable(i.table, {}, i.rowGUID)}
          style={[styles.issueBar, { borderColor: (i.severity === 'error' ? c.error : '#f59e0b') + '66', backgroundColor: (i.severity === 'error' ? c.error : '#f59e0b') + '0f' }]}>
          <IconApp name={i.severity === 'error' ? 'error' : 'warning'} size={16} color={i.severity === 'error' ? c.error : '#f59e0b'} />
          <Text style={{ color: c.text, flex: 1 }}><Text style={{ fontWeight: '700' }}>{i.rule}</Text> · {i.message}</Text>
          <Text style={{ color: c.text, opacity: 0.55, fontSize: 12 }} numberOfLines={1}>{PERSON_RULES[i.rule] ? '' : ''}{tables[i.table]?.title}</Text>
        </Pressable>
      ))}
    </View>
  );

  // ---- one table ----
  const tableView = cfg && tableKey && (
    <View style={{ gap: 10 }}>
      <View style={styles.tableHead}>
        {origin && origin.tab !== tableKey && (
          <PMIconButton tipScope="app" testID="person-table-back" icon="arrow_back" title={`Back to ${tabTitle(origin.tab)}${origin.rowGUID ? ' (the row you came from)' : ''}`} color={c.primary} onPress={goBack} />
        )}
        <IconApp name={cfg.icon} size={22} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID="person-table-title" style={[styles.h2, { color: c.text }]}>{cfg.title}</Text>
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 13 }}>{PERSON_TABLES[tableKey].purpose}</Text>
        </View>
      </View>
      {(issuesPerTable[tableKey] || []).length > 0 && (
        <Pressable testID="person-table-issues" onPress={() => go('checks')} style={[styles.issueBar, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="warning" size={16} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>{(issuesPerTable[tableKey] || []).length} check{(issuesPerTable[tableKey] || []).length === 1 ? '' : 's'} need attention in this table: {(issuesPerTable[tableKey] || [])[0].message}</Text>
          <Text style={{ color: c.primary, fontWeight: '700' }}>Checks</Text>
        </Pressable>
      )}
      {cfg.filters.length > 0 && (
        <View style={styles.filterBar} testID="person-filters">
          {cfg.filters.map((f) => {
            const v = filterValues[f.key];
            const on = isSet(v);
            return (
              <View key={f.key} style={[styles.filterChip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary + '14' : c.surface }]}>
                <Pressable testID={`person-filter-${f.key}`} onPress={() => setPickFilter(f)} style={styles.filterPress}>
                  <IconApp name="filter_alt" size={14} color={on ? c.primary : c.text} />
                  <Text numberOfLines={1} style={{ color: on ? c.primary : c.text, fontSize: 13, maxWidth: 260 }}>{f.label}: {on ? optionLabel(f.options, v) : 'all'}</Text>
                </Pressable>
                {on && <Pressable testID={`person-filter-${f.key}-clear`} onPress={() => setFilter(f.key, null)} hitSlop={6}><IconApp name="close" size={14} color={c.primary} /></Pressable>}
              </View>
            );
          })}
          {cfg.filters.some((f) => isSet(filterValues[f.key])) && <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>New rows get the filter values.</Text>}
        </View>
      )}
      <ReusableTable
        key={tableKey}
        testID={`person-table-${tableKey}`}
        entityName={PERSON_TABLES[tableKey].entity}
        crudListTitle={cfg.title}
        itemLabel={PERSON_TABLES[tableKey].itemLabel}
        listOwnerGUID={REUSABLE_TABLE_ALL}
        listParentGUID={REUSABLE_TABLE_ALL}
        visualColumns={cfg.columns}
        defaultRowJSON={defaultRowJSON}
        rowFilter={rowFilter}
        newRowDefaults={newRowDefaults}
        computeRowJSON={tableKey === 'person' ? computePersonRowJSON : undefined}
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
            {tableKey === 'variant' && <PMIconButton tipScope="app" testID="person-generate-variants" icon="library_add" title="Generate variants" color={c.primary} onPress={() => setGenerateFor(isSet(filterValues.owner) ? filterValues.owner : null)} />}
            <PMIconButton tipScope="app" testID="person-rebuild-variants" icon="autorenew" title={`Rebuild variant titles and keys from their values (${toRebuild})`} color={c.text} badge={toRebuild || undefined} onPress={doRebuild} />
          </View>
        ) : undefined}
      />
    </View>
  );

  return (
    <View testID="person-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="badge" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Persons</Text>
          <Text numberOfLines={1} style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>Person type → person → properties + variants · {data.person.length} persons · {data.personType.length} types · {data.variant.length} variants · {data.propertyValue.length} property values</Text>
        </View>
        <PMIconButton tipScope="app" testID="person-generate-variants-header" icon="library_add" title="Generate variants" color={c.primary} onPress={() => setGenerateFor(null)} />
        <PMIconButton tipScope="app" testID="person-reload" icon="refresh" title="Read all person tables again" color={c.text} onPress={reload} />
      </View>
      {(readError || empty) && (
        <View testID="person-setup" style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            {readError ? `The person tables could not be read (${readError}). ` : 'The person types are empty. '}
            Run kit8/sql/init/create_person_type_table.sql and then kit8/sql/init/create_person_descriptors.sql in the Supabase SQL editor (after create_product_tables.sql and create_resource_role_tables.sql) and sign in.
          </Text>
        </View>
      )}
      <View style={[styles.body, { flexDirection: wide ? 'row' : 'column' }]}>
        {wide ? (
          <ScrollView style={[styles.side, { borderRightColor: c.border, backgroundColor: c.surface }]} contentContainerStyle={{ paddingVertical: 8 }} testID="person-nav">{nav}</ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips} testID="person-nav">{nav}</ScrollView>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { padding: wide ? 16 : 10 }]} keyboardShouldPersistTaps="handled">
          {tab === 'checks' ? checksView : tableView}
        </ScrollView>
      </View>
      {pickFilter && (
        <ReusableTableOptionPicker testID="person-filter-picker" title={pickFilter.label} options={pickFilter.options} multi={false}
          selected={isSet(filterValues[pickFilter.key]) ? [filterValues[pickFilter.key] as string] : []}
          onClose={() => setPickFilter(null)} onPick={(v) => { setFilter(pickFilter.key, v[0] ?? null); setPickFilter(null); }} />
      )}
      {generateFor !== undefined && (
        <GenerateVariantsWindow data={adapted} labels={labels} initialOwnerGUID={generateFor} onClose={() => setGenerateFor(undefined)}
          onCreate={(owner, planned) => {
            const n = createPlannedVariants(dispatch, adapted, owner, planned);
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
