import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useTheme, Surface, Text, Button } from 'react-native-paper';
import { useAuthWithGoogle } from '../../kit8/hooks/useAuth';
import { useSupabase } from '../../kit8/providers/WithSupabase';
import { saveUserData, getUserData } from '../../kit8/lib/localSecureStorage';
import { setActiveUser, formatTo32CharGUID } from '../../kit8/redux/activeUserSlice';
import TexInputMi from '../../kit8/ui/TexInputMi';

export default function SignInScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { supabase } = useSupabase();
  const theme = useTheme();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo || '/userprofile';

  const { user: googleUser, loading: googleLoading, signIn: signInWithGoogle } = useAuthWithGoogle();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (googleUser) {
      const displayName = (googleUser as any)?.displayName || (googleUser as any)?.user_metadata?.full_name || '';
      const rawId = (googleUser as any).uid || (googleUser as any).id || 'google-user-guid';
      const activeUserGUID = formatTo32CharGUID(rawId);
      const userFirstName = displayName.split(' ')[0] || 'GoogleUser';
      const userLastName = displayName.split(' ')[1] || '';
      const userEmail = googleUser.email || '';

      saveUserData(activeUserGUID, userEmail, userFirstName, userLastName);
      dispatch(setActiveUser({
        activeUserGUID,
        activeUserEmail: userEmail,
        activeUserFirstName: userFirstName,
        activeUserLastName: userLastName,
      }));
      router.replace(returnTo as any);
      return;
    }
    getUserData().then((storedState) => {
      if (storedState.activeUserGUID && storedState.activeUserEmail) {
        dispatch(setActiveUser({
          activeUserGUID: formatTo32CharGUID(storedState.activeUserGUID),
          activeUserEmail: storedState.activeUserEmail,
          activeUserFirstName: storedState.activeUserFirstName,
          activeUserLastName: storedState.activeUserLastName,
        }));
        router.replace(returnTo as any);
      }
    });
  }, [googleUser, returnTo, dispatch]);

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in both email and password.');
      return;
    }

    setLoading(true);

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        Alert.alert('Sign In Error', signUpError.message);
        setLoading(false);
        return;
      }

      if (signUpData.user) {
        const activeUserGUID = formatTo32CharGUID(signUpData.user.id);
        const userEmail = signUpData.user.email || email;
        const userFirstName = userEmail.split('@')[0] || 'User';
        const userLastName = '';

        await saveUserData(activeUserGUID, userEmail, userFirstName, userLastName);
        dispatch(setActiveUser({
          activeUserGUID,
          activeUserEmail: userEmail,
          activeUserFirstName: userFirstName,
          activeUserLastName: userLastName,
        }));
        Alert.alert('Success', 'Account created and signed in successfully!');
        router.replace(returnTo as any);
      } else {
        Alert.alert('Notice', 'Please check your email for a confirmation link.');
      }
    } else if (signInData.user) {
      const activeUserGUID = formatTo32CharGUID(signInData.user.id);
      const userEmail = signInData.user.email || email;
      const userFirstName = userEmail.split('@')[0] || 'User';
      const userLastName = '';

      await saveUserData(activeUserGUID, userEmail, userFirstName, userLastName);
      dispatch(setActiveUser({
        activeUserGUID,
        activeUserEmail: userEmail,
        activeUserFirstName: userFirstName,
        activeUserLastName: userLastName,
      }));
      router.replace(returnTo as any);
    }

    setLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.surfaceCard} elevation={2}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, marginBottom: 24, textAlign: 'center', fontWeight: 'bold' }}>
          {t('menu.signIn')}
        </Text>

        <View style={styles.buttonWrapper}>
          {googleLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : (
            <Button 
              mode="outlined" 
              icon={({ size }) => (
                <Image 
                  source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png' }}
                  style={{ width: size, height: size }}
                  resizeMode="contain"
                />
              )}
              onPress={signInWithGoogle} 
              textColor={theme.colors.onSurface}
              style={{ borderColor: theme.colors.outline }}
            >
              {t('screens.signInWithGoogle')}
            </Button>
          )}
        </View>

        <Text style={[styles.orText, { color: theme.colors.onSurfaceVariant }]}>{t('screens.or')}</Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('screens.signInWithEmail')}
        </Text>

        <TexInputMi
          label={t('screens.email')}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          inputMode="nativePaper"
        />

        <TexInputMi
          label={t('screens.password')}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          inputMode="nativePaper"
        />

        <View style={styles.buttonWrapper}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : (
            <Button 
              mode="contained" 
              onPress={handleEmailSignIn} 
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              style={{ marginTop: 8 }}
            >
              {t('menu.signIn')}
            </Button>
          )}
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
  buttonWrapper: {
    marginVertical: 12,
  },
  orText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
});