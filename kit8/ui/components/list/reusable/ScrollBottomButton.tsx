// ReusableList toolbar - scroll to the last item.
import React from 'react';
import { PMIconButton } from '../../../../pm/inner/buttons/PMIconButton';

export default function ScrollBottomButton({ onPress, color, testID = 'scroll-bottom' }: { onPress: () => void; color: string; testID?: string }) {
  return <PMIconButton testID={testID} icon="vertical_align_bottom" title="Scroll to the bottom" onPress={onPress} color={color} />;
}
