// The local FAB of ONE card: a small round button on the card; it opens the actions of THAT card (play, create before / after, copy, move, delete ...)
// as mini buttons with their names. Works on the web and on iOS / Android (FABForCardComponent draws its list with a browser portal and `<div>`: web only).
// WEB: the list is NOT in a Modal (a full screen backdrop swallowed the first press on ANOTHER card's FAB: it only closed this list, the second
// press opened the other one). On the web the list is a fixed layer in document.body and a pointer press OUTSIDE it closes it, the press itself
// goes on to the target: another card's FAB opens with ONE press. iOS / Android keep the Modal.
// Only one FAB of the app is open at a time (FABProvider: the main FAB, the other cards); without a provider (a test) it simply works alone.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  const listRef = useRef<any>(null);
  const isWeb = Platform.OS === 'web' && typeof document !== 'undefined';
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

  const close = useCallback(() => { setOpen(false); fab?.notifyFABClose(fabId); }, [fab, fabId]);

  // web: a press outside the list (and outside this button, which toggles by itself) closes it WITHOUT taking the press away from its target
  useEffect(() => {
    if (!isWeb || !open) return undefined;
    const inside = (t: any) => !!(listRef.current?.contains?.(t) || buttonRef.current?.contains?.(t));
    const onDown = (e: Event) => { if (!inside(e.target)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onScroll = (e: Event) => { if (!inside(e.target)) close(); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [isWeb, open, close]);
  const main = getFabMainColors(customColor);
  const listHeight = actions.length * ACTION_ROW_HEIGHT;
  // the list opens upwards; near the top of the window it opens downwards
  const upwards = !box || box.y > listHeight + 24;
  const listStyle = box
    ? ({ right: Math.max(8, win.width - (box.x + box.w)), ...(upwards ? { bottom: win.height - box.y + 6 } : { top: box.y + box.h + 6 }) } as const)
    : null;

  const renderActions = () => (upwards ? actions.slice().reverse() : actions).map((act, i) => {
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
  });

  return (
    <View ref={buttonRef} collapsable={false} testID={testID}>
      <FABApp testID={`${testID}-button`} icon={open ? 'close' : 'plus'} size="small" style={size === 'small' ? styles.small : styles.medium}
        backgroundColor={main.backgroundColor} color={main.iconColor} onPress={toggle} />
      {open && listStyle ? (isWeb ? (
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('react-dom').createPortal(
          <View ref={listRef} collapsable={false} testID={`${testID}-modal`} style={[styles.list, listStyle, { position: 'fixed', zIndex: 9999999 } as any]}>{renderActions()}</View>,
          document.body,
        )
      ) : (
        <Modal transparent visible animationType="fade" onRequestClose={close} testID={`${testID}-modal`}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" testID={`${testID}-backdrop`} />
          <View style={[styles.list, listStyle]} pointerEvents="box-none">{renderActions()}</View>
        </Modal>
      )) : null}
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
