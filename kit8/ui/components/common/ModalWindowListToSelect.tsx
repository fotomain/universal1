// ModalWindowListToSelect - reusable "pick one item from a list" window.
//
//   <ModalWindowListToSelect
//     visible={open} title="Restore project from version" items={[{ id, title, subtitle, color, icon }]}
//     onSelect={(id) => ...} onClose={() => setOpen(false)} />
//
// A search field appears when the list is long (or searchable = true); it matches any substring of the
// title / subtitle. Pressing a row calls onSelect(id) - the caller closes the window. Backdrop press,
// Esc (web) and Android back call onClose. Colors follow the active design system.

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from './IconApp';

export interface ModalWindowListItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Material symbol left of the title */
  icon?: string;
  /** color of the icon / dot (default: theme primary) */
  color?: string;
  disabled?: boolean;
}

export interface ModalWindowListToSelectProps {
  visible: boolean;
  title: string;
  /** explanation under the title */
  message?: string;
  items: ModalWindowListItem[];
  /** highlighted row */
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** default: shown when there are more than 7 items */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  cancelLabel?: string;
  /** prefix of every testID (default "modal-list") */
  testID?: string;
}

const AUTO_SEARCH_FROM = 8;

export default function ModalWindowListToSelect({
  visible,
  title,
  message,
  items,
  selectedId,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing to select',
  cancelLabel = 'Cancel',
  testID = 'modal-list',
}: ModalWindowListToSelectProps) {
  const { themeColors: c } = useDesignSystem();
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  // web: Esc closes the window
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [visible, onClose]);

  const showSearch = searchable ?? items.length >= AUTO_SEARCH_FROM;
  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => i.title.toLowerCase().includes(t) || (i.subtitle || '').toLowerCase().includes(t));
  }, [items, text]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={cancelLabel} testID={`${testID}-backdrop`} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID={`${testID}-window`}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]} testID={`${testID}-title`} numberOfLines={2}>
              {title}
            </Text>
            <IconApp testID={`${testID}-close`} name="close" size={20} color={c.text} onPress={onClose} style={styles.close} />
          </View>
          {!!message && <Text style={[styles.message, { color: c.text }]}>{message}</Text>}
          {showSearch && (
            <TextInput
              testID={`${testID}-search`}
              value={text}
              onChangeText={setText}
              placeholder={searchPlaceholder}
              placeholderTextColor={`${c.text}66`}
              autoFocus={Platform.OS === 'web'}
              style={[styles.search, { color: c.text, borderColor: c.border, backgroundColor: c.background }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
            />
          )}
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {shown.length === 0 ? (
              <Text style={[styles.empty, { color: c.text }]} testID={`${testID}-empty`}>
                {items.length ? 'No matches' : emptyText}
              </Text>
            ) : (
              shown.map((item) => {
                const selected = item.id === selectedId;
                return (
                  <Pressable
                    key={item.id}
                    testID={`${testID}-item-${item.id}`}
                    disabled={item.disabled}
                    onPress={() => onSelect(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    style={({ pressed, hovered }: any) => [
                      styles.row,
                      { borderColor: selected ? c.primary : 'transparent', backgroundColor: selected || pressed ? `${c.primary}1f` : hovered ? `${c.primary}12` : 'transparent', opacity: item.disabled ? 0.45 : 1 },
                    ]}
                  >
                    {item.icon ? (
                      <IconApp name={item.icon} size={18} color={item.color || c.primary} style={styles.rowIcon} />
                    ) : (
                      <View style={[styles.dot, { backgroundColor: item.color || c.primary }]} />
                    )}
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {!!item.subtitle && (
                        <Text style={[styles.rowSubtitle, { color: c.text }]} numberOfLines={2}>
                          {item.subtitle}
                        </Text>
                      )}
                    </View>
                    <IconApp name="chevron_right" size={18} color={c.text} style={{ opacity: 0.4 }} />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable testID={`${testID}-cancel`} onPress={onClose} accessibilityRole="button" style={[styles.cancel, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '86%',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  close: { padding: 4, marginLeft: 8 },
  message: { marginTop: 6, fontSize: 12.5, opacity: 0.7 },
  search: { height: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 14, marginTop: 12 },
  list: { marginTop: 10, flexGrow: 0 },
  empty: { paddingVertical: 22, textAlign: 'center', opacity: 0.6, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, marginBottom: 2 },
  rowIcon: { marginRight: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, marginLeft: 4 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSubtitle: { fontSize: 12, opacity: 0.65, marginTop: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  cancel: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
});
