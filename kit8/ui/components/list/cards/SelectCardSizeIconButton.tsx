// The toolbar icon button of a list with cards: opens the menu cardSmall / cardMedium / cardBig, the current size has a check mark.
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { PMIconButton } from '../../../../pm/inner/buttons/PMIconButton';
import PMContextMenu from '../../../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../../../pm/inner/menu/PMMenuItem';
import { menuLeft, MenuAnchorPoint, useMenuAnchor } from '../reusable/useMenuAnchor';
import { PM_MENU_WIDTH } from '../../../../pm/inner/menu/PMContextMenu';
import { CARD_SIZE_ICON, CARD_SIZE_LABEL, CARD_SIZES, CardSize } from './cardSize';

export interface SelectCardSizeIconButtonProps {
  value: CardSize;
  onChange: (size: CardSize) => void;
  /** the sizes offered (default: all three) */
  sizes?: readonly CardSize[];
  color: string;
  activeColor?: string;
  testID?: string;
}

export default function SelectCardSizeIconButton({ value, onChange, sizes = CARD_SIZES, color, activeColor, testID = 'select-card-size' }: SelectCardSizeIconButtonProps) {
  const [at, setAt] = useState<MenuAnchorPoint | null>(null);
  const anchor = useMenuAnchor(setAt);
  const items = useMemo<PMMenuItemProps[]>(() => sizes.map((size) => ({
    testID: `${testID}-${size}`, label: CARD_SIZE_LABEL[size], icon: CARD_SIZE_ICON[size], checked: size === value,
    onPress: () => { setAt(null); if (size !== value) onChange(size); },
  })), [sizes, value, onChange, testID]);
  return (
    <>
      <View {...anchor.anchorProps}>
        <PMIconButton testID={testID} icon={CARD_SIZE_ICON[value]} title="Size of the cards" onPress={anchor.open} color={color} activeColor={activeColor} />
      </View>
      {at ? <PMContextMenu testID={`${testID}-menu`} x={menuLeft(at, PM_MENU_WIDTH)} y={at.y} caption="Size of the cards" items={items} onClose={() => setAt(null)} /> : null}
    </>
  );
}
