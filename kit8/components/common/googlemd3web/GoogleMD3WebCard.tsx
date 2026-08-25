import React from 'react';
import { View, Text, Platform } from 'react-native';
import { CardAppProps } from '../CardApp';
import loadMaterialWebCdn from './loadMaterialWebCdn';

const MdElevation = 'md-elevation' as any;

export const GoogleMD3WebCard: React.FC<CardAppProps & { themeColors: any; isDark: boolean }> = ({
  title,
  subtitle,
  children,
  footer,
  elevation = 1,
  onPress,
  themeColors,
  isDark,
  style,
}) => {
  if (Platform.OS === 'web') {
    return (
      <div
        onClick={onPress}
        style={{
          position: 'relative',
          backgroundColor: isDark ? '#1e293b' : '#f0f4f9',
          borderRadius: '16px',
          padding: '20px',
          margin: '12px 0',
          border: `1px solid ${isDark ? '#334155' : '#e1e3e1'}`,
          cursor: onPress ? 'pointer' : 'default',
          fontFamily: 'Roboto, system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        <MdElevation style={{ '--md-elevation-level': String(elevation) }} />

        {title && (
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: themeColors.text }}>
            {title}
          </h3>
        )}
        {subtitle && (
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: isDark ? '#94a3b8' : '#444746' }}>
            {subtitle}
          </p>
        )}
        {children && <div style={{ margin: '6px 0' }}>{children}</div>}
        {footer && (
          <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: `1px solid ${isDark ? '#334155' : '#e1e3e1'}` }}>
            {footer}
          </div>
        )}
      </div>
    );
  }

  return (
    <View style={[{ padding: 16, backgroundColor: themeColors.surface }, style]}>
      {title && <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{title}</Text>}
      {children}
    </View>
  );
};

export default GoogleMD3WebCard;
