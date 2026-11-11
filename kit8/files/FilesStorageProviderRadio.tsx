// FilesStorageProviderRadio - the radio set of the setting projectFilesStorageProvider (Project settings -> Files, Organization defaults): 1. Google Drive, 2. Microsoft OneDrive.
// Disabled while the project switch filesFunctionalityEnabled is off (the stored value is shown, nothing is lost). An item whose storage is not configured on the server is disabled
// with its hint (the status of the function says providerConfigured).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import IconApp from '../ui/components/common/IconApp';
import { pmT } from '../pm/i18n/pmT';
import { FILE_STORAGE_PROVIDERS, type FileStorageProvider } from './fileModel';

export interface FilesStorageProviderRadioProps {
  value: FileStorageProvider;
  onChange: (next: FileStorageProvider) => void;
  disabled?: boolean;
  /** storages the server cannot use (no client id): shown disabled with a hint */
  notConfigured?: FileStorageProvider[];
  testID?: string;
}

export default function FilesStorageProviderRadio({ value, onChange, disabled = false, notConfigured = [], testID = 'files-storage-provider' }: FilesStorageProviderRadioProps) {
  const { themeColors: c } = useDesignSystem();
  const label = pmT('Files storage (projectFilesStorageProvider)');
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.set}>
      <Text style={[styles.title, { color: c.text }]}>{label}</Text>
      {FILE_STORAGE_PROVIDERS.map((p, i) => {
        const selected = p.id === value;
        const off = disabled || (notConfigured.includes(p.id) && !selected);
        return (
          <Pressable
            key={p.id}
            testID={`${testID}-${p.id}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: off }}
            aria-checked={selected}
            disabled={off}
            onPress={() => onChange(p.id)}
            style={[styles.item, { opacity: off ? 0.5 : 1 }]}
          >
            <IconApp name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} color={selected ? c.primary : c.text} />
            <Text style={{ color: selected ? c.primary : c.text, fontWeight: selected ? '700' : '400', fontSize: 14 }}>{`${i + 1}. ${pmT(p.title)}`}</Text>
            {notConfigured.includes(p.id) ? <Text testID={`${testID}-${p.id}-hint`} style={{ color: c.error, fontSize: 12 }}>{pmT('not configured on this server')}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  set: { gap: 4, marginTop: 8 },
  title: { fontSize: 13, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
