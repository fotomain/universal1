import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, Surface, Text, Button } from 'react-native-paper';
import { bumpFiles } from '../../../kit8/files/useFiles';

// The page Google Drive consent comes back to (FILES_APP_RETURN_URL = <app>/user/files, documentation/FILE_ATTACHMENT_WBS.html section 4):
// the Edge Function redirects here with ?filesConnect=ok | error (&reason=...). It says what happened and goes back to the project dashboard.
export default function FilesConnectReturnScreen() {
    const theme = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{ filesConnect?: string; reason?: string }>();
    const ok = params.filesConnect === 'ok';
    const failed = params.filesConnect === 'error';

    useEffect(() => {
        bumpFiles(); // every Drive state line reads again
        if (!ok) return;
        const timer = setTimeout(() => router.replace('/pm/project/dashboard'), 1500);
        return () => clearTimeout(timer);
    }, [ok, router]);

    return (
        <View testID="files-connect-return" style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Surface style={styles.card} elevation={2}>
                <Text variant="headlineSmall" style={{ color: failed ? theme.colors.error : theme.colors.primary, textAlign: 'center', fontWeight: 'bold' }}>
                    {ok ? 'Google Drive is connected' : failed ? 'Google Drive was not connected' : 'Google Drive'}
                </Text>
                {failed && !!params.reason && (
                    <Text testID="files-connect-reason" variant="bodyMedium" style={{ color: theme.colors.onSurface, marginTop: 8, textAlign: 'center' }}>
                        {params.reason}
                    </Text>
                )}
                {!ok && !failed && (
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
                        Connect Google Drive in Project settings, tab Files.
                    </Text>
                )}
                <Button testID="files-connect-back" mode="contained" style={styles.button} onPress={() => router.replace('/pm/project/dashboard')}>
                    Back to the projects
                </Button>
            </Surface>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    card: { padding: 24, borderRadius: 12, maxWidth: 480, width: '100%' },
    button: { marginTop: 16 },
});
