// ExportNormBooks - one norm book (with its place in the tree) -> a zip: manifest.json + json/<table>.json (the data, what ImportNormBooks reads) + csv/<table>.csv (flat, for people).
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { exportTableFile } from '../../../ui/components/table/reusable/tableExportActions';
import { readAllPages } from '../../crud/api/apiUtils';
import { pmT } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import { buildNormBookZip, readNormBookData } from '../export/normBookZip';

export interface ExportNormBooksProps { visible: boolean; client: any; bookGUID: string | null; bookTitle?: string; onClose: () => void; testID?: string }

export default function ExportNormBooks({ visible, client, bookGUID, bookTitle = '', onClose, testID = 'export-norm-books' }: ExportNormBooksProps) {
  const { themeColors: c } = useDesignSystem();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async () => {
    if (!bookGUID) return;
    setBusy(true);
    setError('');
    setMessage(pmT('Reading the norm book'));
    try {
      const data = await readNormBookData(client, bookGUID, readAllPages);
      setMessage(pmT('Making the zip'));
      const bytes = buildNormBookZip(data);
      const name = `${(bookTitle || 'norm-book').replace(/[^\p{L}\p{N}._-]+/gu, '_')}_${new Date().toISOString().slice(0, 10)}.zip`;
      await exportTableFile({ fileName: name, mimeType: 'application/zip', bytes });
      setMessage(pmT('Done: {{n}} rows in {{kb}} KB.', { n: Object.values(data).reduce((a, r) => a + (r?.length ?? 0), 0), kb: Math.round(bytes.length / 1024) }));
    } catch (e: any) { setError(String(e?.message ?? e)); setMessage(''); }
    setBusy(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>{pmT('Export a norm book')}</Text>
          <Text style={{ color: c.text }}>{bookTitle}</Text>
          <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('The zip holds manifest.json, json/ (the data, for Import) and csv/ (the same rows to open in Excel).')}</Text>
          {!!message && <Text style={{ color: c.text, fontWeight: '600' }}>{message}</Text>}
          {!!error && <Text style={{ color: c.error }}>{error}</Text>}
          <View style={styles.row}>
            <PMDialogButton testID={`${testID}-run`} kind="primary" icon="download" title={pmT('Export zip')} disabled={busy || !bookGUID} loading={busy} onPress={() => { void run(); }} />
            <PMDialogButton testID={`${testID}-close`} kind="secondary" title={pmT('Close')} disabled={busy} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { width: '100%', maxWidth: 560, borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
