import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapMi() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map is not available on native</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { fontSize: 16, color: '#999' },
});
