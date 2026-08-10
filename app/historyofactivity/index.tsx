import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme, List } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

export default function HistoryOfActivityScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card} elevation={2}>
        <Card.Title
          title={t('screens.historyOfActivity')}
          titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
        />
        <Card.Content>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
            Recent user actions and system events log.
          </Text>

          <List.Section>
            <List.Item
              title="Media Post Created"
              description="Video recording post added to order 1"
              left={props => <List.Icon {...props} icon="video-plus" />}
            />
            <List.Item
              title="RACI Member Updated"
              description="RACI member profile synchronized"
              left={props => <List.Icon {...props} icon="account-edit" />}
            />
            <List.Item
              title="Google Drive Backup"
              description="Video upload to folder KIT8VIDEO completed"
              left={props => <List.Icon {...props} icon="google-drive" />}
            />
          </List.Section>
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
});
