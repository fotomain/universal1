// ArticleTextApp - paragraph of article / body text (Paper bodyLarge in the primary color). Was kit8/ui/ArticleTextMi.
import React from 'react';
import { Text, useTheme } from 'react-native-paper';

export default function ArticleTextApp({ style, children, ...props }: React.ComponentProps<typeof Text>) {
  const theme = useTheme();
  return (
    <Text variant="bodyLarge" style={[{ marginVertical: 6, color: theme.colors.primary }, style]} {...props}>
      {children}
    </Text>
  );
}
