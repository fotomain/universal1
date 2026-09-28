// Toolbar / panel icon button of the PM module = ButtonApp (variant "toolbar") + PM tip
// (hover on web, long-press on touch). Same props as before the move to kit8/pm/buttons.

import React from 'react';
import ButtonApp from '../../components/common/ButtonApp';
import { usePMTip } from '../PMTooltip';

const humanize = (icon: string) => icon.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export interface PMIconButtonProps {
  icon: string;
  label?: string;
  onPress: () => void;
  color: string;
  activeColor?: string;
  active?: boolean;
  disabled?: boolean;
  testID: string;
  /** tip text (default: label or the humanized icon name) */
  title?: string;
  size?: number;
  compact?: boolean;
  /** fixed width, content centered (e.g. PM_WIDE_ACTION_WIDTH) */
  width?: number;
  /** small counter bubble (e.g. undo steps) */
  badge?: number;
}

export function PMIconButton({ icon, label, onPress, color, activeColor, active, disabled, testID, title, size, compact, width, badge }: PMIconButtonProps) {
  const tipText = title || label || humanize(icon);
  const tip = usePMTip(disabled ? `${tipText} (not available now)` : tipText);
  return (
    <ButtonApp
      ref={tip.ref}
      variant="toolbar"
      testID={testID}
      icon={icon}
      iconSize={size}
      title={label}
      accessibilityLabel={tipText}
      accessibilityHint={tip.accessibilityHint}
      onPress={onPress}
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPressIn={tip.onPressIn}
      onLongPress={tip.onLongPress}
      delayLongPress={tip.delayLongPress}
      color={color}
      active={active}
      activeColor={activeColor}
      disabled={disabled}
      compact={compact}
      width={width}
      badge={badge}
    />
  );
}

export default PMIconButton;
