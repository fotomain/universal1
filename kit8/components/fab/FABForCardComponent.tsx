import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
// @ts-ignore
import ReactDOM from 'react-dom';
import { Text, Surface, useTheme } from 'react-native-paper';
import FABApp from '../../../components/common/FABApp';
import { useSelector } from 'react-redux';
import { useFAB } from '../../providers/FABProvider';
import { CustomLightTheme } from '../../theme/palettes';
import { getFabMainColors, getFabMiniColors } from './fabColors';

export interface FABAction {
  icon: string;
  label?: string;
  onPress: () => void;
  color?: string;
}

export interface FABForCardComponentProps {
  cardId?: string;
  size?: 'small' | 'medium' | 'large';
  onViewNow?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  primaryColor?: string;
  actions?: FABAction[];
}

export const FABForCardComponent: React.FC<FABForCardComponentProps> = ({
  cardId,
  size = 'medium',
  onViewNow,
  onEdit,
  onShare,
  onDelete,
  actions,
}) => {
  const paperTheme = useTheme();
  const userTheme = useSelector((state: any) => state.userTheme);
  const uxuiState = useSelector((state: any) => state.uxuiState);

  const selectedFabColor = userTheme?.fabColor;
  const fabAnimationVariant = uxuiState?.fabAnimationVariant || 'defaultFABAnimation';
  const { registerFAB, notifyFABOpen, notifyFABClose } = useFAB();

  const fabIdRef = useRef(`card-fab-${cardId || Math.random().toString(36).substring(2, 9)}`);
  const mainFabRef = useRef<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [portalPos, setPortalPos] = useState<{ bottom: number; right: number }>({ bottom: 0, right: 0 });

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

  const updatePosition = () => {
    if (mainFabRef.current) {
      const el = mainFabRef.current;
      if (typeof window !== 'undefined' && el.getBoundingClientRect) {
        const rect = el.getBoundingClientRect();
        const newBottom = Math.round(window.innerHeight - rect.top + 6);
        const newRight = Math.round(window.innerWidth - rect.right);
        setPortalPos((prev) => {
          if (prev.bottom === newBottom && prev.right === newRight) {
            return prev;
          }
          return { bottom: newBottom, right: newRight };
        });
      }
    }
  };

  // Update position on scroll or resize when open (without polling interval)
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const toggleOpen = () => {
    const fabId = fabIdRef.current;
    if (!isOpen) {
      updatePosition();
      notifyFABOpen(fabId);
      setIsOpen(true);
    } else {
      notifyFABClose(fabId);
      setIsOpen(false);
    }
  };

  const defaultActions: FABAction[] = [
    ...(onViewNow ? [{ icon: 'eye-outline', label: 'View', onPress: onViewNow }] : []),
    ...(onEdit ? [{ icon: 'pencil-outline', label: 'Edit', onPress: onEdit }] : []),
    ...(onShare ? [{ icon: 'share-variant-outline', label: 'Share', onPress: onShare }] : []),
    ...(onDelete ? [{ icon: 'delete-outline', label: 'Delete', onPress: onDelete, color: CustomLightTheme.colors.error }] : []),
  ];

  const effectiveActions = actions || (defaultActions.length > 0 ? defaultActions : [
    { icon: 'eye-outline', label: 'View', onPress: () => onViewNow?.() },
  ]);

  const isReanimated = fabAnimationVariant === 'reanimatedBasicFABAnimation';
  const fabMainColors = getFabMainColors(selectedFabColor);

  const renderActionsList = () => (
    <View
      style={[
        isReanimated ? styles.actionsListReanimated : styles.actionsList,
        typeof document !== 'undefined'
          ? ({
              position: 'fixed',
              bottom: `${portalPos.bottom}px`,
              right: `${portalPos.right}px`,
              zIndex: 9999999,
            } as any)
          : { zIndex: 999999 },
      ]}
    >
      {effectiveActions.map((act, idx) => {
        let translateY: any;
        let scale: any;
        let opacity: any;
        const miniFabColors = getFabMiniColors(selectedFabColor, act.color);

        if (isReanimated) {
          const koefFromFAB = 0.3;
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
            outputRange: [20 * (idx + 1), 0],
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
            {act.label && (
              <Surface
                elevation={2}
                style={[
                  styles.labelBadge,
                  { backgroundColor: paperTheme.colors.surfaceVariant || paperTheme.colors.surface },
                ]}
              >
                <Text style={[styles.labelText, { color: paperTheme.colors.onSurfaceVariant || paperTheme.colors.onSurface }]}>
                  {act.label}
                </Text>
              </Surface>
            )}
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
  );

  return (
    <View style={styles.container}>
      {/* Expandable Action Items rendered via Portal on Web */}
      {isOpen &&
        (typeof document !== 'undefined'
          ? ReactDOM.createPortal(renderActionsList(), document.body)
          : renderActionsList())}

      {/* Main React Native Paper FAB Button */}
      <div ref={mainFabRef} style={{ display: 'inline-block' }}>
        <FABApp
          icon={isOpen ? 'close' : 'plus'}
          size={size}
          style={styles.mainFabStyle}
          backgroundColor={fabMainColors.backgroundColor}
          color={fabMainColors.iconColor}
          onPress={toggleOpen}
        />
      </div>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    zIndex: 99999,
  },
  mainFabStyle: {
    borderRadius: 16,
  },
  miniFabStyle: {
    marginLeft: 8,
    borderRadius: 12,
  },
  actionsList: {
    position: 'absolute',
    bottom: 50,
    right: 0,
    alignItems: 'flex-end',
    gap: 8,
    zIndex: 999999,
  },
  actionsListReanimated: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'flex-end',
    zIndex: 999999,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginVertical: 3,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default FABForCardComponent;
