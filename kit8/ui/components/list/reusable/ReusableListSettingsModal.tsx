// ReusableList - the Settings window of ONE list (three dots menu of the toolbar -> Settings). The settings are LOCAL: kept on this device under the list's reusableListGUID.
//   swipeModeFromLeftToRight   what a swipe with the finger moving left -> right does (archiveWithStop | archiveWithDesappear | deleteWithStop | deleteWithDesappear)
//   swipeModeFromRightToLeft   the same for right -> left
//   showArchivedRowsMode       archived cards on a separate tab (All | Archived, default) or in the same list
// A change is saved at once.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import RadioSetApp from '../../RadioSetApp';
import ButtonTextApp from '../../common/ButtonTextApp';
import { resetReusableListSettings, saveReusableListSettings, useReusableListSettings } from './reusableListSettingsStore';
import { SHOW_ARCHIVED_LABEL, SHOW_ARCHIVED_ROWS_MODES, ShowArchivedRowsMode, SWIPE_MODE_LABEL, SWIPE_MODES, SwipeMode } from './swipeModel';

interface Props {
  reusableListGUID: string;
  title: string;
  onClose: () => void;
  testID: string;
}

const ARCHIVED_OPTIONS = SHOW_ARCHIVED_ROWS_MODES.map((m) => ({ id: m, label: SHOW_ARCHIVED_LABEL[m].label, description: SHOW_ARCHIVED_LABEL[m].description }));
const OPTIONS = SWIPE_MODES.map((m) => ({ id: m, label: SWIPE_MODE_LABEL[m].label, description: SWIPE_MODE_LABEL[m].description }));

export default function ReusableListSettingsModal({ reusableListGUID, title, onClose, testID }: Props) {
  const { themeColors: c } = useDesignSystem();
  const settings = useReusableListSettings(reusableListGUID);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} testID={`${testID}-settings-modal`}>
      <View style={styles.fill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" testID={`${testID}-settings-backdrop`} />
        <View style={[styles.sheet, { backgroundColor: c.background, borderColor: c.border }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: c.text }]} testID={`${testID}-settings-title`}>{title} · Settings</Text>
            <Text style={[styles.hint, { color: c.text }]} testID={`${testID}-settings-guid`}>List id: {reusableListGUID} · saved on this device</Text>

            <RadioSetApp<SwipeMode> testID={`${testID}-settings-ltr`} title="Swipe from left to right" options={OPTIONS} value={settings.swipeModeFromLeftToRight}
              onChange={(m) => saveReusableListSettings(reusableListGUID, { swipeModeFromLeftToRight: m })} />
            <RadioSetApp<SwipeMode> testID={`${testID}-settings-rtl`} title="Swipe from right to left" options={OPTIONS} value={settings.swipeModeFromRightToLeft}
              onChange={(m) => saveReusableListSettings(reusableListGUID, { swipeModeFromRightToLeft: m })} />

            <RadioSetApp<ShowArchivedRowsMode> testID={`${testID}-settings-archived`} title="Show archived rows" options={ARCHIVED_OPTIONS} value={settings.showArchivedRowsMode}
              onChange={(m) => saveReusableListSettings(reusableListGUID, { showArchivedRowsMode: m })} />
          </ScrollView>
          <View style={styles.buttons}>
            <ButtonTextApp testID={`${testID}-settings-reset`} title="Reset" onPress={() => resetReusableListSettings(reusableListGUID)} />
            <ButtonTextApp testID={`${testID}-settings-close`} title="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 12, opacity: 0.65 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 10 },
});
