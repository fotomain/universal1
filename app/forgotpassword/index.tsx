// Forgot Password screen. Opened from Sign In ("Forgot password?") and by the reset link in the email
// (<origin>/forgotpassword#...&type=recovery on web, <scheme>://forgotpassword on iOS / Android).
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, Surface, Text } from 'react-native-paper';
import ForgotPassword from '../../kit8/components/auth/ForgotPassword';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ email?: string; returnTo?: string }>();
  const returnTo = params.returnTo || '/userprofile';

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Surface style={styles.surfaceCard} elevation={2}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, marginBottom: 16, textAlign: 'center', fontWeight: 'bold' }}>
          {t('screens.resetPasswordTitle')}
        </Text>
        <View>
          <ForgotPassword
            initialEmail={typeof params.email === 'string' ? params.email : undefined}
            onDone={() => router.replace(returnTo as any)}
            onBack={() => router.replace({ pathname: '/signin', params: { returnTo } } as any)}
          />
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  surfaceCard: { padding: 24, borderRadius: 12, maxWidth: 400, width: '100%' },
});
