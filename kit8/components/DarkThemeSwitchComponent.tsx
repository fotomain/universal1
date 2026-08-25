import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import SwitchApp from './common/SwitchApp';
import { setDarkMode } from '../redux/uxuiSlice';
import { toggleThemeMode } from '../redux/userThemeSlice';
import { saveUserTheme } from '../lib/localSecureStorage';

export interface DarkThemeSwitchComponentProps {
  /** Show label with icon */
  showLabel?: boolean;
  /** Custom label text */
  label?: string;
  /** Show icon */
  showIcon?: boolean;
  /** Test ID for testing */
  testID?: string;
  /** Layout: 'row' or 'column' */
  layout?: 'row' | 'column';
}

export default function DarkThemeSwitchComponent({
  showLabel = true,
  label = 'Dark mode',
  showIcon = true,
  testID = 'darkModeSwitch',
  layout = 'row',
}: DarkThemeSwitchComponentProps) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const darkMode = useSelector((state: any) => Boolean(state.uxuiState?.darkMode));
  const userTheme = useSelector((state: any) => state.userTheme);
  const isDarkMode = userTheme?.isDark ?? darkMode;

  // themeStore-ticket-step3: handle theme mode toggle change
  const handleToggle = (val: boolean) => {
    dispatch(toggleThemeMode());
    dispatch(setDarkMode(val));
    setTimeout(() => {
      saveUserTheme({ isDark: val, colors: userTheme?.theme?.colors || {} });
    }, 100);
  };

  if (layout === 'column') {
    return (
      <View style={styles.columnContainer}>
        {showLabel && (
          <View style={styles.labelContainer}>
            {showIcon && (
              <MaterialCommunityIcons
                name="theme-light-dark"
                size={20}
                color={theme.colors.onSurfaceVariant || '#555555'}
                style={{ marginRight: 8 }}
              />
            )}
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
              {label}
            </Text>
          </View>
        )}
        <SwitchApp
          testID={testID}
          value={isDarkMode}
          onValueChange={handleToggle}
        />
      </View>
    );
  }

  return (
    <View style={styles.rowContainer}>
      {showLabel && (
        <View style={styles.labelContainer}>
          {showIcon && (
            <MaterialCommunityIcons
              name="theme-light-dark"
              size={20}
              color={theme.colors.onSurfaceVariant || '#555555'}
              style={{ marginRight: 12 }}
            />
          )}
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
            {label}
          </Text>
        </View>
      )}
      <SwitchApp
        testID={testID}
        value={isDarkMode}
        onValueChange={handleToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  columnContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
