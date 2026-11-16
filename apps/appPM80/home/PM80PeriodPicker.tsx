import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import PM80Tip from './PM80Tip';
import {
  PM80_MONTH_NAMES,
  PM80_YEARS,
  PM80Period,
  PM80_TIPS,
} from './pm80HomeModel';

export interface PM80PeriodPickerProps {
  period: PM80Period;
  onChange: (period: PM80Period) => void;
  isDark: boolean;
  textStrong: string;
  textMuted: string;
  accent: string;
  borderColor: string;
  /** look of the two pills (Paper: filled, Tamagui: with a border) */
  pillBackground: string;
  pillBorderColor?: string;
  testID?: string;
}

type Which = 'month' | 'year' | null;

/**
 * The month and the year are TWO inputs: a press on the month name opens the list of the 12 months, a press on the
 * year opens the list of the years. A choice applies at once and closes the list.
 */
export default function PM80PeriodPicker({
  period,
  onChange,
  isDark,
  textStrong,
  textMuted,
  accent,
  borderColor,
  pillBackground,
  pillBorderColor,
  testID = 'pm80-period',
}: PM80PeriodPickerProps) {
  const [open, setOpen] = useState<Which>(null);
  const sheetBg = isDark ? '#1D1B20' : '#FFFFFF';
  const rowSelectedBg = isDark ? '#2B2930' : '#F3EDF7';

  const pill = (which: 'month' | 'year', label: string, tip: string) => (
    <PM80Tip tip={tip}>
      <TouchableOpacity
        testID={`${testID}-${which}-pill`}
        accessibilityLabel={`${which === 'month' ? 'Month' : 'Year'}: ${label}`}
        activeOpacity={0.85}
        onPress={() => setOpen(which)}
        style={[
          styles.pill,
          {
            backgroundColor: pillBackground,
            borderColor: pillBorderColor ?? 'transparent',
            borderWidth: pillBorderColor ? 1 : 0,
          },
        ]}
      >
        <Text style={[styles.pillText, { color: textStrong }]}>{label}</Text>
        <MaterialCommunityIcons name={'chevron-down' as any} size={17} color={textMuted} />
      </TouchableOpacity>
    </PM80Tip>
  );

  const row = (
    key: string,
    id: string,
    text: string,
    selected: boolean,
    onPick: () => void
  ) => (
    <TouchableOpacity
      key={key}
      testID={id}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      activeOpacity={0.8}
      onPress={onPick}
      style={[styles.row, selected && { backgroundColor: rowSelectedBg }]}
    >
      <MaterialCommunityIcons
        name={(selected ? 'radiobox-marked' : 'radiobox-blank') as any}
        size={20}
        color={selected ? accent : textMuted}
      />
      <Text style={[styles.rowText, { color: textStrong, fontWeight: selected ? '800' : '500' }]}>
        {text}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.pills}>
        {pill('month', PM80_MONTH_NAMES[period.month - 1].toUpperCase(), PM80_TIPS.monthPill)}
        {pill('year', String(period.year), PM80_TIPS.yearPill)}
      </View>

      <Modal
        visible={open !== null}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)} testID={`${testID}-backdrop`}>
          <Pressable
            testID={`${testID}-${open ?? 'month'}-modal`}
            onPress={() => undefined}
            style={[styles.sheet, { backgroundColor: sheetBg, borderColor }]}
          >
            <Text style={[styles.title, { color: textStrong }]}>
              {open === 'year' ? 'Year' : 'Month'}
            </Text>
            <ScrollView style={styles.list}>
              {open === 'month' &&
                PM80_MONTH_NAMES.map((name, i) =>
                  row(
                    name,
                    `${testID}-month-item-${i + 1}`,
                    name,
                    period.month === i + 1,
                    () => {
                      onChange({ year: period.year, month: i + 1 });
                      setOpen(null);
                    }
                  )
                )}
              {open === 'year' &&
                PM80_YEARS.map((y) =>
                  row(
                    String(y),
                    `${testID}-year-item-${y}`,
                    String(y),
                    period.year === y,
                    () => {
                      onChange({ year: y, month: period.month });
                      setOpen(null);
                    }
                  )
                )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 6,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rowText: {
    fontSize: 15,
  },
});
