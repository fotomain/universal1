// Step 1 - the name of the project (the one thing that cannot be empty).
import React from 'react';
import { TextInput } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';
import type { AssistantStepProps } from './stepProps';

export default function IdentityStep({ values, onChange }: AssistantStepProps) {
  return (
    <TextInput
      mode="outlined"
      label={pmT('Project name')}
      value={values.name}
      onChangeText={(name) => onChange({ name })}
      placeholder={pmT('Client - result - year')}
      autoFocus
      maxLength={140}
      testID="assistant-input-name"
    />
  );
}
