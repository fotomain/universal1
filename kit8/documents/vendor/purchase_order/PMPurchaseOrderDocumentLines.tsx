// PMPurchaseOrderDocumentLines - the LINES of a purchase order in the form: DocumentTabs All (default) · Time · Material · Expenses with the number of lines of each (the same look as the Finances table of a task)
// and a ReusableTable on the redux entity PURCHASE_ORDER_LINES_ENTITY (realtime, optimistic): quantity, price and VAT % of a DRAFT are editable and can be deleted; with the project setting
// independentInvoiceInputAvailable a + adds a line that is not tied to a task line; a posted document is read only. In Multi Project the columns carry the project / task / task line of every line.
// The twin of the lines of VendorInvoiceDocumentForm (kit8/documents/vendor/invoice).
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import { pmT } from '../../../pm/i18n/pmT';
import { PURCHASE_ORDER_ALL_TAB, PURCHASE_ORDER_LINES_ENTITY, PURCHASE_ORDER_TABS, PurchaseOrderHeaderView } from './purchaseOrderModel';

export interface PMPurchaseOrderDocumentLinesProps {
  /** the open document; null = none (the "not found" text, or the loading text) */
  header: PurchaseOrderHeaderView | null;
  tab: string;
  onTab: (tab: string) => void;
  /** the number of lines of every tab */
  counts: Record<string, number>;
  columns: VisualColumn[];
  rowFilter: (row: ReusableTableRow) => boolean;
  /** draft: the table can be edited */
  edit: boolean;
  /** draft + the project setting: a + adds a line that is not tied to a task line */
  independent: boolean;
  multi: boolean;
  loading: boolean;
  /** the kind of the new line = a genus */
  onAddLine: (genus: string) => void;
  testID?: string;
}

export default function PMPurchaseOrderDocumentLines({ header, tab, onTab, counts, columns, rowFilter, edit, independent, multi, loading, onAddLine, testID = 'purchase-order' }: PMPurchaseOrderDocumentLinesProps) {
  const { themeColors: c } = useDesignSystem();
  return (
    <>
      {/* DocumentTabs: All (default) · Time · Material · Expenses */}
      <View accessibilityRole="tablist" testID={`${testID}-tabs`} style={[styles.tabs, { borderBottomColor: c.border }]}>
        {PURCHASE_ORDER_TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable key={t.id} accessibilityRole="tab" aria-selected={active} testID={`${testID}-tab-${t.id}`} onPress={() => onTab(t.id)} style={[styles.tab, { borderBottomColor: active ? c.primary : 'transparent' }]}>
              <IconApp name={t.icon} size={16} color={active ? c.primary : c.text} />
              <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{pmT(t.title)}</Text>
              {!!counts[t.id] && (
                <View testID={`${testID}-tab-${t.id}-count`} style={[styles.badge, { backgroundColor: c.primary }]}>
                  <Text style={styles.badgeText}>{counts[t.id] > 99 ? '99+' : String(counts[t.id])}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>


      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {loading && <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('Loading…')}</Text>}
        {header && (
          <ReusableTable
            key={`${header.guid}:${tab}:${header.status}:${multi ? 'multi' : 'single'}`}
            testID={`${testID}-lines`}
            entityName={PURCHASE_ORDER_LINES_ENTITY}
            crudListTitle={pmT('Order lines')}
            itemLabel="Line"
            listOwnerGUID={REUSABLE_TABLE_ALL}
            listParentGUID={REUSABLE_TABLE_ALL}
            // the lines of THIS document are read (a document can have lines of several tasks); the table filters the tab
            readParams={{ match: { rowHeaderGUID: header.guid } }}
            rowFilter={rowFilter}
            visualColumns={columns}
            // independent input (project setting): the + adds a line of the kind of the tab (All: Time) by the database, not tied to a task line; otherwise the lines come from the task lines only
            addEnabled={independent}
            onAdd={independent ? () => onAddLine(PURCHASE_ORDER_TABS.find((t) => t.id === tab)?.genus ?? MANAGEMENT_GENUS.time) : undefined}
            crudPanelEnabled={edit}
            contextMenuEnabled={edit}
            selectionEnabled={edit}
            reorderEnabled={false}
            dragAndDropColumns
            resizeColumnWidth
            realtime
            emptyText={pmT('No lines.')}
            uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
          />
        )}
        {!header && !loading && <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6 }}>{pmT('The purchase order was not found.')}</Text>}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 14, borderBottomWidth: 2 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { padding: 12, paddingBottom: 24 },
});
