// PMPaymentFactDocumentLines - the LINES of a payment fact in the form: a ReusableTable on the redux entity PAYMENT_FACT_LINES_ENTITY (realtime, optimistic). A line of a DRAFT can be edited (contract, budget item, business
// unit, the sum with VAT, the amount of the money account) and deleted; the button "Get from plan" (the lines come from the POSTED payment plan) is in the bar of the form, the + of the table adds an unplanned line
// (on the task of the document). The converted sums are written by the database. A posted document is read only.
// THE RULE: one bank transaction pays N contracts of the payee, with N budget items, business units, tasks and projects.
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../../pm/i18n/pmT';
import { useDocumentLineMenu } from '../../vendor/lineplace/useDocumentLineMenu';
import { PAYMENT_FACT_LINES_ENTITY, PaymentFactHeaderView } from './paymentFactModel';

export interface PMPaymentFactDocumentLinesProps {
  /** the open document; null = none (the "not found" text, or the loading text) */
  header: PaymentFactHeaderView | null;
  columns: VisualColumn[];
  rowFilter: (row: ReusableTableRow) => boolean;
  /** draft: the table can be edited */
  edit: boolean;
  loading: boolean;
  /** the + of the table: an unplanned line (draft) */
  onAddLine: () => void;
  testID?: string;
}

export default function PMPaymentFactDocumentLines({ header, columns, rowFilter, edit, loading, onAddLine, testID = 'payment-fact' }: PMPaymentFactDocumentLinesProps) {
  const { themeColors: c } = useDesignSystem();
  // the Task context menu items on a line (Open task, Facts input, Vendor Invoice, Purchase Order, Copy GUID ...)
  const lineMenu = useDocumentLineMenu(`${testID}-lines`);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {loading && <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('Loading…')}</Text>}
      {header && (
        <ReusableTable
          key={`${header.guid}:${header.status}:${header.direction}`}
          testID={`${testID}-lines`}
          entityName={PAYMENT_FACT_LINES_ENTITY}
          crudListTitle={pmT('Payment lines')}
          itemLabel="Line"
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          // the lines of THIS document are read (a document can have lines of several tasks and projects); the table filters them
          readParams={{ match: { rowHeaderGUID: header.guid } }}
          rowFilter={rowFilter}
          visualColumns={columns}
          // an unplanned line (no plan payment) needs a task: the document's own, or the one chosen in the cell
          addEnabled={edit}
          onAdd={edit ? onAddLine : undefined}
          crudPanelEnabled={edit}
          contextMenuEnabled={edit}
          extraMenuItems={lineMenu}
          selectionEnabled={edit}
          reorderEnabled={false}
          dragAndDropColumns
          resizeColumnWidth
          realtime
          emptyText={pmT('No lines. Press "Get from plan" to take the posted payments of the plan.')}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
        />
      )}
      {!header && !loading && <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6 }}>{pmT('The payment fact was not found.')}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 12, paddingBottom: 24 },
});
