// PMPurchaseOrderDocumentList - the LIST of purchase orders (hamburger menu → Budgets → Purchase orders; route /pm/purchase-order/list), a ReusableTable with a FOLDERS tree and quick filters.
//   folders   legal entity → vendor (what the documents have); a click on a folder shows its documents
//   columns   Order number · Document · Order date · Vendor · Total sum before VAT · Currency · Total VAT · Total sum with VAT · Contract · Legal entity · Status · Author · Lines
//   totals    PER CURRENCY below the table (the currencies of the contracts are never added)
//   CRUD      Read = realtime rows (entity purchaseOrderHeader) · Open = a click on a row / the row menu (PMPurchaseOrderDocumentForm) · Delete = the selected DRAFTS (the database refuses a posted one) ·
//             Create = the documents are made from a task (context menu "Purchase Order"), the + button says so
//   quick filters (ONE row, scrolls sideways when narrow; TextInputApp / DateInputApp / the select, each with a Clear icon inside its field) for every column that is not a number:
//             order number · date from - to · legal entity · vendor · contract · currency · status · author - applied by the DATABASE (purchase_order_list)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDocumentLineMenu } from '../lineplace/useDocumentLineMenu';
import type { PMMenuItemProps } from '../../../pm/inner/menu/PMMenuItem';
import { canCreateReceiptFromOrder } from '../product_receipt/productReceiptModel';
import { useCreateProductReceiptFromOrder } from '../product_receipt/useProductReceipt';
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
import { CONTRACT_ENTITY } from '../../../catalog/contract/contractModel';
import { PARTNER_ENTITY, PARTNER_READ_PARAMS } from '../../../catalog/partner/partnerModel';
import { useLegalEntityData } from '../../../catalog/legal_entity/useLegalEntityData';
import { legalEntityTitle } from '../../../catalog/legal_entity/legalEntityModel';
import { pmT } from '../../../pm/i18n/pmT';
import TaskScopeChip from '../../taskScope/TaskScopeChip';
import { useTaskScope } from '../../taskScope/useTaskScope';
import { taskScopeToRpc } from '../../taskScope/taskScopeModel';
import {
  EMPTY_PURCHASE_ORDER_FILTER, PURCHASE_ORDER_HEADER_ENTITY, PURCHASE_ORDER_ROUTE, PurchaseOrderListFilter, PurchaseOrderListRow, formatMoney, purchaseOrderDateErrors, purchaseOrderFilterActive,
  purchaseOrderFolderNodes,
} from './purchaseOrderModel';
import { purchaseOrderListColumns } from './purchaseOrderListColumns';
import { usePurchaseOrderList } from './usePurchaseOrder';

export const VENDOR_LIST_FILTER_DEBOUNCE_MS = 150;

export interface PMPurchaseOrderDocumentListProps {
  testID?: string;
  /** the documents of ONE task / task line (route params taskGUID / taskLineGUID; menu "Go to → Purchase orders"): a chip says so, its x shows all the documents */
  taskGUID?: string | null;
  taskLineGUID?: string | null;
}

/** the select of a filter: the label is its placeholder (like the inputs next to it) and a clear (x) icon INSIDE the field empties it */
function FilterSelect({ testID, label, items, value, onSelect, width = 190 }: { testID: string; label: string; items: { value: string; label: string }[]; value: string; onSelect: (v: string) => void; width?: number }) {
  return (
    <View style={[styles.cell, { width }]}>
      <SelectItemFromListApp testID={testID} items={items} value={value} onSelect={onSelect} placeholder={label} clearable searchPlaceholder={label} fieldHeight={42} fieldRadius={4} />
    </View>
  );
}

