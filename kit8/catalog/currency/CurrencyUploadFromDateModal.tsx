// CurrencyUploadFromDateModal - "Upload all data from a date" of a currency card: a date (DateInputApp) and Upload.
// onUpload(fromDate) resolves true when the rates were uploaded (the dialog closes), false when it failed (it stays open).
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import DateInputApp from '../../ui/components/common/date_input/DateInputApp';
import { todayISO } from './exchange/currencyExchangeModel';
import { monthsBack } from './refresh/refreshCurrencyRatio';
import { uploadDateProblem } from './refresh/uploadAllDataFromDate';

export interface CurrencyUploadFromDateModalProps {
  visible: boolean;
  currencyCode: string;
  busy?: boolean;
  onClose: () => void;
  onUpload: (fromDate: string) => Promise<boolean> | boolean;
  /** the date offered first (default: a year back) */
  defaultDate?: string;
  testID?: string;
}

export default function CurrencyUploadFromDateModal({ visible, currencyCode, busy, onClose, onUpload, defaultDate, testID = 'currency-upload' }: CurrencyUploadFromDateModalProps) {
  const { themeColors: c } = useDesignSystem();
  const [date, setDate] = useState(defaultDate ?? monthsBack(todayISO(), 12));
  useEffect(() => { if (visible) setDate(defaultDate ?? monthsBack(todayISO(), 12)); }, [visible, defaultDate]);
  const problem = uploadDateProblem(date);
  const submit = async () => {
    if (problem || busy) return;
    if (await onUpload(date)) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>Upload all data from a date · {currencyCode || '???'}</Text>
          <Text style={[styles.note, { color: c.text }]}>
            Adds every missing day from this date up to today for ALL currencies of the catalog (all crosses), against the base currency. Rates that exist are never changed.
          </Text>
          <DateInputApp testID={`${testID}-date`} label="From date" value={date} onChangeText={setDate} error={problem ?? undefined} helperText={problem ?? undefined} />
          <View style={styles.buttons}>
            <Pressable testID={`${testID}-cancel`} onPress={onClose} style={[styles.btn, { borderColor: c.border }]} accessibilityRole="button">
              <Text style={{ color: c.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              testID={`${testID}-ok`}
              onPress={submit}
              disabled={!!problem || !!busy}
              accessibilityRole="button"
              style={[styles.btn, { backgroundColor: c.primary, borderColor: c.primary, opacity: problem || busy ? 0.5 : 1 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>{busy ? 'Uploading…' : 'Upload'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  note: { fontSize: 13, opacity: 0.75 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
});
