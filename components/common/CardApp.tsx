import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Card as PaperCard} from 'react-native-paper';
import {useDesignSystem} from '../../context/DesignSystemContext';
import GoogleMD3WebCard from './googlemd3web/GoogleMD3WebCard';

export interface CardAppProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  elevation?: number;
  onPress?: () => void;
  style?: any;
  testID?: string;
}

export const CardApp: React.FC<CardAppProps> = ({
  title,
  subtitle,
  children,
  footer,
  elevation = 2,
  onPress,
  style,
}) => {
  const { activeSystem, themeColors, isDark } = useDesignSystem();

  const Container = onPress ? TouchableOpacity : View;

  switch (activeSystem) {
    case 'paper': {
      return (
        <PaperCard
          mode="elevated"
          onPress={onPress}
          style={[
            {
              marginVertical: 8,
              backgroundColor: themeColors.card,
            },
            style,
          ]}
        >
          {(title || subtitle) && <PaperCard.Title title={title} subtitle={subtitle} />}
          {children && <PaperCard.Content>{children}</PaperCard.Content>}
          {footer && <PaperCard.Actions>{footer}</PaperCard.Actions>}
        </PaperCard>
      );
    }

    case 'tamagui': {
      return (
        <Container
          onPress={onPress}
          activeOpacity={onPress ? 0.85 : 1}
          style={[
            {
              backgroundColor: themeColors.card,
              borderRadius: 16,
              padding: 18,
              marginVertical: 10,
              borderWidth: 1,
              borderColor: themeColors.border,
              boxShadow: isDark
                ? '0px 8px 24px rgba(0, 0, 0, 0.4)'
                : '0px 6px 18px rgba(0, 0, 0, 0.06)',
            },
            style,
          ]}
        >
          {title && (
            <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.text, marginBottom: 2 }}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 12 }}>
              {subtitle}
            </Text>
          )}
          {children && <View style={{ marginVertical: 4 }}>{children}</View>}
          {footer && (
            <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: themeColors.border }}>
              {footer}
            </View>
          )}
        </Container>
      );
    }

    case 'ant': {
      return (
        <Container
          onPress={onPress}
          activeOpacity={onPress ? 0.8 : 1}
          style={[
            {
              backgroundColor: themeColors.surface,
              borderRadius: 8,
              marginVertical: 8,
              borderWidth: 1,
              borderColor: themeColors.border,
              overflow: 'hidden',
            },
            style,
          ]}
        >
          {(title || subtitle) && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: themeColors.border,
                backgroundColor: isDark ? '#1a2234' : '#fafafa',
              }}
            >
              {title && (
                <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.text }}>
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}
          {children && <View style={{ padding: 16 }}>{children}</View>}
          {footer && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: themeColors.border,
                backgroundColor: isDark ? '#1a2234' : '#fafafa',
              }}
            >
              {footer}
            </View>
          )}
        </Container>
      );
    }

    case 'expo': {
      return (
        <Container
          onPress={onPress}
          activeOpacity={onPress ? 0.85 : 1}
          style={[
            {
              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              borderRadius: 20,
              padding: 20,
              marginVertical: 10,
              borderWidth: 1.5,
              borderColor: isDark ? '#334155' : '#e2e8f0',
            },
            style,
          ]}
        >
          {title && (
            <Text style={{ fontSize: 19, fontWeight: '800', color: themeColors.primary, marginBottom: 2 }}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={{ fontSize: 14, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b', marginBottom: 12 }}>
              {subtitle}
            </Text>
          )}
          {children && <View style={{ marginVertical: 6 }}>{children}</View>}
          {footer && <View style={{ marginTop: 12 }}>{footer}</View>}
        </Container>
      );
    }

    case 'googlemd3web': {
      return (
        <GoogleMD3WebCard
          title={title}
          subtitle={subtitle}
          footer={footer}
          elevation={elevation}
          onPress={onPress}
          style={style}
          themeColors={themeColors}
          isDark={isDark}
        >
          {children}
        </GoogleMD3WebCard>
      );
    }

    case 'native':
    default: {
      return (
        <Container
          onPress={onPress}
          activeOpacity={onPress ? 0.7 : 1}
          style={[
            {
              backgroundColor: themeColors.surface,
              borderRadius: 6,
              padding: 16,
              marginVertical: 8,
              borderWidth: 1,
              borderColor: themeColors.border,
            },
            style,
          ]}
        >
          {title && (
            <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text, marginBottom: 4 }}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={{ fontSize: 13, color: '#71717a', marginBottom: 8 }}>
              {subtitle}
            </Text>
          )}
          {children && <View>{children}</View>}
          {footer && <View style={{ marginTop: 12 }}>{footer}</View>}
        </Container>
      );
    }
  }
};

export default CardApp;
