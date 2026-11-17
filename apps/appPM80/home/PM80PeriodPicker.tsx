import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import PM80Tip from './PM80Tip';
import { hidePMTip } from '../../../kit8/pm/inner/tooltip/PMTooltip';
import { useWindowDimensions } from 'react-native';
import { createDoubleTap } from '../../../kit8/ui/calendar/doubleTap';
import {
  PM80_MONTH_NAMES,
  pm80YearList,
  parseYearInput,
  sanitizeYearText,
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
  const compact = useWindowDimensions().width < 420;
  const [open, setOpen] = useState<Which>(null);
  // double tap on the year = type it (inline input); one tap = the list
  const [editing, setEditing] = useState(false);
  const [yearText, setYearText] = useState('');
  const [yearError, setYearError] = useState<string | null>(null);

  const startEdit = () => {
    hidePMTip(); // the pill goes away: no tip over it
    setYearText(String(period.year));
    setYearError(null);
    setEditing(true);
  };
  const stopEdit = () => {
    setEditing(false);
    setYearError(null);
  };
  /** returns true when the year was valid (and applied) */
  const commitYear = (): boolean => {
    const parsed = parseYearInput(yearText);
    if (!parsed.ok) {
      setYearError(parsed.message);
      return false;
    }
    if (parsed.year !== period.year) onChange({ year: parsed.year, month: period.month });
    stopEdit();
    return true;
  };

  const yearTapRef = useRef<ReturnType<typeof createDoubleTap<string>> | null>(null);
  const handlersRef = useRef({ list: () => setOpen('year'), edit: startEdit });
  handlersRef.current = { list: () => setOpen('year'), edit: startEdit };
  if (!yearTapRef.current) {
    yearTapRef.current = createDoubleTap<string>(
      () => handlersRef.current.list(),
      () => handlersRef.current.edit(),
      (a, b) => a === b
    );
  }
  useEffect(() => () => yearTapRef.current?.cancel(), []);
  const sheetBg = isDark ? '#1D1B20' : '#FFFFFF';
  const rowSelectedBg = isDark ? '#2B2930' : '#F3EDF7';

  const yearInput = (
    <View
      style={[
        styles.yearInputBox,
        {
          backgroundColor: pillBackground,
          borderColor: yearError ? '#DC2626' : accent,
        },
      ]}
    >
      <TextInput
        testID={`${testID}-year-input`}
        accessibilityLabel="Year, 4 digits"
        value={yearText}
        onChangeText={(t) => {
          const clean = sanitizeYearText(t);
          setYearText(clean);
          // 4 digits typed: say at once when the year is not realistic
          const parsed = clean.length === 4 ? parseYearInput(clean) : null;
          setYearError(parsed && !parsed.ok ? parsed.message : null);
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="YYYY"
        placeholderTextColor={textMuted}
        selectionColor={accent}
        maxLength={4}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={commitYear}
        onBlur={() => {
          // leaving the field: a valid year is kept, anything else is dropped (the year stays as it was)
          if (!commitYear()) stopEdit();
        }}
        onKeyPress={(e: any) => {
          if (e?.nativeEvent?.key === 'Escape') stopEdit();
        }}
        style={[styles.yearInputText, { color: textStrong }]}
      />
    </View>
  );

  const pill = (which: 'month' | 'year', label: string, tip: string) => (
    <PM80Tip tip={tip}>
      <TouchableOpacity
        testID={`${testID}-${which}-pill`}
        accessibilityLabel={`${which === 'month' ? 'Month' : 'Year'}: ${label}`}
        activeOpacity={0.85}
        onPress={() => (which === 'year' ? yearTapRef.current!.tap('year') : setOpen(which))}
        style={[
          styles.pill,
          compact && styles.pillCompact,
          {
            backgroundColor: pillBackground,
            borderColor: pillBorderColor ?? 'transparent',
            borderWidth: pillBorderColor ? 1 : 0,
          },
        ]}
      >
        <Text style={[styles.pillText, compact && styles.pillTextCompact, { color: textStrong }]}>{label}</Text>
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
      <View style={styles.pillsColumn}>
        <View style={styles.pills}>
          {pill('month', PM80_MONTH_NAMES[period.month - 1].toUpperCase(), PM80_TIPS.monthPill)}
          {editing ? yearInput : pill('year', String(period.year), PM80_TIPS.yearPill)}
        </View>
        {editing && yearError ? (
          <Text testID={`${testID}-year-error`} style={styles.yearError}>
            {yearError}
          </Text>
        ) : null}
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
                pm80YearList(period.year).map((y) =>
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
  pillsColumn: {
    alignItems: 'center',
  },
  // the year field: as small as 4 digits need (a business form field, not a pill)
  yearInputBox: {
    width: 60,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'center',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  yearInputText: {
    width: 58,
    height: 30,
    padding: 0,
    margin: 0,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    // equal width digits, no browser outline (the box has its own border)
    fontVariant: ['tabular-nums'],
    ...({ outlineStyle: 'none' } as any),
  },
  yearError: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    textAlign: 'center',
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
  },
  pillCompact: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 2,
  },
  pillTextCompact: {
    fontSize: 13,
    letterSpacing: 0.2,
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
