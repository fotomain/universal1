import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme, Chip } from 'react-native-paper';
import { ButtonPrimaryApp } from './common';
import { useDispatch, useSelector } from 'react-redux';
import { useWorkPlace } from '../providers/WithWorkPlace';
import { SystemMetaData } from '../redux/SystemMetaData';
import { toggleThemeMode } from '../redux/userThemeSlice';
import DarkThemeSwitchComponent from './DarkThemeSwitchComponent';

// themeStore-ticket-step5: Component for theme synchronization status & testing across workplaces
export default function ThemeSyncStatusComponent() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { workPlaceGUID } = useWorkPlace();
  const activeUserState = useSelector((state: any) => state.activeUserState);
  const userTheme = useSelector((state: any) => state.userTheme);
  const themeStoreState = useSelector((state: any) => state.themeStore);

  const userGUID = activeUserState?.activeUserGUID || 'N/A';

  const handleManualRead = () => {
    // themeStore-ticket-step4: Manual readOne trigger
    if (SystemMetaData?.themeStore?.actions?.readOne) {
      dispatch(
        SystemMetaData.themeStore.actions.readOne({
          rowOwnerGUID: userGUID,
          rowGUID: workPlaceGUID,
        })
      );
    }
  };

  const handleManualCreateOrUpdate = () => {
    // themeStore-ticket-step3: Manual create/upsert trigger
    if (SystemMetaData?.themeStore?.actions?.upsertOne) {
      dispatch(
        SystemMetaData.themeStore.actions.upsertOne({
          rowOwnerGUID: userGUID,
          rowGUID: workPlaceGUID,
          orderInList: Date.now(),
          rowJSON: userTheme,
        })
      );
    }
  };

  return (
    <Card style={styles.card}>
      <Card.Title title="🎨 Theme Synchronization across Workplaces" />
      <Card.Content>
        <View style={styles.row}>
          <Text variant="labelLarge">Active User GUID:</Text>
          <Chip compact style={styles.chip}>{userGUID}</Chip>
        </View>

        <View style={styles.row}>
          <Text variant="labelLarge">Workplace GUID:</Text>
          <Chip compact style={styles.chip}>{workPlaceGUID || 'N/A'}</Chip>
        </View>

        <View style={styles.row}>
          <Text variant="labelLarge">Current Mode:</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {userTheme?.isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </Text>
        </View>

        <View style={styles.switchWrapper}>
          <DarkThemeSwitchComponent label="Toggle Theme Mode" showLabel />
        </View>

        <View style={styles.buttonRow}>
          <ButtonPrimaryApp onPress={handleManualRead} style={styles.btn}>
            Read Theme (readOne)
          </ButtonPrimaryApp>
          <ButtonPrimaryApp onPress={handleManualCreateOrUpdate} style={styles.btn}>
            Save Theme (upsertOne)
          </ButtonPrimaryApp>
        </View>

        {themeStoreState?.isReading ? (
          <Text style={styles.statusText}>Syncing theme with Supabase...</Text>
        ) : null}
        {themeStoreState?.readErrorData ? (
          <Text style={styles.errorText}>Sync Error: {String(themeStoreState.readErrorData)}</Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 12,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#e3f2fd',
  },
  switchWrapper: {
    marginVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  btn: {
    flex: 1,
    minWidth: 140,
  },
  statusText: {
    marginTop: 8,
    fontSize: 12,
    color: '#0288d1',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#d32f2f',
  },
});
