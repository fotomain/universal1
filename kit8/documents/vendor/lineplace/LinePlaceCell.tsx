// LinePlaceCell - the cell of the task (vendorInvoiceTaskGUID) or of the task line (vendorInvoiceTaskLineGUID) of a line of a MULTI PROJECT document:
// the name / GUID, and three small buttons (a DRAFT only): Paste (the GUID from the clipboard: "Copy GUID" of a task, "Copy line GUID" of a Finances line), Select (the project tree window) and Clear.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { pmT } from '../../../pm/i18n/pmT';
import { LinePlace, PlaceField, placeCellText } from './linePlaceModel';

export interface LinePlaceCellProps {
  field: PlaceField;
  place: LinePlace | undefined;
  editable: boolean;
  onPaste: () => void;
  onPick: () => void;
  onClear: () => void;
  testID: string;
}

export default function LinePlaceCell({ field, place, editable, onPaste, onPick, onClear, testID }: LinePlaceCellProps) {
  const { themeColors: c } = useDesignSystem();
  const text = placeCellText(field, place);
  const button = (id: string, icon: string, label: string, onPress: () => void) => (
    <Pressable key={id} testID={`${testID}-${id}`} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={styles.btn}>
      <IconApp name={icon} size={16} color={c.primary} />
    </Pressable>
  );
  return (
    <View style={styles.root} testID={testID}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text testID={`${testID}-text`} numberOfLines={1} style={{ color: c.text, fontSize: 12 }}>{text.main || '—'}</Text>
        {!!text.sub && <Text numberOfLines={1} style={{ color: c.text, opacity: 0.55, fontSize: 9 }}>{text.sub}</Text>}
      </View>
      {editable && (
        <>
          {button('paste', 'content_paste', pmT(field === 'task' ? 'Paste the task GUID from the clipboard' : 'Paste the task line GUID from the clipboard'), onPaste)}
          {button('pick', 'account_tree', pmT(field === 'task' ? 'Select the task in the project tree' : 'Select the task line in the project tree'), onPick)}
          {(field === 'task' ? true : !!place?.taskLineGUID) && button('clear', 'close', pmT('Clear'), onClear)}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%' },
  btn: { padding: 3 },
});
