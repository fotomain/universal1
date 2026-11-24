// ReusableList toolbar - scroll to the first item.
import React from 'react';
import { PMIconButton } from '../../../../pm/inner/buttons/PMIconButton';

export default function ScrollTopButton({ onPress, color, testID = 'scroll-top' }: { onPress: () => void; color: string; testID?: string }) {
  return <PMIconButton testID={testID} icon="vertical_align_top" title="Scroll to the top" onPress={onPress} color={color} />;
}
