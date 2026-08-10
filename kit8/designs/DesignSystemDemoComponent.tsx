import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../context/DesignSystemContext';
import ThemeSwitcher from '../../components/ThemeSwitcher';
import TextApp from '../../components/common/TextApp';
import TextInputApp from '../../components/common/TextInputApp';
import ButtonPrimaryApp from '../../components/common/ButtonPrimaryApp';
import ButtonSecondaryApp from '../../components/common/ButtonSecondaryApp';
import ButtonTextApp from '../../components/common/ButtonTextApp';
import CardApp from '../../components/common/CardApp';
import SwitchApp from '../../components/common/SwitchApp';
import IconApp from '../../components/common/IconApp';

export const DesignSystemDemoComponent: React.FC = () => {
  const { activeSystem, themeColors, isDark } = useDesignSystem();

  // Redux state inspection
  const uxuiState = useSelector((state: any) => state?.uxuiState);
  const userTheme = useSelector((state: any) => state?.userTheme);

  // Form State
  const [username, setUsername] = useState('Alex Developer');
  const [email, setEmail] = useState('alex@example.com');
  const [notifications, setNotifications] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<string | null>(null);

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmittedData(
        JSON.stringify({ activeSystem, username, email, notifications, analytics }, null, 2)
      );
    }, 800);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {/* Header */}
      <TextApp variant="heading" style={{ marginBottom: 4 }}>
        Kit8 Design System Strategy
      </TextApp>
      <TextApp variant="caption" style={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: 14 }}>
        Unified Component Abstraction Layer for Tamagui, Paper, Ant Design, Native & Expo UI
      </TextApp>

      {/* Floating Theme Switcher */}
      <ThemeSwitcher />

      {/* Redux State Dashboard Card */}
      <CardApp
        title="Redux Entities State (uxuiState & userTheme)"
        subtitle="Live state synchronized with Redux store & persistence strategy"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 6 }}>
          <View style={styles.badge}>
            <TextApp variant="caption" style={{ color: themeColors.primary, fontWeight: '700' }}>
              Active System: {uxuiState?.activeDesignSystem || activeSystem}
            </TextApp>
          </View>
          <View style={styles.badge}>
            <TextApp variant="caption" style={{ color: userTheme?.isDark ? '#38bdf8' : '#0284c7', fontWeight: '700' }}>
              Redux isDark: {String(userTheme?.isDark ?? false)}
            </TextApp>
          </View>
          <View style={styles.badge}>
            <TextApp variant="caption" style={{ color: uxuiState?.darkMode ? '#a855f7' : '#9333ea', fontWeight: '700' }}>
              uxuiState.darkMode: {String(uxuiState?.darkMode ?? false)}
            </TextApp>
          </View>
        </View>
      </CardApp>

      {/* Interactive Form Demo */}
      <CardApp
        title="Unified Form Components"
        subtitle={`Currently rendering with Strategy: ${activeSystem.toUpperCase()}`}
      >
        <TextInputApp
          label="User Name"
          value={username}
          onChangeText={setUsername}
          placeholder="Enter full name"
          helperText="Standardized prop mapped to native component API"
        />

        <TextInputApp
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="name@company.com"
          keyboardType="email-address"
        />

        <SwitchApp
          label="Enable Push Notifications"
          value={notifications}
          onValueChange={setNotifications}
        />

        <SwitchApp
          label="Share Usage Analytics"
          value={analytics}
          onValueChange={setAnalytics}
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <ButtonPrimaryApp
            title="Submit Settings"
            onPress={handleSubmit}
            loading={submitting}
            style={{ flex: 1 }}
          />
          <ButtonSecondaryApp
            title="Reset Form"
            onPress={() => {
              setUsername('Alex Developer');
              setEmail('alex@example.com');
              setSubmittedData(null);
            }}
            style={{ flex: 1 }}
          />
        </View>

        {submittedData && (
          <View
            style={{
              marginTop: 14,
              padding: 12,
              backgroundColor: isDark ? '#111827' : '#f8fafc',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
          >
            <TextApp variant="caption" style={{ color: themeColors.primary, marginBottom: 4, fontWeight: '700' }}>
              Form Submitted Output:
            </TextApp>
            <TextApp variant="caption" style={{ fontFamily: 'Courier', fontSize: 11 }}>
              {submittedData}
            </TextApp>
          </View>
        )}
      </CardApp>

      {/* Multi-System Architecture Blueprint Showcase */}
      <CardApp
        title="Architecture Pattern"
        subtitle="Abstract Factory & Strategy Pattern"
      >
        <TextApp variant="body" style={{ marginBottom: 8, lineHeight: 20 }}>
          The <TextApp style={{ fontWeight: '700' }}>Unified Component Abstraction Layer</TextApp> decouples UI rendering from business logic. Screens consume standardized props (`TextInputApp`, `ButtonApp`, `CardApp`) without directly depending on UI libraries.
        </TextApp>

        <View style={styles.strategyRow}>
          <TextApp variant="caption" style={{ color: '#6366f1', fontWeight: '700' }}>1. Tamagui Strategy:</TextApp>
          <TextApp variant="caption"> Maps props to Tamagui Stack & Input with tokenized styles.</TextApp>
        </View>
        <View style={styles.strategyRow}>
          <TextApp variant="caption" style={{ color: '#ec4899', fontWeight: '700' }}>2. Paper Strategy:</TextApp>
          <TextApp variant="caption"> Maps props to React Native Paper MD3 components & HelperText.</TextApp>
        </View>
        <View style={styles.strategyRow}>
          <TextApp variant="caption" style={{ color: '#10b981', fontWeight: '700' }}>3. Ant Design Strategy:</TextApp>
          <TextApp variant="caption"> Maps props to Ant Design React Native InputItem & Button style.</TextApp>
        </View>
        <View style={styles.strategyRow}>
          <TextApp variant="caption" style={{ color: '#f59e0b', fontWeight: '700' }}>4. Expo UI Strategy:</TextApp>
          <TextApp variant="caption"> Maps props to Expo Universal native elements & pill borders.</TextApp>
        </View>
        <View style={styles.strategyRow}>
          <TextApp variant="caption" style={{ color: '#8b5cf6', fontWeight: '700' }}>5. Native Strategy:</TextApp>
          <TextApp variant="caption"> Maps props to standard React Native Primitives with clean styling.</TextApp>
        </View>
      </CardApp>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  strategyRow: {
    marginVertical: 4,
  },
});

export default DesignSystemDemoComponent;
