// SelectItemFromListApp - pick ONE item from a list (iOS / Android / web, follows the design system colors).
//
//   <SelectItemFromListApp
//     testID="pm-filter-variant"
//     items={[{ value: 'beginsWith', label: 'Begins with' }, { value: 'between', label: 'Between', description: 'From A to B' }]}
//     value={variant}
//     onSelect={setVariant}
//     trigger="link"            // 'link' = blue "begins with ⌄" (D365 filter style) · 'field' = outlined box (default)
//   />
//
// Best practices built in:
//   * the list opens in its own layer under the trigger (flips above it / clamps to the screen), so it is never
//     clipped by a parent card, modal or scroll view; backdrop / Android back / Esc close it;
//   * the current item is marked (✓ + tint) and scrolled into view; items can have a description, an icon,
//     a group caption and be disabled;
//   * web keyboard: ↑ / ↓ move, Home / End, Enter picks, Esc closes; typing filters when the list is searchable
//     (automatic above 10 items) - the search field is a TextInputApp;
//   * accessibility: the trigger is a "combobox" with its value, items are "menuitem"s with a checked state.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from './IconApp';
import TextInputApp from './TextInputApp';

export interface SelectItemFromListItem<T extends string = string> {
  value: T;
  label: string;
  /** small second line */
  description?: string;
  /** Material symbol name */
  icon?: string;
  disabled?: boolean;
  /** caption shown above this item (starts a group) */
  group?: string;
}

export interface SelectItemFromListAppProps<T extends string = string> {
  items: readonly SelectItemFromListItem<T>[];
  value: T | null | undefined;
  onSelect: (value: T) => void;
  /** 'field' = outlined box with label (default) · 'link' = compact colored text + chevron */
  trigger?: 'field' | 'link';
  /** caption above the field ('field' trigger) */
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** search box above the items (default: more than 10 items) */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** list width (default: max(trigger width, 220)) */
  listWidth?: number;
  /** list max height (default 320) */
  maxListHeight?: number;
  /** list edge aligned with the trigger's left (default) or right edge */
  align?: 'left' | 'right';
  /** trigger text: lower-case label ('link' default true, like D365 "begins with") */
  lowerCaseTrigger?: boolean;
  style?: ViewStyle;
  testID?: string;
  /** called when the list opens / closes */
  onOpenChange?: (open: boolean) => void;
}

const ITEM_H = 38;
const ITEM_H_DESC = 50;
const GROUP_H = 24;
const SEARCH_H = 52;
const GAP = 4;
const EDGE = 8;

