import React from 'react';
import { Text as RNText, TextStyle } from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import { useDesignSystem } from '../../../providers/WithDesignSystem';

export interface TextAppProps {
  children: React.ReactNode;
  variant?: 'title' | 'subtitle' | 'body' | 'caption' | 'heading';
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
  testID?: string;
}

export const TextApp: React.FC<TextAppProps> = ({
  children,
  variant = 'body',
  style,
  numberOfLines,
  testID,
}) => {
  const { activeSystem, themeColors, isDark, appleMacUITheme: apple } = useDesignSystem();

  const getFontSize = () => {
    switch (variant) {
      case 'heading':
        return 24;
      case 'title':
        return 20;
      case 'subtitle':
        return 16;
      case 'caption':
        return 12;
      case 'body':
      default:
        return 14;
    }
  };

  const getFontWeight = (): TextStyle['fontWeight'] => {
    switch (variant) {
      case 'heading':
        return '800';
      case 'title':
        return '700';
      case 'subtitle':
        return '600';
      case 'caption':
        return '400';
      case 'body':
      default:
        return '400';
    }
  };

  switch (activeSystem) {
    case 'applemacui': {
      // iOS text styles (Dynamic Type "Large"): heading = Title 1 bold · title = Title 3 semibold ·
      // subtitle = Headline · body = Body · caption = Footnote (secondary label)
      const t =
        variant === 'heading'
          ? { ...apple.typography.title1, fontWeight: '700' as const }
          : variant === 'title'
          ? { ...apple.typography.title3, fontWeight: '600' as const }
          : variant === 'subtitle'
          ? apple.typography.headline
          : variant === 'caption'
          ? apple.typography.footnote
          : apple.typography.body;
      return (
        <RNText testID={testID} numberOfLines={numberOfLines} allowFontScaling style={[{ ...t, fontFamily: apple.fontFamily, color: variant === 'caption' ? apple.colors.secondaryLabel : apple.colors.label }, style]}>
          {children}
        </RNText>
      );
    }

    case 'paper': {
      const paperVariantMap: Record<string, any> = {
        heading: 'headlineMedium',
        title: 'titleLarge',
        subtitle: 'titleMedium',
        body: 'bodyMedium',
        caption: 'labelSmall',
      };
      return (
        <PaperText
          testID={testID}
          variant={paperVariantMap[variant] || 'bodyMedium'}
          numberOfLines={numberOfLines}
          style={[{ color: themeColors.text }, style]}
        >
          {children}
        </PaperText>
      );
    }

    case 'tamagui': {
      return (
        <RNText
          testID={testID}
          numberOfLines={numberOfLines}
          style={[
            {
              fontSize: getFontSize(),
              fontWeight: getFontWeight(),
              color: themeColors.text,
              letterSpacing: variant === 'heading' || variant === 'caption' ? 0.3 : 0,
            },
            style,
          ]}
        >
          {children}
        </RNText>
      );
    }

    case 'ant': {
      return (
        <RNText
          testID={testID}
          numberOfLines={numberOfLines}
          style={[
            {
              fontSize: getFontSize(),
              fontWeight: getFontWeight(),
              color: themeColors.text,
              fontFamily: 'sans-serif',
            },
            style,
          ]}
        >
          {children}
        </RNText>
      );
    }

    case 'expo': {
      return (
        <RNText
          testID={testID}
          numberOfLines={numberOfLines}
          style={[
            {
              fontSize: getFontSize(),
              fontWeight: getFontWeight(),
              color: variant === 'heading' ? themeColors.primary : themeColors.text,
            },
            style,
          ]}
        >
          {children}
        </RNText>
      );
    }

    case 'googlemd3web': {
      return (
        <RNText
          testID={testID}
          numberOfLines={numberOfLines}
          style={[
            {
              fontSize: getFontSize(),
              fontWeight: getFontWeight(),
              color: variant === 'heading' ? '#0b57d0' : themeColors.text,
              fontFamily: 'Roboto, system-ui, sans-serif',
              lineHeight: getFontSize() * 1.3,
            },
            style,
          ]}
        >
          {children}
        </RNText>
      );
    }

    case 'native':
    default: {
      return (
        <RNText
          testID={testID}
          numberOfLines={numberOfLines}
          style={[
            {
              fontSize: getFontSize(),
              fontWeight: getFontWeight(),
              color: themeColors.text,
            },
            style,
          ]}
        >
          {children}
        </RNText>
      );
    }
  }
};

export default TextApp;
