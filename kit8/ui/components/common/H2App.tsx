import React from 'react';
import { Text } from 'react-native-paper';

export default function H2App({ style, children, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text variant="headlineMedium" style={[{ marginVertical: 8 }, style]} {...props}>
      {children}
    </Text>
  );
}
