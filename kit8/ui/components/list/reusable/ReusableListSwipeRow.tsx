// ReusableList - swipe actions around ONE item (the default item or a custom card). iOS, Android and the web run the same code (PanResponder, like the grip).
// What each direction does is the setting of the list (swipeModel.ts): archive | delete, with a STOP at the button (press it) or the card DISAPPEARS (a long swipe runs it at once).
// Only one item is open at a time (the `open` store); a recycled cell must not keep a swipe: the position is reset when the row (guid) changes.
// An archived row shows the small Archive icon at the bottom left of the card (tip on hover / press), also when swipe is off.
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import IconApp from '../../common/IconApp';
import { hidePMTip, showPMTip, usePMTip } from '../../../../pm/inner/tooltip/PMTooltip';
import type { DragStore } from './listStores';
import { clampSwipe, SWIPE_ACTION_WIDTH, SwipeAction, SwipeConfig, SwipeDirection, SwipeInset, swipeAllowed, swipeOutcome } from './swipeModel';

export const SWIPE_ARCHIVE_COLOR = '#f57f17';
export const SWIPE_DELETE_COLOR = '#d32f2f';

export interface ReusableListSwipeRowProps {
  guid: string;
  archived: boolean;
  /** null = no swipe (the row only shows the archived mark) */
  swipe: SwipeConfig | null;
  /** archived rows live on their own tab: an archive / unarchive swipe takes the card out of THIS tab, so it stays out after the swipe */
  hideOnArchive: boolean;
  /** the guid of the item that is open now (shared by all items of the list) */
  openStore: DragStore;
  background: string;
  /** the visible card is inset inside the item: the buttons are drawn under the card itself */
  inset?: SwipeInset;
  testID: string;
  onArchive: (guid: string, archived: boolean) => void;
  onDelete: (guid: string) => void;
  children: React.ReactNode;
}

const labelOf = (action: SwipeAction, archived: boolean) => (action === 'delete' ? 'Delete' : archived ? 'Unarchive' : 'Archive');

