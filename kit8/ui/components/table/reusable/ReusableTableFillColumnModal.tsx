// ReusableTable - "Fill all lines" modal for a column header context menu.
// Allows picking a catalog element, choosing an option, or entering a primitive value,
// with "Cancel" and "Fill" buttons.
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import SelectElementFromCatalog from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import type { VisualColumn } from './reusableTableTypes';
import { optionsOf } from './tableRows';

export interface ReusableTableFillColumnModalProps {
  visible: boolean;
  col: VisualColumn;
  onCancel: () => void;
  onFill: (value: any) => void;
  testID: string;
}

export default function ReusableTableFillColumnModal({ visible, col, onCancel, onFill, testID }: ReusableTableFillColumnModalProps) {
  const { themeColors: c, isDark } = useDesignSystem();
  const [val, setVal] = useState<any>(col.type === 'boolean' ? false : '');

  if (!visible) return null;

  const id = (s: string) => `${testID}-fill-${s}`;

  const handleFill = () => {
    let result: any = val;
    if (col.type === 'integer') {
      const parsed = parseInt(String(val), 10);
      result = isNaN(parsed) ? 0 : parsed;
    } else if (col.type === 'number') {
      const parsed = parseFloat(String(val));
      result = isNaN(parsed) ? 0 : parsed;
    } else if (col.type === 'boolean') {
      result = Boolean(val);
    }
    onFill(result);
  };

  const renderInput = () => {
    if (col.type === 'catalog') {
      return (
        <View style={styles.fieldWrap}>
          <SelectElementFromCatalog
            testID={id('catalog-select')}
            entityName={col.catalogEntityName}
            value={val || null}
            onChange={(guid) => setVal(guid)}
            rowOwnerGUID={col.catalogRowOwnerGUID}
            rowParentGUID={col.catalogRowParentGUID}
            scopeFetchByOwner={false}
            placeholder={col.placeholder ?? 'Select catalog element…'}
            {...(col.titleExtractor ? { titleExtractor: col.titleExtractor } : {})}
            {...(col.subtitleExtractor ? { subtitleExtractor: col.subtitleExtractor } : {})}
          />
        </View>
      );
    }

    if (col.type === 'select' || col.type === 'multiSelect') {
      const opts = optionsOf(col, null);
      return (
        <View style={styles.optionsWrap}>
          {opts.map((opt) => {
            const isSelected = val === opt.value;
            return (
              <Pressable
                key={opt.value}
                testID={id(`option-${opt.value}`)}
                onPress={() => setVal(opt.value)}
                style={[
                  styles.optionChip,
                  {
                    borderColor: isSelected ? c.primary : c.border,
                    backgroundColor: isSelected ? c.primary + '22' : 'transparent',
                  },
                ]}
              >
                {!!opt.color && <View style={[styles.dot, { backgroundColor: opt.color }]} />}
                <Text style={{ color: isSelected ? c.primary : c.text, fontWeight: isSelected ? '700' : '400', fontSize: 13 }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    if (col.type === 'boolean') {
      const boolVal = Boolean(val);
      return (
        <View style={styles.boolRow}>
          <Pressable
            testID={id('bool-true')}
            onPress={() => setVal(true)}
            style={[
              styles.boolBtn,
              {
                borderColor: boolVal ? c.primary : c.border,
                backgroundColor: boolVal ? c.primary + '22' : 'transparent',
              },
            ]}
          >
            <Text style={{ color: boolVal ? c.primary : c.text, fontWeight: boolVal ? '700' : '500' }}>Yes (True)</Text>
          </Pressable>
          <Pressable
            testID={id('bool-false')}
            onPress={() => setVal(false)}
            style={[
              styles.boolBtn,
              {
                borderColor: !boolVal ? c.primary : c.border,
                backgroundColor: !boolVal ? c.primary + '22' : 'transparent',
              },
            ]}
          >
            <Text style={{ color: !boolVal ? c.primary : c.text, fontWeight: !boolVal ? '700' : '500' }}>No (False)</Text>
          </Pressable>
        </View>
      );
    }

    const isNumeric = col.type === 'integer' || col.type === 'number';
    return (
      <View style={styles.fieldWrap}>
        <TextInput
          testID={id('input')}
          value={String(val ?? '')}
          onChangeText={setVal}
          placeholder={col.placeholder ?? (isNumeric ? 'Enter number…' : 'Enter value…')}
          placeholderTextColor={c.text + '70'}
          keyboardType={isNumeric ? 'decimal-pad' : 'default'}
          autoFocus
          style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} testID={id('modal')}>
      <View style={styles.backdrop}>
        <Pressable testID={id('backdrop')} style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? c.surface : '#ffffff',
              borderColor: c.border,
            },
          ]}
          testID={id('card')}
        >
          <Text style={[styles.title, { color: c.text }]} testID={id('title')}>
            Fill all lines
          </Text>
          <Text style={[styles.subtitle, { color: c.text + '99' }]} testID={id('subtitle')}>
            Set value for column &quot;{col.title}&quot; across all lines:
          </Text>

          {renderInput()}

          <View style={styles.buttonRow}>
            <Pressable testID={id('cancel')} onPress={onCancel} style={[styles.btn, styles.cancelBtn, { borderColor: c.border }]}>
              <Text style={[styles.btnText, { color: c.text }]}>Cancel</Text>
            </Pressable>
            <Pressable testID={id('confirm')} onPress={handleFill} style={[styles.btn, styles.fillBtn, { backgroundColor: c.primary, borderColor: c.primary }]}>
              <Text style={[styles.btnText, { color: '#ffffff', fontWeight: '700' }]}>Fill</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  fieldWrap: {
    marginBottom: 20,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  boolRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  boolBtn: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    minWidth: 80,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cancelBtn: {},
  fillBtn: {},
  btnText: {
    fontSize: 14,
  },
});
