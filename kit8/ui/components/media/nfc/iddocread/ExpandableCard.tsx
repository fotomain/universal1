// A card of the ID reader screen that shows its TITLE only and a "more..." link; the link opens the text (and the inputs) under the title, "less" closes it again.
// `forceOpen` opens it by itself (the document asks for its password: the inputs must be seen).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextStyle, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

export interface ExpandableCardProps {
  title: string;
  titleStyle?: TextStyle;
  titleVariant?: 'titleMedium' | 'labelLarge';
  /** open while true (and when it turns true) */
  forceOpen?: boolean;
  elevation?: number;
  testID: string;
  children: React.ReactNode;
}

export default function ExpandableCard({ title, titleStyle, titleVariant = 'titleMedium', forceOpen = false, elevation = 2, testID, children }: ExpandableCardProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(forceOpen);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={elevation} testID={testID}>
      <Card.Content style={styles.content}>
        <Text variant={titleVariant} style={titleStyle} testID={`${testID}-title`}>{title}</Text>
        {open ? <View style={styles.body} testID={`${testID}-body`}>{children}</View> : null}
        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={open ? 'Show less' : 'Show more'} hitSlop={8} testID={`${testID}-toggle`}>
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>{open ? 'less' : 'more...'}</Text>
        </Pressable>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  content: { gap: 8 },
  body: { gap: 8 },
});
