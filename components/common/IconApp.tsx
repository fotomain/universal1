import React, { useRef } from 'react';
import { Platform, StyleProp, Text, TouchableOpacity, ViewStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useDesignSystem } from '../../context/DesignSystemContext';
import { MaterialSymbol } from "./iconsvariants/MaterialSymbol";
import { PlatformOrientedIcon } from "./iconsvariants/PlatformOrientedIcon";

export interface IconAppProps {
  name: string | any;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
}

// Generate static RFC4122 v4 UUID GUID string
function generateIconGUID(): string {
  const hexChars = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += hexChars[(Math.random() * 4 | 8)];
    } else {
      uuid += hexChars[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

export const getWebFallbackGlyph = (iconName: string): string => {
  const webFallbackGlyph: Record<string, string> = {
    list: 'list',
    menu: '☰',
    close: '✕',
    x: '✕',
    check: '✓',
    checkmark: '✓',
    home: '⌂',
    settings: '⚙',
    cog: '⚙',
    palette: '🎨',
    theme: '🎨',
    search: '⌕',
    magnify: '⌕',
    user: '👤',
    account: '👤',
    groups: '👥',
    'account-group': '👥',
    'user-group': '👥',
    login: '⇢',
    logout: '⇠',
    mail: '✉',
    email: '✉',
    plus: '+',
    add: '+',
    arrowleft: '←',
    'arrow-left': '←',
    dotsvertical: '⋮',
    'more_vert': '⋮',
    default: '•',
  };

  return webFallbackGlyph[iconName.toLowerCase()] || webFallbackGlyph.default;
};

export const getPlatformSymbolName = (rawName: string): string => {
  const fallbackMap: Record<string, string> = {
    menu: 'line.3.horizontal',
    close: 'xmark',
    x: 'xmark',
    check: 'checkmark',
    checkmark: 'checkmark',
    home: 'house',
    settings: 'settings',
    cog: 'settings',
    palette: 'paintpalette',
    theme: 'paintpalette',
    search: 'magnifyingglass',
    magnify: 'magnifyingglass',
    user: 'person',
    account: 'person',
    groups: 'person_2',
    'account-group': 'person_2',
    'user-group': 'person_2',
    login: 'arrow.right',
    logout: 'arrow.left',
    mail: 'envelope',
    email: 'envelope',
    plus: 'plus',
    add: 'plus',
    arrowleft: 'arrow.left',
    'arrow-left': 'arrow.left',
    dotsvertical: 'more_vert',
    'more_vert': 'more_vert',
    delete: 'trash',
    share: 'square.and.arrow.up',
    'pencil-outline': 'pencil',
    'share-outline': 'square.and.arrow.up',
    'delete-outline': 'trash',
  };

  const normalizedKey = rawName.toLowerCase();
  return fallbackMap[normalizedKey] || normalizedKey;
};

export const IconApp: React.FC<IconAppProps> = ({
  name,
  size = 22,
  color,
  style,
  onPress,
  onLongPress: userOnLongPress,
  testID,
}) => {
  const { activeSystem, themeColors, iconsVariant } = useDesignSystem();
  const iconColor: string = color || themeColors.text;

  // Static UUID GUID for each call of IconApp
  const iconGuidRef = useRef<string>(testID || generateIconGUID());
  const iconGuid = testID || iconGuidRef.current;
  const longPressTimerRef = useRef<any>(null);

  const handleLongPress = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(iconGuid);
      } else {
        await Clipboard.setStringAsync(iconGuid);
      }
      console.log(`[IconApp] Copied icon GUID to clipboard: ${iconGuid}`);
    } catch (err) {
      try {
        await Clipboard.setStringAsync(iconGuid);
        console.log(`[IconApp] Copied icon GUID via expo-clipboard fallback: ${iconGuid}`);
      } catch (e) {
        console.error('[IconApp] Failed to copy GUID to clipboard:', e);
      }
    }
    userOnLongPress?.();
  };

  const handleMouseDown = () => {
    if (Platform.OS === 'web') {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        handleLongPress();
      }, 400);
    }
  };

  const handleMouseUp = () => {
    if (Platform.OS === 'web' && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: any) => {
    if (Platform.OS === 'web') {
      e?.preventDefault?.();
      handleLongPress();
    }
  };

  const wrapWithTouchable = (children: React.ReactNode) => {
    const webProps = Platform.OS === 'web' ? {
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
      onContextMenu: handleContextMenu,
    } : {};

    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={onPress ? 0.7 : 1}
        style={style}
        testID={iconGuid}
        {...(webProps as any)}
      >
        {children}
      </TouchableOpacity>
    );
  };

  // 1. If name is a function (e.g. icon={() => <MaterialIcons ... />})
  if (typeof name === 'function') {
    const iconElement = name({ size, color: iconColor });
    return wrapWithTouchable(iconElement);
  }

  // 2. If name is already a React Element (e.g. icon={<MaterialIcons ... />})
  if (React.isValidElement(name)) {
    return wrapWithTouchable(name);
  }

  // 3. Fallback for non-string types or empty
  if (typeof name !== 'string' || !name) {
    return null;
  }

  const resolvedName: string = name;

  const renderIconContent = () => {
    const finalName = getPlatformSymbolName(resolvedName) as any;

    if (iconsVariant === 'materialIconsOnly') {
      return (
        <MaterialSymbol
          name={name}
          size={size}
          color={iconColor}
        />
      );
    }

    if (iconsVariant === 'platformOrientedIcons') {
      return (
        <PlatformOrientedIcon
          name={resolvedName}
          size={size}
          tintColor={iconColor}
        />
      );
    }

    if (Platform.OS === 'web') {
      return (
        <Text
          style={[
            { color: iconColor, fontSize: size, lineHeight: size, textAlign: 'center' },
            style as any,
          ]}
        >
          {getWebFallbackGlyph(resolvedName)}
        </Text>
      );
    }

    return null;
  };

  return wrapWithTouchable(renderIconContent());
};

export default IconApp;

