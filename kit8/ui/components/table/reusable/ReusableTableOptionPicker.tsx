// ReusableTable - the picker of a select / multiSelect cell: a window with a search box (from 8 options on),
// the options (color dot + label + hint) and, for multiSelect, check boxes + "Done".
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import type { SelectOption } from './reusableTableTypes';
import { filterOptions } from './tableRows';

export interface ReusableTableOptionPickerProps {
  title: string;
  options: SelectOption[];
  multi: boolean;
  /** the values chosen now */
  selected: string[];
  /** select: offer "— none —" */
  allowEmpty?: boolean;
  onPick: (values: string[]) => void;
  onClose: () => void;
  testID: string;
}

export { filterOptions };

export default function ReusableTableOptionPicker({ title, options, multi, selected, allowEmpty = true, onPick, onClose, testID }: ReusableTableOptionPickerProps) {
  const { themeColors: c } = useDesignSystem();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>(selected);
  const shown = useMemo(() => filterOptions(options, query), [options, query]);
  const toggle = (v: string) => setChosen((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const renderItem = ({ item }: { item: SelectOption }) => {
    const on = multi ? chosen.includes(item.value) : selected[0] === item.value;
    return (
      <Pressable testID={`${testID}-option-${item.value}`} onPress={() => (multi ? toggle(item.value) : onPick([item.value]))}
        style={({ hovered }: any) => [styles.item, { backgroundColor: on ? c.primary + '18' : hovered ? c.primary + '0d' : 'transparent', borderBottomColor: c.border }]}>
        {multi && (
          <View style={[styles.box, { borderColor: on ? c.primary : c.text + '80', backgroundColor: on ? c.primary : 'transparent' }]}>
            {on ? <Text style={styles.tick}>✓</Text> : null}
          </View>
        )}
        {item.color ? <View style={[styles.dot, { backgroundColor: item.color, borderColor: c.border }]} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: on ? c.primary : c.text, fontWeight: on ? '700' : '400', fontSize: 14 }}>{item.label}</Text>
          {!!item.hint && <Text numberOfLines={1} style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{item.hint}</Text>}
        </View>
        {!multi && on ? <Text style={{ color: c.primary }}>✓</Text> : null}
      </Pressable>
    );
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`}>
        <Pressable testID={testID} style={[styles.window, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => {}}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{title}</Text>
          {options.length >= 8 && (
            <TextInput testID={`${testID}-search`} value={query} onChangeText={setQuery} placeholder="Search…" placeholderTextColor={c.text + '60'} autoFocus={Platform.OS === 'web'}
              style={[styles.search, { color: c.text, borderColor: c.border }]} />
          )}
          {!multi && allowEmpty && (
            <Pressable testID={`${testID}-none`} onPress={() => onPick([])} style={[styles.item, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.text, opacity: 0.6, fontStyle: 'italic' }}>— none —</Text>
            </Pressable>
          )}
          <FlatList data={shown} keyExtractor={(o) => o.value} renderItem={renderItem} style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, padding: 12 }}>{options.length ? 'No matches found.' : 'No options yet.'}</Text>} />
          {multi && (
            <View style={styles.buttons}>
              <Pressable testID={`${testID}-clear`} onPress={() => setChosen([])} style={[styles.btn, { borderColor: c.border }]}><Text style={{ color: c.text }}>Clear</Text></Pressable>
              <Pressable testID={`${testID}-done`} onPress={() => onPick(options.map((o) => o.value).filter((v) => chosen.includes(v)).concat(chosen.filter((v) => !options.some((o) => o.value === v))))}
                style={[styles.btn, { borderColor: c.primary, backgroundColor: c.primary }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  window: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 12, paddingVertical: 12, overflow: 'hidden' },
  title: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  search: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 36, fontSize: 14, ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }) },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  box: { width: 18, height: 18, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' },
});
