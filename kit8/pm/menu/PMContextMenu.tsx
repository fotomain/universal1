// Generic popup / context menu of the PM module: a small card of items at a window point
// (clamped to the screen), closed by the backdrop, Android back or picking an item.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import PMMenuItem, { PMMenuItemProps } from './PMMenuItem';

export const PM_MENU_WIDTH = 196;
export const PM_MENU_ITEM_HEIGHT = 40;

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
  const menuH = PM_MENU_ITEM_HEIGHT * items.length + (caption ? 30 : 8);
  const left = Math.max(8, Math.min(x, win.width - width - 8));
  const top = Math.max(8, Math.min(y, win.height - menuH - 8));

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable testID={`${testID}-backdrop`} style={StyleSheet.absoluteFill} onPress={onClose} onLongPress={onClose} />
      <View style={[styles.menu, { left, top, width, backgroundColor: c.surface, borderColor: c.border }]} testID={testID}>
        {!!caption && (
          <Text numberOfLines={1} style={[styles.caption, { color: c.text }]} testID={`${testID}-caption`}>
            {caption}
          </Text>
        )}
        {items.map((item) => (
          <PMMenuItem key={item.testID} {...item} />
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  caption: { fontSize: 11, opacity: 0.6, paddingHorizontal: 12, paddingVertical: 4 },
});
