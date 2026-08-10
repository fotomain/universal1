import React from 'react';

import { Host, Icon } from "@expo/ui/jetpack-compose";
import Home from "@expo/material-symbols/home.xml";

import { Platform, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useDesignSystem } from '../../context/DesignSystemContext';
import { MaterialSymbol } from "./MaterialSymbol";

let PaperIcon: any;
let MaterialCommunityIcons: any;
let MaterialIcons: any;
let Ionicons: any;

if (Platform.OS !== 'web') {
  ({ Icon: PaperIcon } = require('react-native-paper'));
  MaterialCommunityIcons = require('@expo/vector-icons/MaterialCommunityIcons').default;
  MaterialIcons = require('@expo/vector-icons/MaterialIcons').default;
  Ionicons = require('@expo/vector-icons/Ionicons').default;
}

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
    'dots-vertical': '⋮',
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
    settings: 'gear',
    cog: 'gear',
    palette: 'paintpalette',
    theme: 'paintpalette',
    search: 'magnifyingglass',
    magnify: 'magnifyingglass',
    user: 'person',
    account: 'person',
    groups: 'person.2',
    'account-group': 'person.2',
    'user-group': 'person.2',
    login: 'arrow.right',
    logout: 'arrow.left',
    mail: 'envelope',
    email: 'envelope',
    plus: 'plus',
    add: 'plus',
    arrowleft: 'arrow.left',
    'arrow-left': 'arrow.left',
    dotsvertical: 'ellipsis',
    'dots-vertical': 'ellipsis',
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
  const iconColor = color || themeColors.text;

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

  // Icon name mapping for common cross-library icon names
  const resolveIconName = (rawName: string) => {
    switch (rawName.toLowerCase()) {
      case 'close':
      case 'x':
        return 'close';
      case 'check':
      case 'checkmark':
        return 'check';
      case 'search':
        return 'magnify';
      case 'person':
      case 'user':
        return 'account';
      case 'groups':
      case 'account-group':
      case 'user-group':
        return 'groups';
      case 'lock':
        return 'lock';
      case 'email':
      case 'mail':
        return 'email';
      case 'palette':
      case 'theme':
        return 'palette';
      case 'settings':
      case 'gear':
        return 'cog';
      case 'home':
        return 'home';
      case 'sun':
        return 'white-balance-sunny';
      case 'moon':
        return 'weather-night';
      case 'plus':
      case 'add':
        return 'plus';
      default:
        return rawName;
    }
  };

  const resolvedName = name;

  const renderIcon = () => {

    const finalName = getPlatformSymbolName(resolvedName) as any
    console.log("name1-333",finalName," --- ",iconsVariant)

    if (iconsVariant === 'materialIconsOnly') {
      return(<MaterialSymbol
          name={name} size={size}
          color={iconColor}
      />)
    }

    // if (iconsVariant === 'platformOrientedIcons') {
      return (
        <SymbolView
          name={finalName}
          size={size}
          tintColor={iconColor}
          style={style as any}
          fallback={
            <Text
              style={[
                { color: iconColor, fontSize: size, lineHeight: size, textAlign: 'center' },
                style as any,
              ]}
            >
              {getWebFallbackGlyph(resolvedName)}
            </Text>
          }
        />
      );
    // }



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

