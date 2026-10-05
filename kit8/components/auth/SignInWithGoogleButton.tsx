import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

// The Google logo is bundled with the app (assets/google), so it shows without a network request.
const googleLogo = require('../../../assets/google/google-icon.png');

type Props = { onPress: () => void; disabled?: boolean; children: React.ReactNode; testID?: string };

export default function SignInWithGoogleButton({ onPress, disabled, children, testID = 'signin-with-google' }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && { opacity: 0.7 }]}
    >
      <Image source={googleLogo} style={styles.logo} />
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // White button with dark text in both light and dark themes, as Google's sign-in button guidelines ask.
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#747775',
    backgroundColor: '#fff',
  },
  logo: { width: 18, height: 18, marginRight: 10 },
  label: { color: '#1f1f1f', fontSize: 14, fontWeight: '600' },
});
