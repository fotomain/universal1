import React from 'react';
import ButtonApp, { ButtonAppProps } from './ButtonApp';

export const ButtonPrimaryApp: React.FC<Omit<ButtonAppProps, 'variant'>> = (props) => {
  return <ButtonApp variant="contained" {...props} />;
};

export default ButtonPrimaryApp;
