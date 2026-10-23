// PMPaymentFactDocumentList - the LIST of payment facts (hamburger menu → Documents → Payment facts; route /pm/payment-fact/list), a ReusableTable with a FOLDERS tree and quick filters.
//   folders   money account → payee (what the documents have); a click on a folder shows its documents
//   columns   Bank transaction no. · Document · Date · Direction · Payee · Money account · Amount of the money account · Currency · Legal entity · Status · Author · Lines
//   totals    PER CURRENCY of the money accounts below the table (currencies are never added)
//   CRUD      Read = realtime rows (entity paymentFactHeader) · Open = a click on a row / the row menu (PMPaymentFactDocumentForm) · Delete = the selected DRAFTS (the database refuses a posted one) ·
//             Create = a document is made from a task (context menu "Payment fact") or with the + here (an empty draft; the lines come from "Get from plan")
//   quick filters (ONE row, scrolls sideways when narrow; each with a Clear icon inside its field): number · date from - to · legal entity · money account · payee · direction · currency · status · author -
//             applied by the DATABASE (payment_fact_list)
//   scope     taskGUID (props = route params): the documents that pay that task (menu "Go to → Payment facts", the tab Payments of the task window); a chip above the filters says it, its x clears it;
//             `direction`: the sub-tab Outbound | Inbound of the task window shows one direction only
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID } from '../../../ui/components/tree/folderTreeModel';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { PARTNER_ENTITY, PARTNER_READ_PARAMS } from '../../../catalog/partner/partnerModel';
import { useLegalEntityData } from '../../../catalog/legal_entity/useLegalEntityData';
import { legalEntityTitle } from '../../../catalog/legal_entity/legalEntityModel';
import { useMoneyAccountData } from '../../../catalog/money_account/useMoneyAccountData';
import { moneyAccountLabel } from '../../../catalog/money_account/moneyAccountModel';
import { pmT } from '../../../pm/i18n/pmT';
import TaskScopeChip from '../../taskScope/TaskScopeChip';
import { useTaskScope } from '../../taskScope/useTaskScope';
import { taskScopeToRpc } from '../../taskScope/taskScopeModel';
import {
  EMPTY_PAYMENT_FACT_FILTER, PAYMENT_FACT_HEADER_ENTITY, PAYMENT_FACT_ROUTE, PaymentFactDirection, PaymentFactListFilter, PaymentFactListRow, formatMoney, paymentFactDateErrors, paymentFactFilterActive, paymentFactFolderNodes,
} from './paymentFactModel';
import { paymentFactListColumns } from './paymentFactListColumns';
import { usePaymentFactList } from './usePaymentFact';
import { createPaymentFact } from './paymentFactApi';
import { useSupabase } from '../../../providers/WithSupabase';
import { showPaymentFact } from './paymentFactNavigation';

export const PAYMENT_FACT_FILTER_DEBOUNCE_MS = 150;

export interface PMPaymentFactDocumentListProps {
  testID?: string;
  /** the documents of ONE task (route param taskGUID; menu "Go to → Payment facts"): a chip says so, its x shows all the documents */
  taskGUID?: string | null;
  /** only one direction (the sub-tabs Outbound | Inbound of the task window) */
  direction?: PaymentFactDirection | null;
}

/** the select of a filter: the label is its placeholder (like the inputs next to it) and a clear (x) icon INSIDE the field empties it */
function FilterSelect({ testID, label, items, value, onSelect, width = 190 }: { testID: string; label: string; items: { value: string; label: string }[]; value: string; onSelect: (v: string) => void; width?: number }) {
  return (
    <View style={[styles.cell, { width }]}>
      <SelectItemFromListApp testID={testID} items={items} value={value} onSelect={onSelect} placeholder={label} clearable searchPlaceholder={label} fieldHeight={42} fieldRadius={4} />
    </View>
  );
}

