// Toolbar / panel icon button of the PM module = ButtonApp (variant "toolbar") + PM tip
// (hover on web, long-press on touch). Lives in kit8/pm/inner/buttons.

import React from 'react';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import { usePMTip, PMTipScope } from '../tooltip/PMTooltip';
import { pmT } from '../../i18n/pmT';

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
  /** long press (touch) does this instead of showing the tip, e.g. opens a menu */
  onLongPress?: () => void;
  /** which tooltip layer shows the tip: 'screen' (default, PM screens) or 'app' (root layout - works on every screen) */
  tipScope?: PMTipScope;
}

export function PMIconButton({ icon, label, onPress, color, activeColor, active, disabled, testID, title, size, compact, width, badge, onLongPress, tipScope }: PMIconButtonProps) {
  // title / label are English texts: shown in the app language (i18n/pmT)
  const tipText = pmT(title || label || humanize(icon));
  const tip = usePMTip(disabled ? pmT('{{tip}} (not available now)', { tip: tipText }) : tipText, tipScope);
  return (
    <ButtonApp
      ref={tip.ref}
      variant="toolbar"
      testID={testID}
      icon={icon}
      iconSize={size}
      title={label ? pmT(label) : label}
      accessibilityLabel={tipText}
      accessibilityHint={tip.accessibilityHint}
      onPress={onPress}
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPressIn={tip.onPressIn}
      onLongPress={onLongPress || tip.onLongPress}
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
