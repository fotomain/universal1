import React from 'react';
import ButtonPrimaryApp from '../../components/common/ButtonPrimaryApp';
import ButtonSecondaryApp from '../../components/common/ButtonSecondaryApp';
import ButtonTextApp from '../../components/common/ButtonTextApp';
import { ButtonAppProps } from '../../components/common/ButtonApp';

export interface ButtonMiProps extends Partial<ButtonAppProps> {
  title: string;
  onPress: () => void;
  inputMode?: string;
  mode?: 'contained' | 'outlined' | 'text';
}

export default function ButtonMi({
  title,
  onPress,
  mode = 'contained',
  ...rest
}: ButtonMiProps) {
  if (mode === 'outlined') {
    return <ButtonSecondaryApp title={title} onPress={onPress} {...rest} />;
  }
  if (mode === 'text') {
    return <ButtonTextApp title={title} onPress={onPress} {...rest} />;
  }
  return <ButtonPrimaryApp title={title} onPress={onPress} {...rest} />;
}
