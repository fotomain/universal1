// SelectNormWindow - the window where the user SELECTS the norm of a position: the norm books (NormBookPanel in its pick mode: no import / export, the row button reads "Select") in a modal.
// The chosen norm is handed to the dashboard, which writes it into the position line (applyNormToLine) and closes the window.
import React from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { pmT } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import NormBookPanel from './NormBookPanel';
import type { NormRow } from './normBookApi';
import type { NormUnitCosts } from '../model/normCosting';

export interface SelectNormWindowProps {
  visible: boolean;
  client: any;
  onSelect: (norm: NormRow, costs: NormUnitCosts, title: string) => void;
  /** the norm the position has now: the window starts at it (its book, its section, its row marked) */
  startAt?: { normGUID?: string | null; code?: string | null } | null;
  onClose: () => void;
  testID?: string;
}

export default function SelectNormWindow({ visible, client, onSelect, startAt = null, onClose, testID = 'estimation-select-norm' }: SelectNormWindowProps) {
  const { themeColors: c } = useDesignSystem();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>{pmT('Select the norm of the position')}</Text>
          <View style={{ flex: 1, minHeight: 320 }}>
            {visible && <NormBookPanel client={client} canManage={false} pickMode startAt={startAt} onAddNorm={onSelect} onImport={() => undefined} onExport={() => undefined} testID={`${testID}-books`} />}
          </View>
          <View style={styles.row}>
            <PMDialogButton testID={`${testID}-close`} kind="secondary" title={pmT('Close')} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { width: '100%', maxWidth: 1200, height: Platform.OS === 'web' ? '90%' : '94%', borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
});
