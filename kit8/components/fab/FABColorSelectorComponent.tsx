import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Button, Portal, Dialog, TextInput, useTheme, Surface } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { setFabColor } from '../../redux/userThemeSlice';
import { CustomLightTheme } from '../../theme/palettes';
import { FAB_DEFAULT_BG, FAB_DEFAULT_ICON } from './fabColors';
import FABApp from '../../../components/common/FABApp';

export interface ColorPreset {
  name: string;
  hex?: string; // undefined means Default Light Theme
}

const FAB_PRESETS: ColorPreset[] = [
  { name: 'Default', hex: undefined },
  { name: 'Purple', hex: '#6750A4' },
  { name: 'Ocean Teal', hex: '#1D827D' },
  { name: 'Emerald', hex: '#2E7D32' },
  { name: 'Sunset', hex: '#E65100' },
  { name: 'Crimson', hex: '#C62828' },
  { name: 'Midnight', hex: '#1A237E' },
  { name: 'Deep Pink', hex: '#C2185B' },
  { name: 'Amethyst', hex: '#7B1FA2' },
];

export const FABColorSelectorComponent: React.FC = () => {
  const paperTheme = useTheme();
  const dispatch = useDispatch();
  const userTheme = useSelector((state: any) => state.userTheme);
  const currentFabColor = userTheme?.fabColor;

  const [dialogVisible, setDialogVisible] = useState(false);
  const [customHex, setCustomHex] = useState(currentFabColor || '#6750A4');

  const handleSelectPreset = (hex?: string) => {
    dispatch(setFabColor(hex));
  };

  const handleSaveCustom = () => {
    if (customHex && customHex.startsWith('#')) {
      dispatch(setFabColor(customHex));
    }
    setDialogVisible(false);
  };

  const handleReset = () => {
    dispatch(setFabColor(undefined));
  };

  const activeColor = currentFabColor || FAB_DEFAULT_BG;

  return (
    <Card style={styles.card} mode="elevated" elevation={2}>
      <Card.Title
        title="FAB (Floating Action Button) Colors"
        titleStyle={{ fontWeight: '700', fontSize: 16, color: paperTheme.colors.primary }}
        subtitle="Select a custom color palette for all FAB buttons"
      />
      <Card.Content>
        {/* Color Swatches Grid */}
        <View style={styles.swatchGrid}>
          {FAB_PRESETS.map((preset, idx) => {
            const isSelected = preset.hex === currentFabColor;
            const bg = preset.hex || FAB_DEFAULT_BG;
            const iconColor = FAB_DEFAULT_ICON;

            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={() => handleSelectPreset(preset.hex)}
                style={[
                  styles.swatchItem,
                  { backgroundColor: bg },
                  isSelected && styles.selectedSwatch,
                ]}
              >
                {isSelected ? (
                  <MaterialCommunityIcons name="check" size={20} color={iconColor} />
                ) : (
                  <Text style={[styles.swatchText, { color: iconColor }]}>
                    {preset.name[0]}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Button
            mode="outlined"
            icon="palette-outline"
            onPress={() => {
              setCustomHex(currentFabColor || '#6750A4');
              setDialogVisible(true);
            }}
            compact
          >
            Custom Hex
          </Button>

          <Button
            mode="text"
            onPress={handleReset}
            disabled={!currentFabColor}
            compact
          >
            Reset Default
          </Button>
        </View>

        {/* Live Preview Box */}
        <Surface style={styles.previewContainer} elevation={1}>
          <Text style={{ fontSize: 13, opacity: 0.8, color: paperTheme.colors.onSurface }}>
            Active FAB Color:
          </Text>
          <View style={styles.previewRow}>
            <FABApp icon="plus" size="small" backgroundColor={activeColor} onPress={() => {}} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: paperTheme.colors.onSurface }}>
              {currentFabColor ? currentFabColor.toUpperCase() : 'Default Light Purple'}
            </Text>
          </View>
        </Surface>
      </Card.Content>

      {/* Custom Color Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Enter Custom FAB Color</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Color Code (Hex)"
              value={customHex}
              onChangeText={setCustomHex}
              mode="outlined"
              placeholder="#6750A4"
            />
            <View style={[styles.dialogPreviewBox, { backgroundColor: customHex || '#6750A4' }]} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveCustom}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 12,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 12,
    justifyContent: 'flex-start',
  },
  swatchItem: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.25)',
  },
  selectedSwatch: {
    borderWidth: 3,
    borderColor: '#000000',
  },
  swatchText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  previewContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  dialogPreviewBox: {
    width: '100%',
    height: 50,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
});

export default FABColorSelectorComponent;