export default function PMPaymentFactDocumentList({ testID = 'payment-fact-list', taskGUID, direction }: PMPaymentFactDocumentListProps) {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const { supabase } = useSupabase();
  const legal = useLegalEntityData(true);
  const accounts = useMoneyAccountData(true);
  useRealtimeEntity(PARTNER_ENTITY, { readParams: PARTNER_READ_PARAMS });
  const partners: any[] = useSelector((s: any) => s?.[PARTNER_ENTITY]?.entityDataFromServer) ?? [];

  // the typed filter (draft) is applied after a pause
  const [draft, setDraft] = useState<PaymentFactListFilter>(EMPTY_PAYMENT_FACT_FILTER);
  const [applied, setApplied] = useState<PaymentFactListFilter>(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (patch: Partial<PaymentFactListFilter>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setApplied(next), PAYMENT_FACT_FILTER_DEBOUNCE_MS);
  };
  const errors = paymentFactDateErrors(draft);
  const taskScope = useTaskScope({ taskGUID: taskGUID || '', taskLineGUID: '' });
  const extra = useMemo(() => ({ ...taskScopeToRpc(taskScope.scope), ...(direction ? { direction } : {}) }), [taskScope.scope, direction]);
  const list = usePaymentFactList(applied, 1000, extra);
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);

  // the table shows the header rows of the redux entity (realtime) that the database listed for the filters; a cell reads its text and totals from the list row of the same GUID
  const byGuid = useMemo(() => new Map<string, PaymentFactListRow>(list.answer.rows.map((r) => [r.documentGUID, r])), [list.answer.rows]);
  const columns = useMemo(() => paymentFactListColumns((row) => byGuid.get(row.rowGUID)), [byGuid]);
  const rowFilter = useCallback((row: { rowGUID: string }) => byGuid.has(row.rowGUID), [byGuid]);
  const nodes = useMemo(() => paymentFactFolderNodes(list.answer.rows), [list.answer.rows]);
  const foldersTree = useMemo(() => ({ nodes, folderTarget: 'rowJSON' as const, folderField: 'paymentFactFolder', noFolderValue: '', onRowsDrop: () => {} }), [nodes]);
  // a document made / posted / deleted elsewhere (realtime) changes the entity: the list is read again
  const entityRows: any[] | undefined = useSelector((s: any) => s?.[PAYMENT_FACT_HEADER_ENTITY]?.entityDataFromServer);
  const signature = (entityRows ?? []).map((r) => `${r.rowGUID}:${r.updated_at ?? ''}:${r.rowJSON?.documentHeader?.documentStatus ?? ''}`).join('|');
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (seen.current !== null && seen.current !== signature) list.refetch();
    seen.current = signature;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const entityItems = useMemo(() => legal.rows.map((r) => ({ value: r.rowGUID, label: legalEntityTitle(r) })).sort((a, b) => a.label.localeCompare(b.label)), [legal.rows]);
  const accountItems = useMemo(() => accounts.rows.map((r) => ({ value: r.rowGUID, label: moneyAccountLabel(r) })).sort((a, b) => a.label.localeCompare(b.label)), [accounts.rows]);
  const payeeItems = useMemo(() => partners.map((p) => ({ value: p.rowGUID, label: String(p.rowJSON?.partnerTitle ?? p.rowGUID) })).sort((a, b) => a.label.localeCompare(b.label)), [partners]);
  const currencyItems = useMemo(() => [...new Set([...list.answer.totalsByCurrency.map((t) => t.currency), ...accounts.rows.map((r) => String(r.rowJSON?.moneyAccountCurrency ?? '').toUpperCase())].filter(Boolean))].sort().map((v) => ({ value: v, label: v })), [list.answer.totalsByCurrency, accounts.rows]);
  const statusItems = useMemo(() => [{ value: 'draft', label: pmT('Draft') }, { value: 'posted', label: pmT('Posted') }], []);
  const directionItems = useMemo(() => [{ value: 'outbound', label: pmT('Outbound') }, { value: 'inbound', label: pmT('Inbound') }], []);

  // + : an empty draft (for the task of the scope, when there is one); the lines come from "Get from plan" in the form
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const create = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const guid = await createPaymentFact(supabase, { taskGUID: taskScope.scope.taskGUID || null, direction: direction ?? null });
      list.refetch();
      showPaymentFact(router as any, { documentGUID: guid, taskGUID: taskScope.scope.taskGUID || null }, { newWindow: true });
    } catch (e: any) {
      setCreateError(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="account_balance" size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Payment facts')}{direction ? ` · ${pmT(direction === 'inbound' ? 'Inbound' : 'Outbound')}` : ''}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('One document = one bank transaction')}</Text>
        <View style={{ flex: 1 }} />
        {paymentFactFilterActive(draft) && (
          <ButtonApp testID={`${testID}-clear`} title={pmT('Clear filters')} icon="filter_alt_off" variant="text" size="small" onPress={() => { setDraft(EMPTY_PAYMENT_FACT_FILTER); setApplied(EMPTY_PAYMENT_FACT_FILTER); }} />
        )}
        <ButtonApp testID={`${testID}-refresh`} title={pmT('Refresh')} icon="refresh" variant="text" size="small" onPress={list.refetch} />
      </View>

      <TaskScopeChip testID={`${testID}-scope`} scope={taskScope.scope} taskName={taskScope.taskName} onClear={taskScope.clear} />

      {/* the quick filters: every column that is not a number */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filters} testID={`${testID}-filters`}>
        <View style={[styles.cell, { width: 170 }]}>
          <TextInputApp testID={`${testID}-numberFilter`} label={pmT('Bank transaction no.')} value={draft.number} onChangeText={(t) => change({ number: t })} compact leftIcon="search" style={styles.field} />
        </View>
        <View style={[styles.cell, { width: 200 }]}>
          <DateInputApp testID={`${testID}-dateFilter-from`} label={pmT('Date from')} value={draft.fromDay} onChangeText={(t) => change({ fromDay: t })} compact error={errors.fromDay} style={styles.field} />
        </View>
        <View style={[styles.cell, { width: 200 }]}>
          <DateInputApp testID={`${testID}-dateFilter-to`} label={pmT('Date to')} value={draft.toDay} onChangeText={(t) => change({ toDay: t })} compact error={errors.toDay} style={styles.field} />
        </View>
        <FilterSelect testID={`${testID}-legalEntityFilter`} label={pmT('Legal entity')} items={entityItems} value={draft.legalEntityGUID} onSelect={(v) => change({ legalEntityGUID: v })} width={220} />
        <FilterSelect testID={`${testID}-accountFilter`} label={pmT('Money account')} items={accountItems} value={draft.moneyAccountGUID} onSelect={(v) => change({ moneyAccountGUID: v })} width={220} />
        <FilterSelect testID={`${testID}-payeeFilter`} label={pmT('Payee')} items={payeeItems} value={draft.partnerGUID} onSelect={(v) => change({ partnerGUID: v })} width={210} />
        {!direction && <FilterSelect testID={`${testID}-directionFilter`} label={pmT('Direction')} items={directionItems} value={draft.direction} onSelect={(v) => change({ direction: v })} width={150} />}
        <FilterSelect testID={`${testID}-currencyFilter`} label={pmT('Currency')} items={currencyItems} value={draft.currency} onSelect={(v) => change({ currency: v })} width={140} />
        <FilterSelect testID={`${testID}-statusFilter`} label={pmT('Status')} items={statusItems} value={draft.status} onSelect={(v) => change({ status: v })} width={150} />
        <View style={[styles.cell, { width: 170 }]}>
          <TextInputApp testID={`${testID}-authorFilter`} label={pmT('Author')} value={draft.author} onChangeText={(t) => change({ author: t })} compact leftIcon="search" style={styles.field} />
        </View>
      </ScrollView>

      {!!list.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{list.error}</Text>}
      {!!createError && <Text testID={`${testID}-create-error`} style={{ color: c.error, padding: 10 }}>{createError}</Text>}

      <View style={{ flex: 1 }} testID={`${testID}-table`}>
        <ReusableTable
          testID={`${testID}-lines`}
          entityName={PAYMENT_FACT_HEADER_ENTITY}
          crudListTitle={pmT('Payment facts')}
          itemLabel="Payment fact"
          openLabel={pmT('Open payment fact')}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          readParams={{ orderBy: 'created_at', ascending: false }}
          visualColumns={columns}
          rowFilter={rowFilter}
          reorderEnabled={false}
          addEnabled={!creating}
          onAdd={() => { void create(); }}
          onRowOpen={(row) => { if (byGuid.has(row.rowGUID)) router.push({ pathname: PAYMENT_FACT_ROUTE, params: { documentGUID: row.rowGUID } } as any); }}
          emptyText={list.isLoading ? pmT('Loading…') : paymentFactFilterActive(applied) || taskScope.active ? pmT('No payment fact matches the filters.') : pmT('No payment facts yet. Press "+" or right-click a task → Create based on this → Payment fact.')}
          foldersTree={{ ...foldersTree, selectedFolderId: folder, onSelectedFolderChange: setFolder }}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 240 }}
        />
      </View>

      {/* the totals PER CURRENCY of the money accounts (the documents the filters list, all pages) */}
      <View testID={`${testID}-totals`} style={[styles.totals, { borderTopColor: c.border }]}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{list.answer.totalCount} {pmT('documents')}</Text>
        {list.answer.totalsByCurrency.map((t) => (
          <Text key={t.currency || 'none'} testID={`${testID}-total-${t.currency || 'none'}`} style={{ color: c.text, fontSize: 12 }}>
            {t.currency || pmT('no currency')}: {formatMoney(t.sumForMoneyAccount)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  // every filter: one row height, the visible box bottom-aligned, no bottom margin of its own
  cell: { height: 48, justifyContent: 'flex-end' },
  field: { marginBottom: 0 },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
