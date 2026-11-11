import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useDesignSystem } from '../../providers/WithDesignSystem';

// The Microsoft logo (four squares) is drawn with Views: no asset, no network request. Same look as SignInWithGoogleButton.
const SQUARES = ['#f25022', '#7fba00', '#00a4ef', '#ffb900'];

type Props = {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  testID?: string;
  style?: any;
};

export default function SignInWithMicrosoftButton({
  onPress,
  disabled,
  children,
  testID = 'signin-with-microsoft',
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
        <View style={styles.logo}>
          {SQUARES.map((color) => (
            <View key={color} style={[styles.square, { backgroundColor: color }]} />
          ))}
        </View>
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
    // the icon is pinned at the left (same x on every sign-in button = one vertical line), the text is centered between the paddings
    justifyContent: 'center',
    paddingHorizontal: 56,
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
    position: 'absolute',
    left: 24,
  },
  logo: { width: 13, height: 13, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' },
  square: { width: 6, height: 6 },
  label: { color: '#ffffff', fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
});
