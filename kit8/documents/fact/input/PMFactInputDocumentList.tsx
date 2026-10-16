// PMFactInputDocumentList - the LIST of fact input documents (the hamburger menu → Budgets → … → Actuals; route /pm/fact/list), a ReusableTable with CRUD:
//   columns   Document · Status · Input · Task · Project · Period · Lines · sumForBudget · sumForContract · sumForAccounting (the totals of the DOCUMENT) · Author · Created - read only; the footer adds up the listed documents
//   CRUD      Create = the "New fact document" window (project, task → task_fact_document_create, the form opens) · Read = realtime rows (entity taskFactHeader) · Open = a click on a row / the row menu
//             (PMFactInputDocumentForm) · Delete = the selected drafts (a posted document is refused by the database)
//   fast filters (ONE row above the table, scrolls sideways when narrow; TextInputApp / DateInputApp / the select, each with a Clear icon inside its field)
//             factTimelinePeriod (from - to) · factProjectFilter · factBusinessUnitFilter · factRoleFilter · factResourceFilter · authorFilter
//             - applied by the DATABASE (task_fact_document_list): a document is listed when ONE of its lines satisfies all the line filters; the table shows exactly those documents.
//   scope     taskGUID / taskLineGUID (props = route params): the documents of that task / task line (menu "Go to → Fact input"); a chip above the filters says it, its x clears it
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import { rowTitle } from '../../../catalog/product/crud/productCatalogTools';
import { businessUnitPath } from '../../../catalog/business_unit/businessUnitModel';
import { useTaskLineCatalogs } from '../../../pm/view/task/finances/useTaskLineCatalogs';
import { personFullName, resourceTitleOfRow } from '../../../pm/view/task/finances/taskLineResource';
import { pmT } from '../../../pm/i18n/pmT';
import TaskScopeChip from '../../taskScope/TaskScopeChip';
import { useTaskScope } from '../../taskScope/useTaskScope';
import { taskScopeToRpc } from '../../taskScope/taskScopeModel';
import { EMPTY_FACT_LIST_FILTER, FACT_HEADER_ENTITY, FactListFilter, FactListRow, factListDateErrors, factListFilterActive } from './factInputModel';
import { createFactDocument } from './factInputApi';
import { factListColumns } from './factListColumns';
import PMFactNewDocumentModal from './PMFactNewDocumentModal';
import { useFactDocumentList, useFactProjects } from './useFactDocumentList';
import { useOpenFactInput } from './useOpenFactInput';

export const FACT_LIST_FILTER_DEBOUNCE_MS = 150;
/** the documents the table can show: the whole list RPC answer (the table has its own search / sort / column filters) */
const LIST_LIMIT = 1000;

export interface PMFactInputDocumentListProps {
  testID?: string;
  /** the documents of one project only (the project filter is fixed) */
  projectGUID?: string | null;
  /** the documents of ONE task / task line (route params taskGUID / taskLineGUID; menu "Go to → Fact input"): a chip says so, its x shows all the documents */
  taskGUID?: string | null;
  taskLineGUID?: string | null;
}

/** the select of a filter: the label is its placeholder (like the inputs next to it) and a clear (x) icon INSIDE the field empties it (the picker is searchable above 10 items) */
function FilterSelect({ testID, label, items, value, onSelect, width = 190 }: { testID: string; label: string; items: { value: string; label: string; group?: string }[]; value: string; onSelect: (v: string) => void; width?: number }) {
  return (
    <View style={[styles.cell, { width }]}>
      <SelectItemFromListApp testID={testID} items={items} value={value} onSelect={onSelect} placeholder={label} clearable searchPlaceholder={label} fieldHeight={42} fieldRadius={4} />
    </View>
  );
}

