// AppleNavigationBar - translucent (blur) navigation bar: expo-blur on iOS / Android, backdrop-filter on web.
import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useAppleMacUI } from '../WithAppleMacUI';

export interface AppleNavigationBarProps {
  title: string;
  /** large title under the bar (iOS "Large Title") */
  large?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  testID?: string;
}

export const AppleNavigationBar = memo(function AppleNavigationBar({ title, large, left, right, testID }: AppleNavigationBarProps) {
  const { theme, text } = useAppleMacUI();
  const s = useMemo(() => {
    const c = theme.colors;
    return StyleSheet.create({
      bar: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.separator,
        backgroundColor: Platform.OS === 'web' ? (theme.dark ? 'rgba(28,28,30,0.72)' : 'rgba(249,249,249,0.72)') : 'transparent',
        ...(Platform.OS === 'web' ? ({ backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' } as any) : null),
        overflow: 'hidden',
      },
      row: { minHeight: theme.size.touchTarget, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space[2] },
      side: { minWidth: theme.size.touchTarget, flexDirection: 'row', alignItems: 'center' },
      sideRight: { justifyContent: 'flex-end' },
      title: { ...text('headline'), flex: 1, textAlign: 'center', color: c.label },
      large: { ...text('largeTitle'), fontWeight: '700', color: c.label, paddingHorizontal: theme.space[4], paddingBottom: theme.space[2] },
    });
  }, [theme, text]);
  let Blur: any = null;
  if (Platform.OS !== 'web') {
    try {
      Blur = require('expo-blur').BlurView;
    } catch {
      Blur = null;
    }
  }
  const body = (
    <>
      <View style={s.row}>
        <View style={s.side}>{left}</View>
        {!large && (
          <Text style={s.title} numberOfLines={1} accessibilityRole="header" allowFontScaling>
            {title}
          </Text>
        )}
        {large && <View style={{ flex: 1 }} />}
        <View style={[s.side, s.sideRight]}>{right}</View>
      </View>
      {large && (
        <Text style={s.large} numberOfLines={1} accessibilityRole="header" allowFontScaling>
          {title}
        </Text>
      )}
    </>
  );
  return (
    <View style={s.bar} testID={testID}>
      {Blur ? (
        <Blur intensity={60} tint={theme.dark ? 'dark' : 'light'}>
          {body}
        </Blur>
      ) : (
        body
      )}
    </View>
  );
});

export default AppleNavigationBar;
