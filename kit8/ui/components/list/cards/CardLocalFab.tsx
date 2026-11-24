// The local FAB of ONE card: a small round button on the card; it opens the actions of THAT card (play, create before / after, copy, move, delete ...)
// as mini buttons with their names. Works on the web and on iOS / Android (FABForCardComponent draws its list with a browser portal and `<div>`: web only).
// Only one FAB of the app is open at a time (FABProvider: the main FAB, the other cards); without a provider (a test) it simply works alone.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import FABApp from '../../common/FABApp';
import { useFAB } from '../../../../providers/FABProvider';
import { getFabMainColors, getFabMiniColors } from '../../fab/fabColors';

export interface CardFabAction {
  icon: string;
  label: string;
  onPress: () => void;
  /** a danger color (delete) */
  color?: string;
  testID?: string;
}

export interface CardLocalFabProps {
  /** the card (its row guid): the id of this FAB in the FABProvider and in the test ids */
  id: string;
  actions: CardFabAction[];
  size?: 'small' | 'medium';
  testID?: string;
}

const ACTION_ROW_HEIGHT = 52;

/** the provider is missing in a test: the FAB then lives alone */
function useOptionalFAB() {
  try { return useFAB(); } catch { return null; }
}

export default function CardLocalFab({ id, actions, size = 'small', testID = `card-fab-${id}` }: CardLocalFabProps) {
  const paper = useTheme();
  const win = useWindowDimensions();
  const fab = useOptionalFAB();
  const customColor = useSelector((s: any) => s?.userTheme?.fabColor);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const buttonRef = useRef<any>(null);
  const fabId = `card-fab-${id}`;

  useEffect(() => {
    if (!fab) return undefined;
    return fab.registerFAB(fabId, (openId) => { if (openId !== fabId) setOpen(false); });
  }, [fab, fabId]);

  const toggle = useCallback(() => {
    if (open) { setOpen(false); fab?.notifyFABClose(fabId); return; }
    const show = (x: number, y: number, w: number, h: number) => { setBox({ x, y, w, h }); setOpen(true); fab?.notifyFABOpen(fabId); };
    const node = buttonRef.current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, w: number, h: number) => show(x, y, w, h));
    else show(win.width - 60, 200, 40, 40);
  }, [open, fab, fabId, win.width]);

  const close = () => { setOpen(false); fab?.notifyFABClose(fabId); };
  const main = getFabMainColors(customColor);
  const listHeight = actions.length * ACTION_ROW_HEIGHT;
  // the list opens upwards; near the top of the window it opens downwards
  const upwards = !box || box.y > listHeight + 24;
  const listStyle = box
    ? ({ right: Math.max(8, win.width - (box.x + box.w)), ...(upwards ? { bottom: win.height - box.y + 6 } : { top: box.y + box.h + 6 }) } as const)
    : null;

  return (
    <View ref={buttonRef} collapsable={false} testID={testID}>
      <FABApp testID={`${testID}-button`} icon={open ? 'close' : 'plus'} size="small" style={size === 'small' ? styles.small : styles.medium}
        backgroundColor={main.backgroundColor} color={main.iconColor} onPress={toggle} />
      {open && listStyle ? (
        <Modal transparent visible animationType="fade" onRequestClose={close} testID={`${testID}-modal`}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" testID={`${testID}-backdrop`} />
          <View style={[styles.list, listStyle]} pointerEvents="box-none">
            {(upwards ? actions.slice().reverse() : actions).map((act, i) => {
              const mini = getFabMiniColors(customColor, act.color);
              return (
                <View key={`${act.label}-${i}`} style={styles.row}>
                  <Surface elevation={2} style={[styles.label, { backgroundColor: paper.colors.surfaceVariant || paper.colors.surface }]}>
                    <Text style={{ color: paper.colors.onSurfaceVariant || paper.colors.onSurface, fontSize: 13 }}>{act.label}</Text>
                  </Surface>
                  <FABApp testID={act.testID ?? `${testID}-action-${act.label}`} icon={act.icon} size="small" style={styles.mini}
                    backgroundColor={mini.backgroundColor} color={mini.iconColor}
                    onPress={() => { close(); act.onPress(); }} />
                </View>
              );
            })}
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  small: { borderRadius: 12, width: 40, height: 40, margin: 0 },
  medium: { borderRadius: 16 },
  list: { position: 'absolute', alignItems: 'flex-end', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', height: 44 },
  label: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  mini: { marginLeft: 8, borderRadius: 12 },
});
