import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, SegmentedButtons, useTheme } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { setFabAnimationVariant, FABAnimationVariant } from '../../redux/uxuiSlice';

export const FABAnimationSelectorComponent: React.FC = () => {
  const paperTheme = useTheme();
  const dispatch = useDispatch();
  const uxuiState = useSelector((state: any) => state.uxuiState);
  const fabAnimationVariant: FABAnimationVariant = uxuiState?.fabAnimationVariant || 'defaultFABAnimation';

  const handleValueChange = (value: string) => {
    dispatch(setFabAnimationVariant(value as FABAnimationVariant));
  };

  return (
    <Card style={styles.card} mode="elevated" elevation={2}>
      <Card.Title
        title="FAB Animation Variant"
        titleStyle={{ fontWeight: '700', fontSize: 16, color: paperTheme.colors.primary }}
        subtitle="Select open/close speed dial animation for all FAB buttons"
      />
      <Card.Content>
        <SegmentedButtons
          value={fabAnimationVariant}
          onValueChange={handleValueChange}
          buttons={[
            {
              value: 'defaultFABAnimation',
              label: 'Default Animation',
              icon: 'animation-outline',
            },
            {
              value: 'reanimatedBasicFABAnimation',
              label: 'Reanimated Basic',
              icon: 'play-speed',
            },
          ]}
          style={styles.segmented}
        />

        <Text variant="bodySmall" style={styles.descriptionText}>
          {fabAnimationVariant === 'defaultFABAnimation'
            ? '• Default Animation: Standard spring drop/rise with smooth fade.'
            : '• Reanimated Basic: Spring + scale interpolation with 50ms fast opacity and scroll tracking.'}
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 12,
  },
  segmented: {
    marginTop: 8,
    marginBottom: 12,
  },
  descriptionText: {
    opacity: 0.8,
    lineHeight: 18,
  },
});

export default FABAnimationSelectorComponent;
