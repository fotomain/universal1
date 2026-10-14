// PMFactInputDocumentList - the LIST of fact input documents (the hamburger menu → Budgets → … → Actuals; route /pm/fact/list).
//   columns   Document (number · status · input mode · the task and the project) · Period (first - last day of its lines) · Lines · sumForBudget · sumForContract · sumForAccounting
//             (the totals of the DOCUMENT) · Author · Created.     The footer adds up the listed documents.
//   fast filters (ONE row above the table, scrolls sideways when narrow; each has a clear icon inside its field)  factTimelinePeriod (DateInputApp from - to) · factProjectFilter · factBusinessUnitFilter · factRoleFilter · factResourceFilter · authorFilter
//             - applied by the database (task_fact_document_list): a document is listed when ONE of its lines satisfies all the line filters.
//   a click on a row opens the form of the document (PMFactInputDocumentForm).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ButtonApp from '../../ui/components/common/ButtonApp';
import IconApp from '../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import TextInputApp from '../../ui/components/common/TextInputApp';
import DateInputApp from '../../ui/components/common/date_input/DateInputApp';
import { rowTitle } from '../../catalog/product/crud/productCatalogTools';
import { businessUnitPath } from '../../catalog/business_unit/businessUnitModel';
import { useTaskLineCatalogs } from '../view/task/finances/useTaskLineCatalogs';
import { personFullName, resourceTitleOfRow } from '../view/task/finances/taskLineResource';
import { pmT } from '../i18n/pmT';
import {
  EMPTY_FACT_LIST_FILTER, FactListFilter, FactListRow, dayOfPeriod, factListDateErrors, factListFilterActive,
} from './factInputModel';
import { useFactDocumentList, useFactProjects } from './useFactDocumentList';
import { useOpenFactInput } from './useOpenFactInput';

export const FACT_LIST_FILTER_DEBOUNCE_MS = 150;
const PAGE = 200;
const W = { doc: 260, period: 190, lines: 70, sum: 130, author: 160, created: 110 };
const ROW_H = 46;
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PMFactInputDocumentListProps {
  testID?: string;
  /** the documents of one project only (the project filter is fixed) */
  projectGUID?: string | null;
}

/** the select of a filter: the label is its placeholder (like the inputs next to it) and a clear (x) icon INSIDE the field empties it (the picker is searchable above 10 items) */
function FilterSelect({ testID, label, items, value, onSelect, width = 190 }: { testID: string; label: string; items: { value: string; label: string; group?: string }[]; value: string; onSelect: (v: string) => void; width?: number }) {
  return (
    <View style={{ width }}>
      <SelectItemFromListApp testID={testID} items={items} value={value} onSelect={onSelect} placeholder={label} clearable searchPlaceholder={label} />
    </View>
  );
}

