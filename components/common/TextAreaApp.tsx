import React from 'react';
import TextInputApp, { TextInputAppProps } from './TextInputApp';

export interface TextAreaAppProps extends TextInputAppProps {
  numberOfLines?: number;
}

export const TextAreaApp: React.FC<TextAreaAppProps> = ({
  numberOfLines = 3,
  ...props
}) => {
  return (
    <TextInputApp
      multiline={true}
      numberOfLines={numberOfLines}
      {...props}
    />
  );
};

export default TextAreaApp;
