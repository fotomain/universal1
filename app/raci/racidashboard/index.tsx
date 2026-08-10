import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text, Surface, useTheme, Card } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { ActiveUserState } from '../../../kit8/redux/activeUserSlice';

export default function RaciDashboardScreen() {
  const { raciGUID } = useLocalSearchParams<{ raciGUID?: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);

  const displayRaciGUID = raciGUID || activeUserState?.activeUserGUID || 'N/A';

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card} elevation={2}>
        <Card.Title
          title={t('screens.raciDashboard')}
          titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
        />
        <Card.Content>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
            RACI Dashboard for User
          </Text>
          <Surface style={[styles.guidBox, { backgroundColor: theme.colors.secondaryContainer }]} elevation={0}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
              raciGUID:
            </Text>

            <Text variant="titleMedium" style={[styles.guidText, { color: theme.colors.onSecondaryContainer }]}>
              {displayRaciGUID}
            </Text>

          </Surface>

          {activeUserState && (
            <View style={{ marginTop: 16 }}>
              <Text variant="bodyMedium">
                Email: <Text style={{ fontWeight: 'bold' }}>{activeUserState.activeUserEmail || 'N/A'}</Text>
              </Text>
              <Text variant="bodyMedium">
                Name: <Text style={{ fontWeight: 'bold' }}>{`${activeUserState.activeUserFirstName || ''} ${activeUserState.activeUserLastName || ''}`.trim() || 'N/A'}</Text>
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    minHeight: '100%',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 12,
  },
  guidBox: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  guidText: {
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginTop: 4,
  },
});
