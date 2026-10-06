import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useDesignSystem } from '../../../providers/WithDesignSystem';

// The Google logo is bundled with the app (assets/google), so it shows without a network request.
const googleLogo = require('../../../../assets/google/google-icon.png');

type Props = {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  testID?: string;
  style?: any;
};

export default function SignInWithGoogleButton({
  onPress,
  disabled,
  children,
  testID = 'signin-with-google',
  style,
}: Props) {
  const paperTheme = useTheme();
  let primaryColor = paperTheme?.colors?.primary || '#6366f1';
  try {
    const ds = useDesignSystem();
    if (ds?.themeColors?.primary) primaryColor = ds.themeColors.primary;
  } catch {
    // fallback if rendered outside WithDesignSystem provider
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primaryColor, borderColor: primaryColor },
        (pressed || disabled) && { opacity: 0.8 },
        style,
      ]}
    >
      <View style={styles.logoWrapper}>
        <Image source={googleLogo} style={styles.logo} />
      </View>
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  logoWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logo: { width: 16, height: 16 },
  label: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
