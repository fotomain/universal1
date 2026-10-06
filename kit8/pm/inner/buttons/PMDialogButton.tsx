// Dialog / call-to-action button of the PM module = ButtonApp in the active design system.
//   kind: primary (contained) · secondary (outlined) · text · danger (red text) ·
//         dangerOutlined · dangerContained

import React from 'react';
import ButtonApp from '../../../components/common/ButtonApp';
import { pmT } from '../../i18n/pmT';

export type PMDialogButtonKind = 'primary' | 'secondary' | 'text' | 'danger' | 'dangerOutlined' | 'dangerContained';

export function PMDialogButton({
  title,
  onPress,
  kind = 'primary',
  testID,
  icon,
  disabled,
  loading,
  color,
  width,
  minWidth,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: PMDialogButtonKind;
  testID: string;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  /** override the theme color (e.g. themeColors.text for a neutral "Cancel") */
  color?: string;
  width?: number;
  /** buttons of one group with the same minWidth are equal in size */
  minWidth?: number;
  style?: any;
}) {
  const variant = kind === 'primary' || kind === 'dangerContained' ? 'contained' : kind === 'secondary' || kind === 'dangerOutlined' ? 'outlined' : 'text';
  return (
    <ButtonApp
      testID={testID}
      title={pmT(title)}
      onPress={onPress}
      variant={variant}
      danger={kind === 'danger' || kind === 'dangerOutlined' || kind === 'dangerContained'}
      color={color}
      icon={icon}
      disabled={disabled}
      loading={loading}
      size="small"
      width={width}
      minWidth={minWidth}
      style={[{ marginVertical: 0, marginLeft: 8 }, style]}
    />
  );
}

export default PMDialogButton;
