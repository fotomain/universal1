import React from 'react';
import ButtonApp, { ButtonAppProps } from './ButtonApp';

export const ButtonTextApp: React.FC<Omit<ButtonAppProps, 'variant'>> = (props) => {
  return <ButtonApp variant="text" {...props} />;
};

export default ButtonTextApp;
