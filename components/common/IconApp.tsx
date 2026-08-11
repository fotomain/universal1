import React from 'react';

import {Platform, StyleProp, Text, TouchableOpacity, ViewStyle} from 'react-native';
import {useDesignSystem} from '../../context/DesignSystemContext';
import {MaterialSymbol} from "./iconsvariants/MaterialSymbol";
import {PlatformOrientedIcon} from "./iconsvariants/PlatformOrientedIcon";


export interface IconAppProps {
  name: string | any;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
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
}) => {
  const { activeSystem, themeColors, iconsVariant } = useDesignSystem();
  const iconColor:string = color || themeColors.text;

  // 1. If name is a function (e.g. icon={() => <MaterialIcons ... />})
  if (typeof name === 'function') {
    const iconElement = name({ size, color: iconColor });
    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={style}>
          {iconElement}
        </TouchableOpacity>
      );
    }
    return iconElement;
  }

  console.log("name1-222",name)

  // 2. If name is already a React Element (e.g. icon={<MaterialIcons ... />})
  if (React.isValidElement(name)) {
    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={style}>
          {name}
        </TouchableOpacity>
      );
    }
    return name;
  }



  // 3. Fallback for non-string types or empty
  if (typeof name !== 'string' || !name) {
    return null;
  }

  const resolvedName:string = name;

  const renderIcon = () => {

    const finalName = getPlatformSymbolName(resolvedName) as any
    console.log("name1-333",finalName," --- ",iconsVariant)

    if (iconsVariant === 'materialIconsOnly') {
      return(<MaterialSymbol
          name={name} size={size}
          color={iconColor}
      />)
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

  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={style}>
        {renderIcon()}
      </TouchableOpacity>
    );
  }

  return renderIcon();
};

export default IconApp;

