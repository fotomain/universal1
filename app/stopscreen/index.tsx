import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, Surface, Text, Button } from 'react-native-paper';

export default function StopScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ stopScreenMessage?: string; goToSignIn?: string; returnTo?: string }>();
  const message = params.stopScreenMessage || t('screens.accessStopped');
  const showGoToSignIn = params.goToSignIn === 'true' || params.goToSignIn === '1';
  const returnTo = params.returnTo;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const handleGoToSignIn = () => {
    router.replace({
      pathname: '/signin',
      params: returnTo ? { returnTo } : undefined,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.surfaceCard} elevation={2}>
        <Text variant="headlineMedium" style={{ color: theme.colors.error, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' }}>
          {t('screens.accessStopped')}
        </Text>

        <Surface style={[styles.messageBox, { backgroundColor: theme.colors.errorContainer, borderColor: theme.colors.onErrorContainer }]} elevation={0}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onErrorContainer, textAlign: 'center', fontWeight: '600' }}>{message}</Text>
        </Surface>

        <View style={styles.buttonContainer}>
          {showGoToSignIn && (
            <Button 
              mode="contained" 
              onPress={handleGoToSignIn} 
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              style={{ marginVertical: 4 }}
            >
              {t('screens.goToSignIn')}
            </Button>
          )}
          <Button 
            mode="outlined" 
            onPress={handleBack} 
            textColor={theme.colors.onSurface}
            style={{ marginVertical: 4, borderColor: theme.colors.outline }}
          >
            {t('screens.back')}
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
    maxWidth: 450,
    width: '100%',
    alignSelf: 'center',
  },
  messageBox: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    marginVertical: 20,
    width: '100%',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 10,
  },
});
