import React, { useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    Animated,
    StyleProp,
    ViewStyle,
} from 'react-native';
import { Text, Avatar, useTheme, Portal } from 'react-native-paper';

export interface SpeedDialAction {
    icon: string;
    label?: string;
    containerColor?: string;
    color?: string;
    onPress: () => void;
    testID?: string;
}

export interface SpeedDialFABProps {
    open: boolean;
    visible?: boolean;
    icon?: string;
    actions: SpeedDialAction[];
    onStateChange: (state: { open: boolean }) => void;
    style?: StyleProp<ViewStyle>;
    position?: 'left' | 'right';
}

export const SpeedDialFAB: React.FC<SpeedDialFABProps> = ({
    open,
    visible = true,
    icon = 'plus',
    actions,
    onStateChange,
    style,
    position = 'left',
}) => {
    const theme = useTheme();
    const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(anim, {
            toValue: open ? 1 : 0,
            useNativeDriver: true,
            friction: 7,
            tension: 50,
        }).start();
    }, [open, anim]);

    if (!visible) return null;

    const isLeft = position === 'left';

    const backdropOpacity = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    const rotateIcon = anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '45deg'],
    });

    return (
        <Portal>
            {open && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        styles.backdrop,
                        { opacity: backdropOpacity },
                    ]}
                >
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => onStateChange({ open: false })}
                    />
                </Animated.View>
            )}

            <View
                style={[
                    styles.container,
                    isLeft ? styles.containerLeft : styles.containerRight,
                    style,
                ]}
                pointerEvents="box-none"
            >
                {/* Speed Dial Actions */}
                {open && (
                    <View
                        style={[
                            styles.actionsStack,
                            isLeft ? styles.actionsStackLeft : styles.actionsStackRight,
                        ]}
                        pointerEvents="box-none"
                    >
                        {actions.map((action, index) => {
                            const translateY = anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [20 * (actions.length - index), 0],
                            });

                            const actionOpacity = anim.interpolate({
                                inputRange: [0, 0.4, 1],
                                outputRange: [0, 0.5, 1],
                            });

                            const actionBg = action.containerColor || theme.colors.primaryContainer;
                            const actionIconColor = action.color || theme.colors.primary;

                            return (
                                <Animated.View
                                    key={`action-${index}`}
                                    style={[
                                        styles.actionRow,
                                        isLeft ? styles.actionRowLeft : styles.actionRowRight,
                                        {
                                            opacity: actionOpacity,
                                            transform: [{ translateY }],
                                        },
                                    ]}
                                    pointerEvents="box-none"
                                >
                                    {isLeft && (
                                        <Pressable
                                            onPress={() => {
                                                onStateChange({ open: false });
                                                action.onPress();
                                            }}
                                            style={({ pressed }) => [
                                                styles.actionFab,
                                                {
                                                    backgroundColor: actionBg,
                                                    shadowColor: theme.colors.shadow,
                                                    opacity: pressed ? 0.8 : 1,
                                                },
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityLabel={action.label || `Action ${index + 1}`}
                                        >
                                            <Avatar.Icon
                                                size={22}
                                                icon={action.icon}
                                                color={actionIconColor}
                                                style={{ backgroundColor: 'transparent' }}
                                            />
                                        </Pressable>
                                    )}

                                    {action.label ? (
                                        <Pressable
                                            onPress={() => {
                                                onStateChange({ open: false });
                                                action.onPress();
                                            }}
                                            style={({ pressed }) => [
                                                styles.labelBadge,
                                                {
                                                    backgroundColor: theme.colors.surface,
                                                    borderColor: theme.colors.outlineVariant,
                                                    shadowColor: theme.colors.shadow,
                                                    opacity: pressed ? 0.8 : 1,
                                                },
                                            ]}
                                        >
                                            <Text
                                                variant="labelMedium"
                                                style={[
                                                    styles.labelText,
                                                    { color: action.color || theme.colors.onSurface },
                                                ]}
                                            >
                                                {action.label}
                                            </Text>
                                        </Pressable>
                                    ) : null}

                                    {!isLeft && (
                                        <Pressable
                                            onPress={() => {
                                                onStateChange({ open: false });
                                                action.onPress();
                                            }}
                                            style={({ pressed }) => [
                                                styles.actionFab,
                                                {
                                                    backgroundColor: actionBg,
                                                    shadowColor: theme.colors.shadow,
                                                    opacity: pressed ? 0.8 : 1,
                                                },
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityLabel={action.label || `Action ${index + 1}`}
                                        >
                                            <Avatar.Icon
                                                size={22}
                                                icon={action.icon}
                                                color={actionIconColor}
                                                style={{ backgroundColor: 'transparent' }}
                                            />
                                        </Pressable>
                                    )}
                                </Animated.View>
                            );
                        })}
                    </View>
                )}

                {/* Main FAB Trigger Button */}
                <Pressable
                    onPress={() => onStateChange({ open: !open })}
                    style={({ pressed }) => [
                        styles.mainFab,
                        {
                            backgroundColor: open
                                ? theme.colors.secondaryContainer
                                : theme.colors.primaryContainer,
                            shadowColor: theme.colors.shadow,
                            opacity: pressed ? 0.85 : 1,
                        },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={open ? 'Close action menu' : 'Open action menu'}
                >
                    <Animated.View style={{ transform: [{ rotate: rotateIcon }] }}>
                        <Avatar.Icon
                            size={28}
                            icon={open ? 'close' : icon}
                            color={
                                open
                                    ? theme.colors.onSecondaryContainer
                                    : theme.colors.onPrimaryContainer
                            }
                            style={{ backgroundColor: 'transparent' }}
                        />
                    </Animated.View>
                </Pressable>
            </View>
        </Portal>
    );
};

export default SpeedDialFAB;

const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        zIndex: 998,
    },
    container: {
        position: 'absolute',
        bottom: 24,
        zIndex: 999,
    },
    containerLeft: {
        left: 24,
        alignItems: 'flex-start',
    },
    containerRight: {
        right: 24,
        alignItems: 'flex-end',
    },
    actionsStack: {
        marginBottom: 16,
        gap: 12,
    },
    actionsStackLeft: {
        alignItems: 'flex-start',
    },
    actionsStackRight: {
        alignItems: 'flex-end',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    actionRowLeft: {
        flexDirection: 'row',
    },
    actionRowRight: {
        flexDirection: 'row',
    },
    actionFab: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.16,
        shadowRadius: 4,
    },
    labelBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        elevation: 2,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
    },
    labelText: {
        fontWeight: '600',
    },
    mainFab: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
    },
});
