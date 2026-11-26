// ReusableList - the select-rows column at the LEFT edge of a row (shown while the ring button of the toolbar is on): an arrow up, the round check box, an arrow down.
// The arrows move the row one place (same command as "Move up / down" of the row menu), the circle selects it. The header of the selection strip draws its select-all circle
// in a column of the SAME width, so every circle stands on ONE vertical line.
// Reads only its own flag from the selection store: a tap re-renders one column, never the list. No state of its own (FlashList recycles cells).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import IconApp from '../../common/IconApp';
import { SelectionStore, useIsSelected } from './listStores';

export const SELECT_COLUMN_WIDTH = 40;
export const SELECT_CIRCLE_SIZE = 22;

/** the round check box (a circle): empty = off, filled with ✓ = all, filled with − = some (the select-all circle of the header) */
export function SelectCircle({ checked, partial, testID, borderColor, primary, onPress }: { checked: boolean; partial?: boolean; testID: string; borderColor: string; primary: string; onPress: () => void }) {
  const on = checked || !!partial;
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" aria-checked={partial ? 'mixed' : checked} hitSlop={8} onPress={onPress}
      style={[styles.circle, { borderColor: on ? primary : borderColor, backgroundColor: on ? primary : 'transparent' }]}>
      {on ? <Text style={styles.tick}>{partial && !checked ? '−' : '✓'}</Text> : null}
    </Pressable>
  );
}

interface RowProps {
  selection: SelectionStore;
  guid: string;
  /** the list's testID: the circle is `<testID>-check-<guid>`, the arrows `<testID>-up-<guid>` / `-down-<guid>` */
  testID: string;
  color: string;
  primary: string;
  index: number;
  /** how many rows the shown list has (the last row cannot go down) */
  count: () => number;
  /** the arrows work (sorted by the list order, no search / filter / sort) */
  moveEnabled: boolean;
  onMove: (guid: string, delta: -1 | 1) => void;
}

function RowSelectColumn({ selection, guid, testID, color, primary, index, count, moveEnabled, onMove }: RowProps) {
  const selected = useIsSelected(selection, guid);
  const upOn = moveEnabled && index > 0;
  const downOn = moveEnabled && index < count() - 1;
  return (
    <View style={styles.column}>
      <Pressable testID={`${testID}-up-${guid}`} accessibilityLabel="Move up" disabled={!upOn} hitSlop={4} onPress={() => onMove(guid, -1)} style={[styles.arrow, { opacity: upOn ? 0.75 : 0.2 }]}>
        <IconApp name="keyboard_arrow_up" size={20} color={color} />
      </Pressable>
      <SelectCircle checked={selected} testID={`${testID}-check-${guid}`} borderColor={color + '66'} primary={primary} onPress={() => selection.toggle(guid)} />
      <Pressable testID={`${testID}-down-${guid}`} accessibilityLabel="Move down" disabled={!downOn} hitSlop={4} onPress={() => onMove(guid, 1)} style={[styles.arrow, { opacity: downOn ? 0.75 : 0.2 }]}>
        <IconApp name="keyboard_arrow_down" size={20} color={color} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: SELECT_COLUMN_WIDTH, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: SELECT_COLUMN_WIDTH, height: 20, alignItems: 'center', justifyContent: 'center' },
  circle: { width: SELECT_CIRCLE_SIZE, height: SELECT_CIRCLE_SIZE, borderRadius: SELECT_CIRCLE_SIZE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  tick: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
});

export default React.memo(RowSelectColumn);