export default function PMFactInputDocumentList({ testID = 'fact-list', projectGUID, taskGUID, taskLineGUID }: PMFactInputDocumentListProps) {
  const { themeColors: c } = useDesignSystem();
  const data = useTaskLineCatalogs(true);
  const projects = useFactProjects();
  const openFactInput = useOpenFactInput();

  // the typed filter (draft) is applied after a pause
  const [draft, setDraft] = useState<FactListFilter>({ ...EMPTY_FACT_LIST_FILTER, projectGUID: projectGUID || '' });
  const [applied, setApplied] = useState<FactListFilter>(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (patch: Partial<FactListFilter>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setApplied(next), FACT_LIST_FILTER_DEBOUNCE_MS);
  };
  const errors = factListDateErrors(draft);

  const taskScope = useTaskScope({ taskGUID: taskGUID || '', taskLineGUID: taskLineGUID || '' });
  const list = useFactDocumentList(applied, LIST_LIMIT, taskScopeToRpc(taskScope.scope));

  // the table shows the header rows of the redux entity (realtime) that the database listed for the filters; a cell reads its text and totals from the list row of the same GUID
  const byGuid = useMemo(() => new Map<string, FactListRow>(list.answer.rows.map((r) => [r.documentGUID, r])), [list.answer.rows]);
  const columns = useMemo(() => factListColumns((row) => byGuid.get(row.rowGUID)), [byGuid]);
  const rowFilter = useCallback((row: { rowGUID: string }) => byGuid.has(row.rowGUID), [byGuid]);
  // a document made / posted / deleted elsewhere (realtime) changes the entity: the list is read again
  const entityRows: any[] | undefined = useSelector((s: any) => s?.[FACT_HEADER_ENTITY]?.entityDataFromServer);
  const signature = (entityRows ?? []).map((r) => `${r.rowGUID}:${r.updated_at ?? ''}:${r.rowJSON?.documentHeader?.documentStatus ?? ''}`).join('|');
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (seen.current !== null && seen.current !== signature) list.refetch();
    seen.current = signature;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Create: the "New fact document" window → task_fact_document_create → the form of the new document
  const { supabase } = useSupabase();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const create = async (taskGUID: string, project: string) => {
    setBusy(true);
    setCreateError(null);
    try {
      const documentGUID = await createFactDocument(supabase, taskGUID);
      setCreating(false);
      list.refetch();
      openFactInput({ taskGUID, projectGUID: project || undefined, documentGUID });
    } catch (e: any) {
      setCreateError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const projectItems = useMemo(() => projects.map((p) => ({ value: p.guid, label: p.name })), [projects]);
  const unitItems = useMemo(() => data.businessUnit.map((u) => ({ value: u.rowGUID, label: businessUnitPath(data.businessUnit, u.rowGUID) || rowTitle(u) })), [data.businessUnit]);
  const roleItems = useMemo(() => data.resourceRole.map((r) => ({ value: r.rowGUID, label: rowTitle(r) })), [data.resourceRole]);
  const resourceItems = useMemo(() => [
    ...data.person.map((r) => ({ value: r.rowGUID, label: personFullName(r), group: pmT('Persons') })),
    ...data.equipment.map((r) => ({ value: r.rowGUID, label: resourceTitleOfRow(r), group: pmT('Equipment') })),
    ...data.product.map((r) => ({ value: r.rowGUID, label: rowTitle(r), group: pmT('Products') })),
  ], [data.person, data.equipment, data.product]);

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

      <TaskScopeChip testID={`${testID}-scope`} scope={taskScope.scope} taskName={taskScope.taskName} onClear={taskScope.clear} />

      {/* the fast filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filters} testID={`${testID}-filters`}>
        <View style={[styles.cell, { width: 200 }]}>
          <DateInputApp testID={`${testID}-factTimelinePeriod-from`} label={pmT('Period from')} value={draft.fromDay} onChangeText={(t) => change({ fromDay: t })} compact error={errors.fromDay} style={styles.field} />
        </View>
        <View style={[styles.cell, { width: 200 }]}>
          <DateInputApp testID={`${testID}-factTimelinePeriod-to`} label={pmT('Period to')} value={draft.toDay} onChangeText={(t) => change({ toDay: t })} compact error={errors.toDay} style={styles.field} />
        </View>
        {!projectGUID && <FilterSelect testID={`${testID}-factProjectFilter`} label={pmT('Project')} items={projectItems} value={draft.projectGUID} onSelect={(v) => change({ projectGUID: v })} />}
        <FilterSelect testID={`${testID}-factBusinessUnitFilter`} label={pmT('Business unit')} items={unitItems} value={draft.businessUnitGUID} onSelect={(v) => change({ businessUnitGUID: v })} width={220} />
        <FilterSelect testID={`${testID}-factRoleFilter`} label={pmT('Role')} items={roleItems} value={draft.roleGUID} onSelect={(v) => change({ roleGUID: v })} />
        <FilterSelect testID={`${testID}-factResourceFilter`} label={pmT('Resource')} items={resourceItems} value={draft.resourceGUID} onSelect={(v) => change({ resourceGUID: v })} />
        <View style={[styles.cell, { width: 170 }]}>
          <TextInputApp testID={`${testID}-authorFilter`} label={pmT('Author')} value={draft.author} onChangeText={(t) => change({ author: t })} compact leftIcon="search" style={styles.field} />
        </View>
      </ScrollView>

      {!!list.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{list.error}</Text>}

      <View style={{ flex: 1 }} testID={`${testID}-table`}>
        <ReusableTable
          testID={`${testID}-lines`}
          entityName={FACT_HEADER_ENTITY}
          crudListTitle={pmT('Actuals')}
          itemLabel="Document"
          openLabel={pmT('Open document')}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          readParams={{ orderBy: 'created_at', ascending: false, ...(projectGUID ? { match: { rowProjectGUID: projectGUID } } : {}) }}
          visualColumns={columns}
          rowFilter={rowFilter}
          reorderEnabled={false}
          onAdd={() => { setCreateError(null); setCreating(true); }}
          onRowOpen={(row) => { const r = byGuid.get(row.rowGUID); if (r) openFactInput({ taskGUID: r.taskGUID, projectGUID: r.projectGUID, documentGUID: r.documentGUID }); }}
          emptyText={list.isLoading ? pmT('Loading…') : factListFilterActive(applied) || taskScope.active ? pmT('No document matches the filters.') : pmT('No fact input documents yet. Right-click a line of a task → Facts input.')}
        />
      </View>
      <PMFactNewDocumentModal testID={`${testID}-new`} visible={creating} projectGUID={projectGUID} busy={busy} error={createError} onCancel={() => setCreating(false)} onCreate={create} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  // every filter: one row height, the visible box bottom-aligned (paper leaves 6 px above its outline for the label), no bottom margin of its own
  cell: { height: 48, justifyContent: 'flex-end' },
  field: { marginBottom: 0 },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
});
