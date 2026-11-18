// Step 7 - the answers on one page; every line can be pressed to go back to its step.
import React from 'react';
import { View } from 'react-native';
import { Divider, List } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';
import { reviewLines } from '../model/assistantModel';
import type { AssistantStepProps } from './stepProps';

export default function ReviewStep({ values, ctx, onJump }: AssistantStepProps) {
  const lines = reviewLines(values, ctx);
  return (
    <View testID="assistant-review">
      {lines.map((l, i) => (
        <View key={`${l.id}-${l.label}`}>
          <List.Item
            testID={`assistant-review-${i}`}
            title={pmT(l.label)}
            description={pmT(l.value)}
            right={(p) => <List.Icon {...p} icon="pencil-outline" />}
            onPress={() => onJump?.(l.id)}
          />
          <Divider />
        </View>
      ))}
    </View>
  );
}
