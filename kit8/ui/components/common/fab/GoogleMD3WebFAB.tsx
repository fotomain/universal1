import React, { useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import IconApp from '../IconApp';

const MdFab = 'md-fab' as any;

export interface GoogleMD3WebFABProps {
  icon?: string;
  label?: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  backgroundColor?: string;
  disabled?: boolean;
  style?: any;
  testID?: string;
}

export const GoogleMD3WebFAB: React.FC<GoogleMD3WebFABProps> = ({
  icon = 'plus',
  label,
  onPress,
  size = 'medium',
  color,
  backgroundColor,
  disabled = false,
  style,
  testID,
}) => {
  const webFabRef = useRef<any>(null);

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 18;
      case 'large':
        return 28;
      case 'medium':
      default:
        return 24;
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web' && webFabRef.current) {
      const elem = webFabRef.current;
      const handleClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && onPress) {
          onPress();
        }
      };
      elem.addEventListener('click', handleClick);
      return () => {
        elem.removeEventListener('click', handleClick);
      };
    }
  }, [disabled, onPress]);

  if (Platform.OS === 'web') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }} test-id={testID}>
        <MdFab
          ref={webFabRef}
          label={label || undefined}
          size={size === 'small' ? 'small' : size === 'large' ? 'large' : undefined}
          disabled={disabled ? true : undefined}
          style={{
            '--md-fab-container-color': backgroundColor || '#d3e3fd',
            '--md-fab-icon-color': color || '#041e49',
            '--md-fab-label-text-color': color || '#041e49',
            '--md-fab-container-shape': label ? '28px' : '16px',
            fontFamily: 'Roboto, system-ui, sans-serif',
          }}
        >
          <span slot="icon" style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <IconApp testID="bd532467-0ace-5b67-9fk1-234567890d22" name={icon} size={getIconSize()} color={color || '#041e49'} />
          </span>
        </MdFab>
      </div>
    );
  }

  return null;
};

export default GoogleMD3WebFAB;
