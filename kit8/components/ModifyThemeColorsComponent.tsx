import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Portal, Dialog, TextInput } from 'react-native-paper';
import { ButtonPrimaryApp } from '../../components/common';
import { useDispatch, useSelector } from 'react-redux';
import { updateThemeColor, resetTheme } from '../redux/userThemeSlice';
import { saveUserTheme } from '../lib/localSecureStorage';
import { MD3Theme } from 'react-native-paper';
import DarkThemeSwitchComponent from './DarkThemeSwitchComponent';

interface ColorPickerItem {
  key: keyof MD3Theme['colors'];
  label: string;
}

const mainColorItems: ColorPickerItem[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'tertiary', label: 'Tertiary' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'error', label: 'Error' },
];

export default function ModifyThemeColorsComponent() {
  const dispatch = useDispatch();
  const userTheme = useSelector((state: any) => state.userTheme);
  const isDark = userTheme?.isDark || false;
  const theme = userTheme?.theme || {};

  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedColorKey, setSelectedColorKey] = useState<keyof MD3Theme['colors'] | null>(null);
  const [colorValue, setColorValue] = useState('');

  const openColorPicker = (key: keyof MD3Theme['colors']) => {
    setSelectedColorKey(key);
    setColorValue(theme.colors?.[key] || '#000000');
    setDialogVisible(true);
  };

  const handleSaveColor = () => {
    if (selectedColorKey && colorValue) {
      dispatch(updateThemeColor({ key: selectedColorKey, value: colorValue }));
      setTimeout(() => {
        saveUserTheme({ isDark, colors: { ...theme.colors, [selectedColorKey]: colorValue } });
      }, 100);
    }
    setDialogVisible(false);
  };

  const handleResetTheme = () => {
    dispatch(resetTheme());
    setTimeout(() => {
      saveUserTheme({ isDark, colors: {} });
    }, 100);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Theme Settings" />
        <Card.Content>
          <DarkThemeSwitchComponent testID="darkThemeSwitch2" showIcon={false} />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Customize Colors" />
        <Card.Content>
          <Text variant="bodySmall" style={styles.hint}>
            Tap on a color to customize it
          </Text>

          {mainColorItems.map((item) => (
            <View key={item.key} style={styles.colorRow}>
              <Text style={styles.colorLabel}>{item.label}</Text>
              <ButtonPrimaryApp
                onPress={() => openColorPicker(item.key)}
                style={[styles.colorButton, { backgroundColor: theme.colors?.[item.key] || '#000' }]}
              >
                <Text style={{ color: '#fff' }}>{theme.colors?.[item.key] || 'N/A'}</Text>
              </ButtonPrimaryApp>
            </View>
          ))}

          <ButtonPrimaryApp onPress={handleResetTheme} style={styles.resetButton}>
            Reset to Default
          </ButtonPrimaryApp>
        </Card.Content>
      </Card>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Edit {selectedColorKey}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Color (hex)"
              value={colorValue}
              onChangeText={setColorValue}
              mode="outlined"
              placeholder="#000000"
            />
            <View style={[styles.previewBox, { backgroundColor: colorValue }]} />
          </Dialog.Content>
          <Dialog.Actions>
            <ButtonPrimaryApp onPress={() => setDialogVisible(false)}>Cancel</ButtonPrimaryApp>
            <ButtonPrimaryApp onPress={handleSaveColor}>Save</ButtonPrimaryApp>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  hint: {
    marginBottom: 12,
    opacity: 0.7,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  colorLabel: {
    fontSize: 16,
    flex: 1,
  },
  colorButton: {
    minWidth: 120,
  },
  resetButton: {
    marginTop: 16,
  },
  previewBox: {
    width: '100%',
    height: 60,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
});
