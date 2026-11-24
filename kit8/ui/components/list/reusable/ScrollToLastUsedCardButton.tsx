// ReusableList toolbar - scroll to the card the user used last (pressed, opened, its menu / FAB / command, dragged, or just created). Off while there is none.
import React from 'react';
import { PMIconButton } from '../../../../pm/inner/buttons/PMIconButton';

export default function ScrollToLastUsedCardButton({ onPress, enabled, color, activeColor, title, testID = 'scroll-last-used' }: {
  onPress: () => void; enabled: boolean; color: string; activeColor?: string;
  /** the title of the card, shown in the tip */
  title?: string; testID?: string;
}) {
  const tip = enabled ? (title ? `Scroll to the last used card "${title}"` : 'Scroll to the last used card') : 'No card used yet';
  return <PMIconButton testID={testID} icon="filter_tilt_shift" title={tip} onPress={onPress} color={enabled ? (activeColor ?? color) : color} disabled={!enabled} />;
}
