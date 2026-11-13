// The settings of the video recorder, opened by the gear button of the recorder card (RecordVideo.tsx + RecordVideo.web.tsx):
//   recordDateTimeOverEnabled   switch "Date and time over the video"
//   recordDateTimeOverPosition  radio Top Left | Top Right | Bottom Left | Bottom Right (disabled while the switch is off);
//                               two lines of two equal items: Top Left, Top Right / Bottom Left, Bottom Right
// Everything is locked while a recording runs: one video has one position. Design: documentation/CAMERA_DATE_TIME.html
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ButtonTextApp, SwitchApp } from '../common';
import RadioSetApp from '../RadioSetApp';
import { RECORD_DATE_TIME_OVER_POSITIONS, RecordDateTimeOverPosition, RecordVideoSettings } from '../../../redux/recordVideoSettings';

export interface RecordVideoSettingsPanelProps {
  settings: RecordVideoSettings;
  onChange: (patch: Partial<RecordVideoSettings>) => void;
  onReset: () => void;
  /** a recording runs (or is being saved): nothing can be changed */
  locked?: boolean;
}

export default function RecordVideoSettingsPanel({ settings, onChange, onReset, locked = false }: RecordVideoSettingsPanelProps) {
  const radioOff = locked || !settings.recordDateTimeOverEnabled;
  return (
    <View style={styles.panel} testID="record-video-settings-panel">
      <SwitchApp
        label="Date and time over the video"
        value={settings.recordDateTimeOverEnabled}
        onValueChange={(next: boolean) => onChange({ recordDateTimeOverEnabled: next })}
        disabled={locked}
        testID="record-video-datetime-switch"
      />
      <RadioSetApp<RecordDateTimeOverPosition>
        testID="record-video-datetime-position"
        title="Position"
        columns={2}
        compact
        value={settings.recordDateTimeOverPosition}
        onChange={(id) => onChange({ recordDateTimeOverPosition: id })}
        options={RECORD_DATE_TIME_OVER_POSITIONS.map((p) => ({ ...p, disabled: radioOff }))}
        style={styles.radio}
      />
      <View style={styles.footer}>
        {/* a plain text button, no border */}
        <ButtonTextApp onPress={onReset} disabled={locked} testID="record-video-settings-reset">
          Reset
        </ButtonTextApp>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#9ca3af' },
  radio: { marginTop: 8 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
});
