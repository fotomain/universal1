// Generic popup / context menu of the PM module: a small card of items at a window point
// (clamped to the screen), closed by the backdrop, Android back or picking an item.
// Items with `submenu` open a second card next to them (press, or hover on web); it opens on
// the right and flips to the left near the screen edge.

import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import PMMenuItem, { PMMenuItemProps } from './PMMenuItem';

export const PM_MENU_WIDTH = 196;
export const PM_MENU_ITEM_HEIGHT = 40;
const CAPTION_H = 30;
const PAD = 4;

export interface PMContextMenuProps {
  /** window coordinates of the click / tap */
  x: number;
  y: number;
  /** small grey line above the items (e.g. what the menu is about) */
  caption?: string;
  items: PMMenuItemProps[];
  onClose: () => void;
  testID: string;
  width?: number;
}

export default function PMContextMenu({ x, y, caption, items, onClose, testID, width = PM_MENU_WIDTH }: PMContextMenuProps) {
  const { themeColors: c } = useDesignSystem();
  const win = useWindowDimensions();
  const [openSub, setOpenSub] = useState(-1);
  // long menus (phones): never taller than the window - the items scroll
  const maxH = Math.max(120, win.height - 16);
  const menuH = Math.min(maxH, PM_MENU_ITEM_HEIGHT * items.length + (caption ? CAPTION_H + PAD : 2 * PAD));
  const left = Math.max(8, Math.min(x, win.width - width - 8));
  const top = Math.max(8, Math.min(y, win.height - menuH - 8));

  const sub = openSub >= 0 ? items[openSub]?.submenu : undefined;
  let subLeft = 0;
  let subTop = 0;
  if (sub) {
    const subH = Math.min(maxH, PM_MENU_ITEM_HEIGHT * sub.length + 2 * PAD);
    subLeft = left + width - 6 + width <= win.width - 8 ? left + width - 6 : Math.max(8, left - width + 6);
    subTop = Math.max(8, Math.min(top + (caption ? CAPTION_H : PAD) + openSub * PM_MENU_ITEM_HEIGHT - PAD, win.height - subH - 8));
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable testID={`${testID}-backdrop`} style={StyleSheet.absoluteFill} onPress={onClose} onLongPress={onClose} />
      <View style={[styles.menu, { left, top, width, maxHeight: maxH, backgroundColor: c.surface, borderColor: c.border }]} testID={testID}>
        {!!caption && (
          <Text numberOfLines={1} style={[styles.caption, { color: c.text }]} testID={`${testID}-caption`}>
            {caption}
          </Text>
        )}
        <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
          {items.map((item, i) => (
            <PMMenuItem
              key={item.testID}
              {...item}
              highlighted={!!item.submenu && openSub === i}
              onHoverIn={Platform.OS === 'web' ? () => setOpenSub(item.submenu ? i : -1) : undefined}
              onPress={item.submenu ? () => setOpenSub(openSub === i ? -1 : i) : item.onPress}
            />
          ))}
        </ScrollView>
      </View>
      {sub && (
        <View style={[styles.menu, { left: subLeft, top: subTop, width, maxHeight: maxH, backgroundColor: c.surface, borderColor: c.border }]} testID={`${testID}-submenu`}>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            {sub.map((item) => (
              <PMMenuItem key={item.testID} {...item} />
            ))}
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: PAD,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  caption: { fontSize: 11, opacity: 0.6, paddingHorizontal: 12, paddingVertical: 4 },
});
