import React from 'react';
import ButtonApp, { ButtonAppProps } from './ButtonApp';

export const ButtonSecondaryApp: React.FC<Omit<ButtonAppProps, 'variant'>> = (props) => {
  return <ButtonApp variant="outlined" {...props} />;
};

export default ButtonSecondaryApp;