export default function PMPurchaseOrderDocumentList({ testID = 'vendor-list', taskGUID, taskLineGUID }: PMPurchaseOrderDocumentListProps) {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const legal = useLegalEntityData(true);
  useRealtimeEntity(PARTNER_ENTITY, { readParams: PARTNER_READ_PARAMS });
  useRealtimeEntity(CONTRACT_ENTITY, { readParams: PARTNER_READ_PARAMS });
  const partners: any[] = useSelector((s: any) => s?.[PARTNER_ENTITY]?.entityDataFromServer) ?? [];
  const contracts: any[] = useSelector((s: any) => s?.[CONTRACT_ENTITY]?.entityDataFromServer) ?? [];

  // the typed filter (draft) is applied after a pause
  const [draft, setDraft] = useState<PurchaseOrderListFilter>(EMPTY_PURCHASE_ORDER_FILTER);
  const [applied, setApplied] = useState<PurchaseOrderListFilter>(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (patch: Partial<PurchaseOrderListFilter>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setApplied(next), VENDOR_LIST_FILTER_DEBOUNCE_MS);
  };
  const errors = purchaseOrderDateErrors(draft);
  const taskScope = useTaskScope({ taskGUID: taskGUID || '', taskLineGUID: taskLineGUID || '' });
  const list = usePurchaseOrderList(applied, 1000, taskScopeToRpc(taskScope.scope));
  const [hint, setHint] = useState(false);
  const [folder, setFolder] = useState<string>(TREE_ALL_ID);

  // the table shows the header rows of the redux entity (realtime) that the database listed for the filters; a cell reads its text and totals from the list row of the same GUID
  const byGuid = useMemo(() => new Map<string, PurchaseOrderListRow>(list.answer.rows.map((r) => [r.documentGUID, r])), [list.answer.rows]);
  const columns = useMemo(() => purchaseOrderListColumns((row) => byGuid.get(row.rowGUID)), [byGuid]);
  const rowFilter = useCallback((row: { rowGUID: string }) => byGuid.has(row.rowGUID), [byGuid]);
  // the Task context menu items on a document row: the task the document was made from (Open task, Facts input, Vendor Invoice, Purchase Order, Copy task GUID)
  const resolveTask = useCallback((row: { rowGUID: string }) => ({ taskGUID: byGuid.get(row.rowGUID)?.taskGUID, projectGUID: byGuid.get(row.rowGUID)?.projectGUID }), [byGuid]);
  const taskMenu = useDocumentLineMenu(`${testID}-lines`, resolveTask as any);
  // "Create based on → Product receipt" of a POSTED order (the draft receipt opens in a new browser window)
  const toReceipt = useCreateProductReceiptFromOrder();
  const rowMenu = useCallback((row: { rowGUID: string }, close: () => void): PMMenuItemProps[] => {
    const info = byGuid.get(row.rowGUID);
    const based: PMMenuItemProps[] = info && canCreateReceiptFromOrder(info.documentStatus)
      ? [{
          testID: `${testID}-menu-create-${row.rowGUID}`, label: pmT('Create based on'), icon: 'add_circle', onPress: () => {},
          submenu: [{ testID: `${testID}-menu-create-product-receipt-${row.rowGUID}`, label: pmT('Product receipt'), icon: 'move_to_inbox', onPress: () => { close(); void toReceipt.create(row.rowGUID); } }],
        }]
      : [];
    return [...based, ...taskMenu(row as any, close)];
  }, [byGuid, taskMenu, toReceipt, testID]);
  // the tree: legal entity → vendor, of the documents that exist
  const nodes = useMemo(() => purchaseOrderFolderNodes(list.answer.rows), [list.answer.rows]);
  const foldersTree = useMemo(() => ({ nodes, folderTarget: 'rowJSON' as const, folderField: 'purchaseOrderFolder', noFolderValue: '', onRowsDrop: () => {} }), [nodes]);
  // a document made / posted / deleted elsewhere (realtime) changes the entity: the list is read again
  const entityRows: any[] | undefined = useSelector((s: any) => s?.[PURCHASE_ORDER_HEADER_ENTITY]?.entityDataFromServer);
  const signature = (entityRows ?? []).map((r) => `${r.rowGUID}:${r.updated_at ?? ''}:${r.rowJSON?.documentHeader?.documentStatus ?? ''}`).join('|');
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (seen.current !== null && seen.current !== signature) list.refetch();
    seen.current = signature;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const entityItems = useMemo(() => legal.rows.map((r) => ({ value: r.rowGUID, label: legalEntityTitle(r) })).sort((a, b) => a.label.localeCompare(b.label)), [legal.rows]);
  const vendorItems = useMemo(() => partners.map((p) => ({ value: p.rowGUID, label: String(p.rowJSON?.partnerTitle ?? p.rowGUID) })).sort((a, b) => a.label.localeCompare(b.label)), [partners]);
  const contractItems = useMemo(() => contracts.filter((k) => k.rowParentGUID === 'partner' && (!draft.partnerGUID || k.rowOwnerGUID === draft.partnerGUID))
    .map((k) => ({ value: k.rowGUID, label: [k.rowJSON?.contractNumber, k.rowJSON?.contractTitle].filter(Boolean).join(' · ') || k.rowGUID })), [contracts, draft.partnerGUID]);
  const currencyItems = useMemo(() => [...new Set([...list.answer.totalsByCurrency.map((t) => t.currency), ...contracts.map((k) => String(k.rowJSON?.contractCurrency ?? ''))].filter(Boolean))].sort().map((v) => ({ value: v, label: v })), [list.answer.totalsByCurrency, contracts]);
  const statusItems = useMemo(() => [{ value: 'draft', label: pmT('Draft') }, { value: 'posted', label: pmT('Posted') }], []);

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="receipt_long" size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Purchase orders')}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('One document = one vendor + one contract')}</Text>
        <View style={{ flex: 1 }} />
        {purchaseOrderFilterActive(draft) && (
          <ButtonApp testID={`${testID}-clear`} title={pmT('Clear filters')} icon="filter_alt_off" variant="text" size="small" onPress={() => { setDraft(EMPTY_PURCHASE_ORDER_FILTER); setApplied(EMPTY_PURCHASE_ORDER_FILTER); }} />
        )}
        <ButtonApp testID={`${testID}-refresh`} title={pmT('Refresh')} icon="refresh" variant="text" size="small" onPress={list.refetch} />
      </View>

      <TaskScopeChip testID={`${testID}-scope`} scope={taskScope.scope} taskName={taskScope.taskName} onClear={taskScope.clear} />

      {/* the quick filters: every column that is not a number */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filters} testID={`${testID}-filters`}>
        <View style={[styles.cell, { width: 170 }]}>
          <TextInputApp testID={`${testID}-numberFilter`} label={pmT('Order number')} value={draft.number} onChangeText={(t) => change({ number: t })} compact leftIcon="search" style={styles.field} />
        </View>
        <View style={[styles.cell, { width: 200 }]}>
          <DateInputApp testID={`${testID}-dateFilter-from`} label={pmT('Date from')} value={draft.fromDay} onChangeText={(t) => change({ fromDay: t })} compact error={errors.fromDay} style={styles.field} />
        </View>
        <View style={[styles.cell, { width: 200 }]}>
          <DateInputApp testID={`${testID}-dateFilter-to`} label={pmT('Date to')} value={draft.toDay} onChangeText={(t) => change({ toDay: t })} compact error={errors.toDay} style={styles.field} />
        </View>
        <FilterSelect testID={`${testID}-legalEntityFilter`} label={pmT('Legal entity')} items={entityItems} value={draft.legalEntityGUID} onSelect={(v) => change({ legalEntityGUID: v })} width={220} />
        <FilterSelect testID={`${testID}-vendorFilter`} label={pmT('Vendor')} items={vendorItems} value={draft.partnerGUID} onSelect={(v) => change({ partnerGUID: v, contractGUID: '' })} width={210} />
        <FilterSelect testID={`${testID}-contractFilter`} label={pmT('Contract')} items={contractItems} value={draft.contractGUID} onSelect={(v) => change({ contractGUID: v })} width={230} />
        <FilterSelect testID={`${testID}-currencyFilter`} label={pmT('Currency')} items={currencyItems} value={draft.currency} onSelect={(v) => change({ currency: v })} width={140} />
        <FilterSelect testID={`${testID}-statusFilter`} label={pmT('Status')} items={statusItems} value={draft.status} onSelect={(v) => change({ status: v })} width={150} />
        <View style={[styles.cell, { width: 170 }]}>
          <TextInputApp testID={`${testID}-authorFilter`} label={pmT('Author')} value={draft.author} onChangeText={(t) => change({ author: t })} compact leftIcon="search" style={styles.field} />
        </View>
      </ScrollView>

      {!!toReceipt.error && <Text testID={`${testID}-create-error`} style={{ color: c.error, padding: 10 }}>{toReceipt.error}</Text>}
      {!!list.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{list.error}</Text>}
      {hint && <Text testID={`${testID}-hint`} style={{ color: c.text, padding: 10 }}>{pmT('Purchase orders are made from a task: right-click a line of a task → Purchase Order.')}</Text>}

      <View style={{ flex: 1 }} testID={`${testID}-table`}>
        <ReusableTable
          testID={`${testID}-lines`}
          entityName={PURCHASE_ORDER_HEADER_ENTITY}
          crudListTitle={pmT('Purchase orders')}
          itemLabel="Purchase order"
          openLabel={pmT('Open purchase order')}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          readParams={{ orderBy: 'created_at', ascending: false }}
          visualColumns={columns}
          rowFilter={rowFilter}
          reorderEnabled={false}
          extraMenuItems={rowMenu}
          onAdd={() => setHint(true)}
          onRowOpen={(row) => { if (byGuid.has(row.rowGUID)) router.push({ pathname: PURCHASE_ORDER_ROUTE, params: { documentGUID: row.rowGUID } } as any); }}
          emptyText={list.isLoading ? pmT('Loading…') : purchaseOrderFilterActive(applied) || taskScope.active ? pmT('No purchase order matches the filters.') : pmT('No purchase orders yet. Right-click a line of a task → Purchase Order.')}
          foldersTree={{ ...foldersTree, selectedFolderId: folder, onSelectedFolderChange: setFolder }}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch', showFoldersTree: true, foldersTreeWidth: 240 }}
        />
      </View>

      {/* the totals PER CURRENCY (the documents the filters list, all pages) */}
      <View testID={`${testID}-totals`} style={[styles.totals, { borderTopColor: c.border }]}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{list.answer.totalCount} {pmT('documents')}</Text>
        {list.answer.totalsByCurrency.map((t) => (
          <Text key={t.currency || 'none'} testID={`${testID}-total-${t.currency || 'none'}`} style={{ color: c.text, fontSize: 12 }}>
            {t.currency || pmT('no currency')}: {pmT('before VAT')} {formatMoney(t.sumBeforeVAT)} · {pmT('VAT')} {formatMoney(t.sumVAT)} · {pmT('with VAT')} {formatMoney(t.sumWithVAT)}
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
