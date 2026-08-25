import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';
import FABApp from '../common/FABApp';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { useFAB } from '../../providers/FABProvider';
import { CustomLightTheme } from '../../theme/palettes';
import { getFabMainColors, getFabMiniColors } from './fabColors';

export interface FABAppAction {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

export interface FABAppComponentProps {
  actions?: FABAppAction[];
  primaryColor?: string;
}

export const FABAppComponent: React.FC<FABAppComponentProps> = ({
  actions,
}) => {
  const paperTheme = useTheme();
  const router = useRouter();
  const userTheme = useSelector((state: any) => state.userTheme);
  const uxuiState = useSelector((state: any) => state.uxuiState);

  const selectedFabColor = userTheme?.fabColor;
  const fabAnimationVariant = uxuiState?.fabAnimationVariant || 'defaultFABAnimation';
  const bottomTabsAreVisible = uxuiState?.bottomTabsAreVisible || false;
  const { registerFAB, notifyFABOpen, notifyFABClose } = useFAB();

  const fabIdRef = useRef('app-global-fab');
  const [isOpen, setIsOpen] = useState(false);

  const animVal = useRef(new Animated.Value(0)).current;
  const opacityAnimVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fabId = fabIdRef.current;
    const unregister = registerFAB(fabId, (openId) => {
      if (openId !== fabId) {
        setIsOpen(false);
      }
    });
    return unregister;
  }, [registerFAB]);

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    if (fabAnimationVariant === 'reanimatedBasicFABAnimation') {
      if (isOpen) {
        Animated.parallel([
          Animated.spring(animVal, {
            toValue: 1,
            useNativeDriver: useNative,
          }),
          Animated.timing(opacityAnimVal, {
            toValue: 1,
            duration: 50,
            useNativeDriver: useNative,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.spring(animVal, {
            toValue: 0,
            useNativeDriver: useNative,
          }),
          Animated.timing(opacityAnimVal, {
            toValue: 0,
            duration: 50,
            useNativeDriver: useNative,
          }),
        ]).start();
      }
    } else {
      // defaultFABAnimation
      Animated.spring(animVal, {
        toValue: isOpen ? 1 : 0,
        useNativeDriver: useNative,
        friction: 6,
        tension: 40,
      }).start();
      opacityAnimVal.setValue(isOpen ? 1 : 0);
    }
  }, [isOpen, fabAnimationVariant, animVal, opacityAnimVal]);

  const isReanimated = fabAnimationVariant === 'reanimatedBasicFABAnimation';

  const toggleOpen = () => {
    const fabId = fabIdRef.current;
    if (!isOpen) {
      notifyFABOpen(fabId);
      setIsOpen(true);
    } else {
      notifyFABClose(fabId);
      setIsOpen(false);
    }
  };

  const defaultActions: FABAppAction[] = [
    {
      icon: 'video-outline',
      label: 'Record Video',
      onPress: () => router.push('/record/recordvideoweb?withAudio=true' as any),
    },
    {
      icon: 'microphone-outline',
      label: 'Record Audio',
      onPress: () => router.push('/record/recordaudioweb' as any),
    },
    {
      icon: 'arrow-up-bold-outline',
      label: 'Scroll Top',
      onPress: () => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
    },
  ];

  const effectiveActions = actions || defaultActions;

  const fabMainColors = getFabMainColors(selectedFabColor);

  // If bottom tabs are visible, raise the FAB higher so it doesn't overlap
  const bottomOffset = bottomTabsAreVisible ? 80 : 24;

  return (
    <View style={styles.fixedWrapper} pointerEvents="box-none">
      {/* Backdrop overlay when open */}
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => {
            setIsOpen(false);
            notifyFABClose(fabIdRef.current);
          }}
        />
      )}

      <View style={[styles.container, { bottom: bottomOffset }]} pointerEvents="box-none">
        {/* Actions List */}
        {isOpen && (
          <View style={isReanimated ? styles.actionsListReanimated : styles.actionsList}>
            {effectiveActions.map((act, idx) => {
              let translateY: any;
              let scale: any;
              let opacity: any;
              const miniFabColors = getFabMiniColors(selectedFabColor, act.color);

              if (isReanimated) {
                const koefFromFAB = 1.6;
                const hOf1Item = 50;
                const hFromFAB = 0;

                translateY = animVal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -(idx + koefFromFAB) * hOf1Item - hFromFAB],
                });
                scale = animVal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                });
                opacity = opacityAnimVal;
              } else {
                // defaultFABAnimation
                translateY = animVal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24 * (idx + 1), 0],
                });
                scale = 1;
                opacity = animVal;
              }

              return (
                <Animated.View
                  key={idx}
                  style={[
                    isReanimated ? styles.actionRowReanimated : styles.actionRow,
                    {
                      opacity,
                      transform: [{ translateY }, { scale }],
                    },
                  ]}
                >
                  <Surface
                    elevation={3}
                    style={[
                      styles.labelBadge,
                      { backgroundColor: paperTheme.colors.surfaceVariant || paperTheme.colors.surface },
                    ]}
                  >
                    <Text style={[styles.labelText, { color: paperTheme.colors.onSurfaceVariant || paperTheme.colors.onSurface }]}>
                      {act.label}
                    </Text>
                  </Surface>

                  <FABApp
                    icon={act.icon}
                    size="small"
                    style={styles.miniFabStyle}
                    backgroundColor={miniFabColors.backgroundColor}
                    color={miniFabColors.iconColor}
                    onPress={() => {
                      setIsOpen(false);
                      notifyFABClose(fabIdRef.current);
                      act.onPress();
                    }}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* Main Large FAB Button */}
        <FABApp
          icon={isOpen ? 'close' : 'plus'}
          size="large"
          style={styles.mainFabStyle}
          backgroundColor={fabMainColors.backgroundColor}
          color={fabMainColors.iconColor}
          onPress={toggleOpen}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fixedWrapper: {
    position: 'fixed' as any,
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
    zIndex: 99990,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  mainFabStyle: {
    borderRadius: 20,
  },
  miniFabStyle: {
    marginLeft: 8,
    borderRadius: 14,
  },
  actionsList: {
    position: 'absolute',
    bottom: 72,
    right: 0,
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 100000,
  },
  actionsListReanimated: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'flex-end',
    zIndex: 100000,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionRowReanimated: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  labelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default FABAppComponent;
