import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  G,
} from 'react-native-svg';

/**
 * The logo on the screens of the app, on EVERY platform: a light theme = the emblem on a TRANSPARENT background; the dark theme = the emblem
 * on a BLACK square (PM80_LOGO_DARK_BACKGROUND).
 */
export const pm80LogoWithBackground = (isDark: boolean): boolean => isDark;

/** the fill of the square: the given solid color, else the purple gradient of the app icon */
export const pm80LogoBackgroundFill = (backgroundColor?: string): string => backgroundColor ?? 'url(#pm80BgGrad)';

/** the background of the logo while the theme is dark */
export const PM80_LOGO_DARK_BACKGROUND = '#000000';

export interface PM80BrandLogoProps {
  /** Icon diameter/width in px (default 64) */
  size?: number;
  /** Whether to render the rounded squircle background (true for app icon, false for transparent emblem) */
  withBackground?: boolean;
  /** a solid color for that background instead of the purple gradient of the app icon (the home uses black in the dark theme) */
  backgroundColor?: string;
  /** Show brand title next to or below the emblem */
  showWordmark?: boolean;
  wordmarkPosition?: 'right' | 'bottom';
  titleColor?: string;
  subtitleColor?: string;
  testID?: string;
}

/**
 * Vector SVG Brand Logo & Multi-Platform App Icon Emblem for
 * Project Budget Management (appPM80).
 * Combines the Analogic ROI Circular Gauge, 4 Orbital Genus Nodes
 * (Time, Material, Expense, Revenue), 3 Ascending Budget Bars, and an upward ROI trend arrow.
 */
export const PM80BrandLogo: React.FC<PM80BrandLogoProps> = ({
  size = 64,
  withBackground = true,
  backgroundColor,
  showWordmark = false,
  wordmarkPosition = 'right',
  titleColor = '#0F172A',
  subtitleColor = '#64748B',
  testID = 'pm80-brand-logo',
}) => {
  const svgIcon = (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <RadialGradient id="pm80BgGrad" cx="30%" cy="25%" r="85%">
          <Stop offset="0%" stopColor="#2E1065" />
          <Stop offset="55%" stopColor="#1E1B4B" />
          <Stop offset="100%" stopColor="#090D16" />
        </RadialGradient>

        <LinearGradient id="pm80RingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#EC4899" />
          <Stop offset="45%" stopColor="#8B5CF6" />
          <Stop offset="80%" stopColor="#06B6D4" />
          <Stop offset="100%" stopColor="#10B981" />
        </LinearGradient>

        <LinearGradient id="pm80Bar1" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#60A5FA" />
          <Stop offset="100%" stopColor="#2563EB" />
        </LinearGradient>

        <LinearGradient id="pm80Bar2" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#C084FC" />
          <Stop offset="100%" stopColor="#7C3AED" />
        </LinearGradient>

        <LinearGradient id="pm80Bar3" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#34D399" />
          <Stop offset="100%" stopColor="#059669" />
        </LinearGradient>

        <LinearGradient id="pm80ArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#F472B6" />
          <Stop offset="50%" stopColor="#FBBF24" />
          <Stop offset="100%" stopColor="#34D399" />
        </LinearGradient>
      </Defs>

      {withBackground && (
        <Rect
          x="0"
          y="0"
          width="1024"
          height="1024"
          rx="228"
          fill={pm80LogoBackgroundFill(backgroundColor)}
        />
      )}

      {/* Subtle Outer Orbital Track */}
      <Circle
        cx="512"
        cy="512"
        r="380"
        stroke="#334155"
        strokeOpacity="0.45"
        strokeWidth="6"
        strokeDasharray="16 18"
        fill="none"
      />

      {/* Main Analogic ROI Gauge Track */}
      <Circle
        cx="512"
        cy="512"
        r="300"
        stroke={withBackground ? '#1E293B' : '#CBD5E1'}
        strokeWidth="54"
        fill="none"
      />

      {/* Main Analogic ROI Gauge Active Arc */}
      <Circle
        cx="512"
        cy="512"
        r="300"
        stroke="url(#pm80RingGrad)"
        strokeWidth="54"
        strokeDasharray="1520 1885"
        strokeLinecap="round"
        fill="none"
        transform="rotate(135 512 512)"
      />

      {/* 4 Satellite Genus Nodes on the Outer Orbit (Time, Material, Expense, Revenue) */}
      <Circle cx="512" cy="132" r="28" fill="#38BDF8" stroke="#0F172A" strokeWidth="10" />
      <Circle cx="892" cy="512" r="28" fill="#34D399" stroke="#0F172A" strokeWidth="10" />
      <Circle cx="512" cy="892" r="28" fill="#F472B6" stroke="#0F172A" strokeWidth="10" />
      <Circle cx="132" cy="512" r="28" fill="#A78BFA" stroke="#0F172A" strokeWidth="10" />

      {/* 3 Ascending Project Budget / ROI Pillars inside the Center Hub */}
      <G>
        <Rect x="348" y="540" width="76" height="150" rx="22" fill="url(#pm80Bar1)" />
        <Rect x="474" y="450" width="76" height="240" rx="22" fill="url(#pm80Bar2)" />
        <Rect x="600" y="340" width="76" height="350" rx="22" fill="url(#pm80Bar3)" />
      </G>

      {/* Upward ROI Trajectory Curve & Arrowhead */}
      <Path
        d="M 336 500 Q 470 430 638 286"
        stroke="url(#pm80ArrowGrad)"
        strokeWidth="28"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 578 280 L 652 274 L 646 348"
        stroke="#34D399"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );

  if (!showWordmark) {
    return <View testID={testID}>{svgIcon}</View>;
  }

  return (
    <View
      testID={testID}
      style={[
        styles.wordmarkContainer,
        wordmarkPosition === 'bottom' ? styles.colLayout : styles.rowLayout,
      ]}
    >
      {svgIcon}
      <View
        style={
          wordmarkPosition === 'bottom'
            ? styles.textCenterStack
            : styles.textSideStack
        }
      >
        <Text style={[styles.brandTitle, { color: titleColor }]}>
          Project Budget Management
        </Text>
        <Text style={[styles.brandSubtitle, { color: subtitleColor }]}>
          PM80 • Analogic ROI & EVM Suite
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wordmarkContainer: {
    alignItems: 'center',
  },
  rowLayout: {
    flexDirection: 'row',
    gap: 12,
  },
  colLayout: {
    flexDirection: 'column',
    gap: 8,
  },
  textSideStack: {
    justifyContent: 'center',
  },
  textCenterStack: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 1,
  },
});

export default PM80BrandLogo;

