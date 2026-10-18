// TabProductReceipt - the 2nd level tab "Product receipt" of TabTaskEditFact: the product receipts of the task (PMProductReceiptDocumentList with the scope of the task:
// the chip "Task: …", the folders legal entity → vendor, the quick filters; a click on a row opens the document).
import React from 'react';
import { View } from 'react-native';
import PMProductReceiptDocumentList from '../../../../documents/vendor/product_receipt/PMProductReceiptDocumentList';

export default function TabProductReceipt({ taskGUID }: { taskGUID: string }) {
  return (
    <View style={{ flex: 1 }} testID="pm-task-edit-tab-product-receipt">
      <PMProductReceiptDocumentList testID="pm-task-edit-product-receipt" taskGUID={taskGUID} />
    </View>
  );
}
