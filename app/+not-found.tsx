import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, Surface, Text, Button } from 'react-native-paper';

// Shown by expo-router for every URL that matches no route (the 404 page).
export default function NotFoundScreen() {
    const { t } = useTranslation();
    const theme = useTheme();
    const router = useRouter();
    const pathname = usePathname();

    return (
        <View testID="not-found-screen" style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Surface style={styles.surfaceCard} elevation={2}>
                <Text variant="displayMedium" style={{ color: theme.colors.primary, textAlign: 'center', fontWeight: 'bold' }}>
                    404
                </Text>
                <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, marginTop: 8, textAlign: 'center' }}>
                    {t('notFound.title', { defaultValue: 'Page not found' })}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
                    {t('notFound.description', { defaultValue: 'This screen does not exist.' })}
                </Text>
                {!!pathname && (
                    <Text testID="not-found-path" variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
                        {pathname}
                    </Text>
                )}
                <Button
                    testID="not-found-home"
                    mode="contained"
                    style={styles.button}
                    onPress={() => router.replace('/home')}
                >
                    {t('notFound.goHome', { defaultValue: 'Go to Home' })}
                </Button>
            </Surface>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    surfaceCard: {
        padding: 24,
        borderRadius: 12,
        maxWidth: 400,
        width: '100%',
    },
    button: {
        marginTop: 24,
    },
});
