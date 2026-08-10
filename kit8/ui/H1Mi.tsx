import React from 'react';
import { Text, useTheme } from 'react-native-paper';

export default function H1Mi({ style, children, ...props }: React.ComponentProps<typeof Text>) {
  const theme = useTheme();
  return (
    <Text variant="headlineLarge" style={[{ marginVertical: 12, fontWeight: 'bold', color: theme.colors.primary }, style]} {...props}>
      {children}
    </Text>
  );
}