interface Anchor {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function SelectItemFromListApp<T extends string = string>({
  items,
  value,
  onSelect,
  trigger = 'field',
  label,
  placeholder = 'Select…',
  disabled = false,
  searchable,
  searchPlaceholder = 'Search…',
  listWidth,
  maxListHeight = 320,
  align = 'left',
  lowerCaseTrigger,
  style,
  testID = 'SelectItemFromListApp',
  onOpenChange,
}: SelectItemFromListAppProps<T>) {
  const { themeColors: c, isDark } = useDesignSystem();
  const win = useWindowDimensions();
  const triggerRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const activeRef = useRef(active);
  activeRef.current = active;

  const selected = items.find((i) => i.value === value);
  const isSearchable = searchable ?? items.length > 10;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label} ${i.description ?? ''} ${i.value}`.toLowerCase().includes(q));
  }, [items, query]);

  const setOpenState = useCallback(
    (v: boolean) => {
      setOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange]
  );

  const show = () => {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, items.findIndex((i) => i.value === value)));
    setOpenState(true);
    // open at once (fallback position), then place it exactly under the trigger
    triggerRef.current?.measureInWindow?.((x, y, w, h) => {
      if (Number.isFinite(x) && Number.isFinite(y)) setAnchor({ x, y, w, h });
    });
  };
  const close = useCallback(() => setOpenState(false), [setOpenState]);
  const pick = useCallback(
    (item: SelectItemFromListItem<T> | undefined) => {
      if (!item || item.disabled) return;
      close();
      if (item.value !== value) onSelect(item.value);
    },
    [close, onSelect, value]
  );

  // keep the active item valid when the search narrows the list
  useEffect(() => {
    if (!open) return;
    setActive((a) => (shown.length ? Math.min(Math.max(a, 0), shown.length - 1) : -1));
  }, [shown, open]);

  // web keyboard
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const step = (d: number) => {
        e.preventDefault();
        setActive((a) => {
          if (!shown.length) return -1;
          let i = a;
          for (let n = 0; n < shown.length; n++) {
            i = (i + d + shown.length) % shown.length;
            if (!shown[i].disabled) return i;
          }
          return a;
        });
      };
      if (e.key === 'ArrowDown') step(1);
      else if (e.key === 'ArrowUp') step(-1);
      else if (e.key === 'Home') setActive(0);
      else if (e.key === 'End') setActive(shown.length - 1);
      else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        pick(shown[activeRef.current]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, shown, pick, close]);

  // ---- list geometry --------------------------------------------------------------------
  const rowH = (i: SelectItemFromListItem<T>) => (i.description ? ITEM_H_DESC : ITEM_H) + (i.group ? GROUP_H : 0);
  const contentH = shown.reduce((s, i) => s + rowH(i), 0) + (shown.length ? 0 : ITEM_H) + 8;
  const width = Math.min(win.width - 2 * EDGE, Math.max(listWidth ?? 0, anchor?.w ?? 0, 220));
  const a = anchor ?? { x: EDGE, y: EDGE, w: width, h: 0 };
  const below = win.height - (a.y + a.h) - GAP - EDGE;
  const above = a.y - GAP - EDGE;
  const wanted = Math.min(maxListHeight, contentH + (isSearchable ? SEARCH_H : 0));
  const openUp = below < Math.min(wanted, 160) && above > below;
  const height = Math.max(ITEM_H + 8, Math.min(wanted, openUp ? above : below));
  const left = Math.max(EDGE, Math.min(align === 'right' ? a.x + a.w - width : a.x, win.width - width - EDGE));
  const top = openUp ? a.y - GAP - height : a.y + a.h + GAP;

  // scroll the current item into view when the list opens
  useEffect(() => {
    if (!open || active < 0) return;
    let y = 0;
    for (let i = 0; i < active && i < shown.length; i++) y += rowH(shown[i]);
    const listH = height - (isSearchable ? SEARCH_H : 0);
    if (y + ITEM_H > listH) scrollRef.current?.scrollTo?.({ y: y - listH / 2, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchor]);

  const tint = c.primary;
  const triggerText = selected ? selected.label : placeholder;
  const lower = lowerCaseTrigger ?? trigger === 'link';

  return (
    <View style={[trigger === 'field' ? styles.fieldRoot : null, style]} testID={testID}>
      {trigger === 'field' && !!label && <Text style={[styles.label, { color: c.text }]}>{label}</Text>}
      <Pressable
        ref={triggerRef as any}
        testID={`${testID}-trigger`}
        accessibilityRole={'combobox' as any}
        accessibilityLabel={label ? `${label}: ${triggerText}` : triggerText}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => (open ? close() : show())}
        style={({ hovered, pressed }: any) =>
          trigger === 'link'
            ? [styles.link, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1, backgroundColor: hovered ? `${tint}12` : 'transparent' }]
            : [
                styles.field,
                {
                  borderColor: open ? tint : c.border,
                  borderWidth: open ? 2 : 1,
                  backgroundColor: c.surface,
                  opacity: disabled ? 0.5 : 1,
                },
              ]
        }
      >
        {!!selected?.icon && trigger === 'field' && <IconApp testID={`${testID}-trigger-icon`} name={selected.icon} size={18} color={c.text} />}
        <Text
          numberOfLines={1}
          style={
            trigger === 'link'
              ? [styles.linkText, { color: tint }]
              : [styles.fieldText, { color: selected ? c.text : `${c.text}88`, marginLeft: selected?.icon ? 8 : 0 }]
          }
        >
          {lower ? triggerText.toLowerCase() : triggerText}
        </Text>
        <IconApp testID={`${testID}-chevron`} name={open ? 'expand_less' : 'expand_more'} size={trigger === 'link' ? 18 : 20} color={trigger === 'link' ? tint : c.text} />
      </Pressable>

      {open && (
        <Modal visible transparent animationType="none" onRequestClose={close}>
          <Pressable testID={`${testID}-backdrop`} style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close the list" />
          <View
            testID={`${testID}-list`}
            accessibilityRole={'menu' as any}
            style={[
              styles.list,
              {
                left,
                top,
                width,
                height,
                backgroundColor: c.surface,
                borderColor: c.border,
                shadowOpacity: isDark ? 0.5 : 0.18,
              },
            ]}
          >
            {isSearchable && (
              <View style={styles.search}>
                <TextInputApp
                  testID={`${testID}-search`}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder}
                  leftIcon="search"
                  autoFocus={Platform.OS === 'web'}
                  style={{ marginBottom: 0 }}
                />
              </View>
            )}
            <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 4 }}>
              {shown.length === 0 && <Text style={[styles.empty, { color: c.text }]}>No match</Text>}
              {shown.map((item, i) => {
                const isSel = item.value === value;
                const isActive = i === active;
                return (
                  <View key={item.value}>
                    {!!item.group && (
                      <Text style={[styles.group, { color: c.text }]} numberOfLines={1}>
                        {item.group}
                      </Text>
                    )}
                    <Pressable
                      testID={`${testID}-item-${item.value}`}
                      accessibilityRole="menuitem"
                      accessibilityLabel={item.label}
                      accessibilityState={{ checked: isSel, disabled: !!item.disabled }}
                      disabled={item.disabled}
                      onPress={() => pick(item)}
                      onHoverIn={() => setActive(i)}
                      style={({ hovered, pressed }: any) => [
                        styles.item,
                        {
                          height: item.description ? ITEM_H_DESC : ITEM_H,
                          opacity: item.disabled ? 0.4 : 1,
                          backgroundColor: pressed ? `${tint}26` : isSel ? `${tint}1c` : hovered || isActive ? `${tint}10` : 'transparent',
                        },
                      ]}
                    >
                      <View style={[styles.bar, { backgroundColor: isSel ? tint : 'transparent' }]} />
                      {!!item.icon && <IconApp testID={`${testID}-item-${item.value}-icon`} name={item.icon} size={18} color={isSel ? tint : c.text} />}
                      <View style={{ flex: 1, marginLeft: item.icon ? 10 : 2 }}>
                        <Text numberOfLines={1} style={[styles.itemText, { color: isSel ? tint : c.text, fontWeight: isSel ? '700' : '500' }]}>
                          {item.label}
                        </Text>
                        {!!item.description && (
                          <Text numberOfLines={1} style={[styles.desc, { color: c.text }]}>
                            {item.description}
                          </Text>
                        )}
                      </View>
                      {isSel && <IconApp testID={`${testID}-item-${item.value}-checked`} name="check" size={18} color={tint} />}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldRoot: { width: '100%' },
  label: { fontSize: 12, fontWeight: '600', opacity: 0.7, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 8, paddingHorizontal: 10 },
  fieldText: { flex: 1, fontSize: 14 },
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 6, paddingLeft: 6, paddingRight: 2, height: 28 },
  linkText: { fontSize: 14, fontWeight: '600', marginRight: 2 },
  list: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  search: { height: SEARCH_H, paddingHorizontal: 8, paddingTop: 6, justifyContent: 'center' },
  group: { height: GROUP_H, fontSize: 11, fontWeight: '700', opacity: 0.55, paddingHorizontal: 14, paddingTop: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  item: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  bar: { width: 3, alignSelf: 'stretch', marginRight: 9, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  itemText: { fontSize: 14 },
  desc: { fontSize: 11, opacity: 0.6, marginTop: 2 },
  empty: { padding: 14, opacity: 0.6, textAlign: 'center' },
});

export default SelectItemFromListApp;
