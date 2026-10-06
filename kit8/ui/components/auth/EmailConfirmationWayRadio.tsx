// Radio buttons "Confirmation way": one-time code / web link (before "Send").
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, useTheme } from 'react-native-paper';
import IconApp from '../common/IconApp';
import { EMAIL_CONFIRMATION_WAYS, EmailConfirmationWay } from '../../../auth/emailOtp';

const LABEL: Record<EmailConfirmationWay, { title: string; hint: string; icon: string }> = {
  otpCode: { title: 'screens.confirmWayOtpCode', hint: 'screens.confirmWayOtpCodeHint', icon: 'pin' },
  webLink: { title: 'screens.confirmWayWebLink', hint: 'screens.confirmWayWebLinkHint', icon: 'link' },
};

export interface EmailConfirmationWayRadioProps {
  value: EmailConfirmationWay;
  onChange: (way: EmailConfirmationWay) => void;
  disabled?: boolean;
  testID?: string;
}

export default function EmailConfirmationWayRadio({ value, onChange, disabled, testID = 'email-confirmation-way' }: EmailConfirmationWayRadioProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.box} testID={testID}>
      <Text variant="labelLarge" style={[styles.legend, { color: theme.colors.onSurfaceVariant }]} nativeID={`${testID}-legend`}>
        {t('screens.confirmationWay')}
      </Text>
      <View accessibilityRole="radiogroup" aria-labelledby={`${testID}-legend`}>
        {EMAIL_CONFIRMATION_WAYS.map((way) => {
          const checked = way === value;
          const color = checked ? theme.colors.primary : theme.colors.onSurfaceVariant;
          return (
            <Pressable
              key={way}
              testID={`${testID}-${way}`}
              accessibilityRole="radio"
              accessibilityState={{ checked, disabled: !!disabled }}
              aria-checked={checked}
              disabled={disabled}
              onPress={() => { if (!checked) onChange(way); }}
              style={({ hovered }: any) => [
                styles.item,
                { borderColor: checked ? theme.colors.primary : theme.colors.outlineVariant },
                hovered && !checked ? { backgroundColor: theme.colors.surfaceVariant } : null,
                Platform.OS === 'web' ? ({ cursor: disabled ? 'default' : 'pointer' } as any) : null,
                disabled ? { opacity: 0.5 } : null,
              ]}
            >
              <IconApp name={checked ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} color={color} />
              <View style={styles.texts}>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: checked ? '700' : '500' }}>
                  {t(LABEL[way].title)}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t(LABEL[way].hint)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginBottom: 12 },
  legend: { marginBottom: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  texts: { marginLeft: 10, flex: 1 },
});