function ReusableListSwipeRow({ guid, archived, swipe, hideOnArchive, openStore, background, inset, testID, onArchive, onDelete, children }: ReusableListSwipeRowProps) {
  const x = useRef(new Animated.Value(0)).current;
  const cur = useRef(0);
  const base = useRef(0);
  /** PanResponder starts counting dx when it takes the gesture; the distance moved before that is added back */
  const lead = useRef(0);
  const width = useRef(0);
  const openSide = useRef<SwipeDirection | null>(null);
  const [open, setOpen] = useState<SwipeDirection | null>(null);
  const live = useRef({ guid, archived, swipe, hideOnArchive, onArchive, onDelete });
  live.current = { guid, archived, swipe, hideOnArchive, onArchive, onDelete };
  const ix = inset?.x ?? 0;
  const iy = inset?.y ?? 0;
  const insetStyle = inset ? { left: ix, right: ix, top: iy, bottom: iy, borderRadius: inset.radius ?? 0, overflow: 'hidden' as const } : null;
  const archiveDirection = swipe?.ltr?.action === 'archive' ? 'right' : swipe?.rtl?.action === 'archive' ? 'left' : null;
  const archivedTip = archiveDirection ? `Archived. Swipe ${archiveDirection} to restore.` : 'Archived';
  const markTip = usePMTip(archivedTip, 'app');
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current); }, []);
  /** a press (finger or click) shows the tip at once, for 2.5 s; hover (web) and long press come from usePMTip */
  const showMarkTip = () => {
    (markTip.ref.current as any)?.measureInWindow?.((mx: number, my: number, mw: number, mh: number) => showPMTip(archivedTip, mx, my, mw, mh, 0, 'app'));
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(hidePMTip, 2500);
  };
  const openGuid = useSyncExternalStore(openStore.subscribe, openStore.get, () => null);

  useEffect(() => { const id = x.addListener(({ value }) => { cur.current = value; }); return () => x.removeListener(id); }, [x]);

  const animateTo = useCallback((to: number, ms: number, done?: () => void) => {
    Animated.timing(x, { toValue: to, duration: ms, useNativeDriver: false }).start(() => done?.());
  }, [x]);
  const close = useCallback(() => {
    openSide.current = null; setOpen(null);
    if (openStore.get() === live.current.guid) openStore.set(null);
    animateTo(0, 160);
  }, [animateTo, openStore]);
  /** run the action of a direction; returns it */
  const run = useCallback((direction: SwipeDirection): SwipeAction | null => {
    const l = live.current;
    const action = l.swipe?.[direction]?.action ?? null;
    if (action === 'archive') l.onArchive(l.guid, l.archived); else if (action === 'delete') l.onDelete(l.guid);
    return action;
  }, []);

  // a recycled cell shows another row, or the row changed its archived state (it moved to the other tab / came back into the list): no swipe is carried over
  useEffect(() => { x.stopAnimation(); x.setValue(0); cur.current = 0; base.current = 0; openSide.current = null; setOpen(null); }, [guid, archived, x]);
  // another item was opened (or the list closed it): this one closes
  useEffect(() => { if (openSide.current && openGuid !== guid) close(); }, [openGuid, guid, close]);
  // the swipe was switched off (or its direction changed) while it was open
  useEffect(() => { if (openSide.current && !swipe?.[openSide.current]) close(); }, [swipe, close]);

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => {
      const cfg = live.current.swipe;
      if (!cfg || Math.abs(g.dx) < 8 || Math.abs(g.dx) < Math.abs(g.dy) * 1.5) return false;
      const ok = swipeAllowed(cur.current + g.dx, cfg) || openSide.current !== null;
      if (ok) lead.current = g.dx;
      return ok;
    },
    // the list must not take the touch away while the item is dragged sideways
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => {
      base.current = cur.current + lead.current;
      const cfg = live.current.swipe;
      if (cfg) x.setValue(clampSwipe(base.current, width.current, cfg));
      openStore.set(live.current.guid);
    },
    onPanResponderMove: (_e, g) => { const cfg = live.current.swipe; if (cfg) x.setValue(clampSwipe(base.current + g.dx, width.current, cfg)); },
    onPanResponderRelease: (_e, g) => {
      const cfg = live.current.swipe;
      if (!cfg) { close(); return; }
      const at = clampSwipe(base.current + g.dx, width.current, cfg);
      const out = swipeOutcome(at, g.vx, width.current, cfg);
      if (out.kind === 'run') {
        // the card slides out, the action runs, the card comes back - unless the action takes the row out of this tab (it stays out; the list drops it)
        const dir = out.direction === 'ltr' ? 1 : -1;
        openSide.current = null; setOpen(null);
        animateTo(dir * Math.max(width.current, SWIPE_ACTION_WIDTH), 140, () => {
          const action = run(out.direction);
          const stays = action === 'archive' && live.current.hideOnArchive;
          if (openStore.get() === live.current.guid) openStore.set(null);
          // a question may follow (delete): the card returns once it is answered / the row is gone. A card that left its tab is dropped by the list within a frame;
          // if it is still here after a moment (the change was refused) it must not stay out: it slides back
          setTimeout(() => animateTo(0, 160), stays ? 700 : 200);
        });
      } else if (out.kind === 'open') {
        openSide.current = out.direction; setOpen(out.direction);
        animateTo((out.direction === 'ltr' ? 1 : -1) * SWIPE_ACTION_WIDTH, 140);
      } else close();
    },
    onPanResponderTerminate: () => close(),
  })).current;

  const pressAction = (direction: SwipeDirection) => { close(); run(direction); };
  const webStyle = Platform.OS === 'web' ? ({ touchAction: 'pan-y', userSelect: 'none' } as any) : null;
  const a11y = swipe ? ([swipe.ltr, swipe.rtl].filter(Boolean) as { action: SwipeAction }[]).map((s) => ({ name: s.action, label: labelOf(s.action, archived) })) : undefined;
  const button = (direction: SwipeDirection) => {
    const side = swipe?.[direction];
    if (!side) return <View />;
    return (
      <Pressable key={direction} testID={`${testID}-swipe-${side.action}-${guid}`} accessibilityRole="button" accessibilityLabel={labelOf(side.action, archived)} onPress={() => pressAction(direction)}
        style={[styles.action, { backgroundColor: side.action === 'delete' ? SWIPE_DELETE_COLOR : SWIPE_ARCHIVE_COLOR }]}>
        <IconApp name={side.action === 'delete' ? 'delete' : archived ? 'unarchive' : 'archive'} size={22} color="#fff" />
        <Text style={styles.actionText}>{labelOf(side.action, archived)}</Text>
      </Pressable>
    );
  };

  return (
    <View
      testID={`${testID}-swipe-${guid}`}
      onLayout={(e) => { width.current = e.nativeEvent.layout.width; }}
      accessibilityActions={a11y}
      onAccessibilityAction={(e) => { const n = e.nativeEvent.actionName; if (swipe?.ltr?.action === n) run('ltr'); else if (swipe?.rtl?.action === n) run('rtl'); }}
      style={[styles.root, webStyle]}
    >
      {swipe ? (
        <View style={[StyleSheet.absoluteFill, insetStyle]} pointerEvents="box-none">
          <View style={styles.underlay} pointerEvents="box-none">
            {button('ltr')}
            {button('rtl')}
          </View>
        </View>
      ) : null}
      <Animated.View {...responder.panHandlers} style={[styles.front, { backgroundColor: inset ? 'transparent' : background, transform: [{ translateX: x }] }]}>
        {children}
        {archived ? (
          <Pressable {...(markTip as any)} testID={`${testID}-archived-${guid}`} accessibilityRole="button" accessibilityLabel="Archived" hitSlop={8} onPress={showMarkTip}
            style={[styles.mark, { left: 12 + ix, bottom: 6 + iy }]}>
            <IconApp name="archive" size={16} color={SWIPE_ARCHIVE_COLOR} />
          </Pressable>
        ) : null}
        {open ? <Pressable testID={`${testID}-swipe-close-${guid}`} accessibilityLabel="Close" onPress={close} style={styles.closeCover} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', width: '100%', overflow: 'hidden' },
  underlay: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  action: { width: SWIPE_ACTION_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  front: { position: 'relative', zIndex: 1 },
  mark: { position: 'absolute', zIndex: 7 },
  closeCover: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 3 },
});

export default React.memo(ReusableListSwipeRow);
