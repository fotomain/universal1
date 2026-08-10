import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, Surface, Text, Button } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { useAppSignOut } from '../../kit8/hooks/useAppSignOut';
import { ActiveUserState, clearActiveUser } from '../../kit8/redux/activeUserSlice';

export default function UserProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { handleSignOut } = useAppSignOut();

  const userState = useSelector((state: any) => state.activeUserState as ActiveUserState);

  const isLoggedIn = !!(userState?.activeUserGUID && userState.activeUserGUID.trim() !== "");

  const onSignOutClick = async () => {
    dispatch(clearActiveUser());
    await handleSignOut();
  };

  const onSignInClick = () => {
    router.push('/signin');
  };

  if (!isLoggedIn) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Surface style={styles.surfaceCard} elevation={2}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary, marginBottom: 16, textAlign: 'center', fontWeight: 'bold' }}>
            {t('menu.userProfile')}
          </Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginBottom: 24, textAlign: 'center' }}>
            You are currently not signed in.
          </Text>
          <Button 
            mode="contained" 
            onPress={onSignInClick} 
            buttonColor={theme.colors.primary}
          >
            Go to Sign In
          </Button>
        </Surface>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.surfaceCard} elevation={2}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, marginBottom: 24, textAlign: 'center', fontWeight: 'bold' }}>
          {t('menu.userProfile')}
        </Text>

        <Surface style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>User GUID:</Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginBottom: 8, marginTop: 4 }}>{userState.activeUserGUID}</Text>

          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>Email:</Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginBottom: 8, marginTop: 4 }}>{userState.activeUserEmail || "N/A"}</Text>

          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>First Name:</Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginBottom: 8, marginTop: 4 }}>{userState.activeUserFirstName || "N/A"}</Text>

          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>Last Name:</Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginBottom: 8, marginTop: 4 }}>{userState.activeUserLastName || "N/A"}</Text>
        </Surface>

        <View style={styles.buttonWrapper}>
          <Button 
            mode="contained" 
            onPress={onSignOutClick} 
            buttonColor={theme.colors.error}
            textColor={theme.colors.onError}
          >
            {t('menu.signOut')}
          </Button>
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  surfaceCard: {
    padding: 24,
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 20,
  },
  buttonWrapper: {
    marginTop: 12,
  },
});