export default function PMFactInputDocumentList({ testID = 'fact-list', projectGUID }: PMFactInputDocumentListProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useTaskLineCatalogs(true);
  const projects = useFactProjects();
  const openFactInput = useOpenFactInput();

  // the typed filter (draft) is applied after a pause
  const [draft, setDraft] = useState<FactListFilter>({ ...EMPTY_FACT_LIST_FILTER, projectGUID: projectGUID || '' });
  const [applied, setApplied] = useState<FactListFilter>(draft);
  const [limit, setLimit] = useState(PAGE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (patch: Partial<FactListFilter>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setApplied(next); setLimit(PAGE); }, FACT_LIST_FILTER_DEBOUNCE_MS);
  };
  const errors = factListDateErrors(draft);

  const list = useFactDocumentList(applied, limit);
  const { rows, totals, totalCount } = { rows: list.answer.rows, totals: list.answer.totals, totalCount: list.answer.totalCount };

  const projectItems = useMemo(() => projects.map((p) => ({ value: p.guid, label: p.name })), [projects]);
  const unitItems = useMemo(() => data.businessUnit.map((u) => ({ value: u.rowGUID, label: businessUnitPath(data.businessUnit, u.rowGUID) || rowTitle(u) })), [data.businessUnit]);
  const roleItems = useMemo(() => data.resourceRole.map((r) => ({ value: r.rowGUID, label: rowTitle(r) })), [data.resourceRole]);
  const resourceItems = useMemo(() => [
    ...data.person.map((r) => ({ value: r.rowGUID, label: personFullName(r), group: pmT('Persons') })),
    ...data.equipment.map((r) => ({ value: r.rowGUID, label: resourceTitleOfRow(r), group: pmT('Equipment') })),
    ...data.product.map((r) => ({ value: r.rowGUID, label: rowTitle(r), group: pmT('Products') })),
  ], [data.person, data.equipment, data.product]);

  const width = W.doc + W.period + W.lines + W.sum * 3 + W.author + W.created;
  const renderItem = ({ item }: { item: FactListRow }) => (
    <Pressable testID={`${testID}-row-${item.documentGUID}`} accessibilityRole="button" onPress={() => openFactInput({ taskGUID: item.taskGUID, projectGUID: item.projectGUID, documentGUID: item.documentGUID })}
      style={[styles.row, { height: ROW_H, borderBottomColor: c.border }]}>
      <View style={{ width: W.doc, paddingHorizontal: 8 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>
          {item.documentNumber} · <Text style={{ color: item.documentStatus === 'posted' ? c.primary : c.text, opacity: item.documentStatus === 'posted' ? 1 : 0.7 }}>{pmT(item.documentStatus === 'posted' ? 'Posted' : 'Draft')}</Text>
          {' · '}{pmT(item.strongInput ? 'Strong' : 'Free')}
        </Text>
        <Text numberOfLines={1} style={{ color: c.text, opacity: 0.65, fontSize: 11 }}>{item.taskName}{item.projectName ? ` · ${item.projectName}` : ''}</Text>
      </View>
      <Text testID={`${testID}-period-${item.documentGUID}`} numberOfLines={1} style={[styles.cell, { width: W.period, color: c.text }]}>{item.firstDay ? `${dayOfPeriod(item.firstDay)} – ${dayOfPeriod(item.lastDay)}` : ''}</Text>
      <Text style={[styles.cell, styles.num, { width: W.lines, color: c.text }]}>{item.lineCount}</Text>
      <Text testID={`${testID}-budget-${item.documentGUID}`} style={[styles.cell, styles.num, { width: W.sum, color: c.text }]}>{money(item.sumForBudget)}</Text>
      <Text testID={`${testID}-contract-${item.documentGUID}`} style={[styles.cell, styles.num, { width: W.sum, color: c.text }]}>{money(item.sumForContract)}</Text>
      <Text testID={`${testID}-accounting-${item.documentGUID}`} style={[styles.cell, styles.num, { width: W.sum, color: c.text }]}>{money(item.sumForAccounting)}</Text>
      <Text numberOfLines={1} style={[styles.cell, { width: W.author, color: c.text }]}>{item.authorName}</Text>
      <Text numberOfLines={1} style={[styles.cell, { width: W.created, color: c.text, opacity: 0.7 }]}>{dayOfPeriod(item.createdAt)}</Text>
    </Pressable>
  );

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="fact_check" size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Actuals')}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('Fact input documents')}</Text>
        <View style={{ flex: 1 }} />
        {factListFilterActive(draft) && (
          <ButtonApp testID={`${testID}-clear`} title={pmT('Clear filters')} icon="filter_alt_off" variant="text" size="small" onPress={() => { const empty = { ...EMPTY_FACT_LIST_FILTER, projectGUID: projectGUID || '' }; setDraft(empty); setApplied(empty); }} />
        )}
        <ButtonApp testID={`${testID}-refresh`} title={pmT('Refresh')} icon="refresh" variant="text" size="small" onPress={list.refetch} />
      </View>

      {/* the fast filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filters} testID={`${testID}-filters`}>
        <View style={{ width: 150 }}>
          <DateInputApp testID={`${testID}-factTimelinePeriod-from`} label={pmT('Period from')} value={draft.fromDay} onChangeText={(t) => change({ fromDay: t })} compact error={errors.fromDay} />
        </View>
        <View style={{ width: 150 }}>
          <DateInputApp testID={`${testID}-factTimelinePeriod-to`} label={pmT('Period to')} value={draft.toDay} onChangeText={(t) => change({ toDay: t })} compact error={errors.toDay} />
        </View>
        {!projectGUID && <FilterSelect testID={`${testID}-factProjectFilter`} label={pmT('Project')} items={projectItems} value={draft.projectGUID} onSelect={(v) => change({ projectGUID: v })} />}
        <FilterSelect testID={`${testID}-factBusinessUnitFilter`} label={pmT('Business unit')} items={unitItems} value={draft.businessUnitGUID} onSelect={(v) => change({ businessUnitGUID: v })} width={220} />
        <FilterSelect testID={`${testID}-factRoleFilter`} label={pmT('Role')} items={roleItems} value={draft.roleGUID} onSelect={(v) => change({ roleGUID: v })} />
        <FilterSelect testID={`${testID}-factResourceFilter`} label={pmT('Resource')} items={resourceItems} value={draft.resourceGUID} onSelect={(v) => change({ resourceGUID: v })} />
        <View style={{ width: 170 }}>
          <TextInputApp testID={`${testID}-authorFilter`} label={pmT('Author')} value={draft.author} onChangeText={(t) => change({ author: t })} compact leftIcon="search" />
        </View>
      </ScrollView>

      {!!list.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{list.error}</Text>}

      <ScrollView horizontal contentContainerStyle={{ minWidth: width }} style={{ flex: 1 }}>
        <View style={{ width, flex: 1 }}>
          <View style={[styles.row, { height: 34, backgroundColor: c.surface, borderBottomColor: c.border, borderBottomWidth: 1 }]}>
            <Text style={[styles.head, { width: W.doc, color: c.text }]}>{pmT('Document')}</Text>
            <Text style={[styles.head, { width: W.period, color: c.text }]}>{pmT('Period')}</Text>
            <Text style={[styles.head, styles.num, { width: W.lines, color: c.text }]}>{pmT('Lines')}</Text>
            <Text style={[styles.head, styles.num, { width: W.sum, color: c.text }]}>{pmT('sumForBudget')}</Text>
            <Text style={[styles.head, styles.num, { width: W.sum, color: c.text }]}>{pmT('sumForContract')}</Text>
            <Text style={[styles.head, styles.num, { width: W.sum, color: c.text }]}>{pmT('sumForAccounting')}</Text>
            <Text style={[styles.head, { width: W.author, color: c.text }]}>{pmT('Author')}</Text>
            <Text style={[styles.head, { width: W.created, color: c.text }]}>{pmT('Created')}</Text>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(r) => r.documentGUID}
            renderItem={renderItem}
            initialNumToRender={25}
            windowSize={9}
            ListEmptyComponent={<Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6, padding: 16 }}>{list.isLoading ? pmT('Loading…') : factListFilterActive(applied) ? pmT('No document matches the filters.') : pmT('No fact input documents yet. Right-click a line of a task → Facts input.')}</Text>}
          />
          {/* the footer: the listed documents added up */}
          <View testID={`${testID}-footer`} style={[styles.row, { height: 36, backgroundColor: c.surface, borderTopColor: c.border, borderTopWidth: 1 }]}>
            <Text testID={`${testID}-count`} style={[styles.head, { width: W.doc + W.period, color: c.text }]}>{rows.length === totalCount ? `${totalCount} ${pmT('documents')}` : `${rows.length} ${pmT('of')} ${totalCount} ${pmT('documents')}`}</Text>
            <View style={{ width: W.lines }} />
            <Text testID={`${testID}-total-budget`} style={[styles.head, styles.num, { width: W.sum, color: c.text }]}>{money(totals.sumForBudget)}</Text>
            <Text testID={`${testID}-total-contract`} style={[styles.head, styles.num, { width: W.sum, color: c.text }]}>{money(totals.sumForContract)}</Text>
            <Text testID={`${testID}-total-accounting`} style={[styles.head, styles.num, { width: W.sum, color: c.text }]}>{money(totals.sumForAccounting)}</Text>
          </View>
        </View>
      </ScrollView>
      {rows.length < totalCount && (
        <ButtonApp testID={`${testID}-more`} title={`${pmT('Load more')} (${rows.length} ${pmT('of')} ${totalCount})`} variant="text" size="small" onPress={() => setLimit((l) => l + PAGE)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { fontSize: 13, paddingHorizontal: 8 },
  head: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8 },
  num: { textAlign: 'right' },
});
