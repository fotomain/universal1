import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface FormErrorFieldComponentProps {
  error?: string | null;
}

export function FormErrorFieldComponent({ error }: FormErrorFieldComponentProps) {
  const theme = useTheme();

  if (!error) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.errorContainer }]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.error} />
      <Text style={[styles.text, { color: theme.colors.error }]}>
        {error}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
