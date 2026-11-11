// FilesDriveBlock - the connection of the organization to ONE storage (documentation/FILE_ATTACHMENT_WBS.html section 4, documentation/FILE_WITH_OneDrive_WBS.html), shown in Project settings -> Files
// for the storage the project chose (Google Drive | Microsoft OneDrive): the state, the account, the root folder, Connect / Reconnect / Disconnect (only for a holder of projectFileManager -
// files_authorize 'connect'), the cleanup queue with Run cleanup, the storage used, Check files (health) + Repair.
// The administrator signs in to the storage ONCE; everybody else never sees a Google / Microsoft screen. The token lives only in the Edge Function.
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { pmT } from '../pm/i18n/pmT';
import { showErrorModal } from '../ui/components/common/ErrorModalWindow';
import { ModalAskComponent } from '../ui/components/common/ModalAskComponent';
import { authorizeFiles } from './filesDriveApi';
import { driveStateText, formatBytes, providerTitleOf, type FileStorageProvider } from './fileModel';
import { useDriveStatus, useFilesActions, useStorageUsed } from './useFiles';
import type { HealthReport } from './filesDriveApi';

const open = async (url: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  else await Linking.openURL(url);
};

/** days from today (UTC) to a YYYY-MM-DD date; NaN for a text that is no date */
export const daysUntil = (iso: string | null | undefined, today = new Date()): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return NaN;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000);
};

export default function FilesDriveBlock({ provider = 'googleDrive', testID = 'files-drive-block' }: { provider?: FileStorageProvider; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const title = providerTitleOf(provider);
  const { status, loading, error } = useDriveStatus(true, provider);
  const actions = useFilesActions({ scope: 'organization' });
  const [canConnect, setCanConnect] = useState(false);
  const [askDisconnect, setAskDisconnect] = useState(false);
  const [busy, setBusy] = useState(false);
  const used = useStorageUsed(status?.state === 'ok');
  const [health, setHealth] = useState<HealthReport | null>(null);

  useEffect(() => {
    let alive = true;
    authorizeFiles('connect', { scope: 'organization' }).then((r) => { if (alive) setCanConnect(r.ok && r.data?.allowed === true); });
    return () => { alive = false; };
  }, []);

  const connect = async () => {
    setBusy(true);
    const r = await actions.connect(provider);
    setBusy(false);
    if (r.ok) await open(r.data.url);
    else showErrorModal(r.error, pmT('Cannot connect {{provider}}', { provider: title }));
  };

  const state = status?.state ?? 'notConnected';
  const color = state === 'ok' ? c.primary : c.error;
  const notConfigured = provider === 'oneDrive' && status?.providerConfigured === false;
  const expiresIn = provider === 'oneDrive' ? daysUntil(status?.secretExpires) : NaN;
  return (
    <View testID={testID} style={[styles.box, { borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]}>{pmT(title)}</Text>
      <Text testID={`${testID}-state`} style={{ color, fontSize: 13 }}>{loading && !status ? pmT('Checking ...') : pmT(driveStateText(state, status?.accountEmail, provider))}</Text>
      {notConfigured ? <Text testID={`${testID}-not-configured`} style={{ color: c.error, fontSize: 12 }}>{pmT('{{provider}} is not configured on this server.', { provider: title })}</Text> : null}
      {canConnect && Number.isFinite(expiresIn) && expiresIn <= 30 ? (
        <Text testID={`${testID}-secret-expiry`} style={{ color: c.error, fontSize: 12 }}>
          {expiresIn < 0 ? pmT('The Microsoft client secret expired on {{date}}: create a new one and set it again.', { date: status!.secretExpires! }) : pmT('The Microsoft client secret expires in {{n}} days ({{date}}): create a new one before that.', { n: expiresIn, date: status!.secretExpires! })}
        </Text>
      ) : null}
      {error ? <Text style={{ color: c.error, fontSize: 12 }}>{error}</Text> : null}
      {status?.rootFolderUrl ? (
        <Pressable testID={`${testID}-root`} onPress={() => open(status.rootFolderUrl!)}>
          <Text style={{ color: c.primary, fontSize: 12 }} numberOfLines={1}>{pmT('Root folder (kit8root)')}: {status.rootFolderUrl}</Text>
        </Pressable>
      ) : null}
      {status && status.cleanup && (status.cleanup.waiting > 0 || status.cleanup.failed > 0) ? (
        <Text style={{ color: c.text, fontSize: 12 }}>{pmT('Cleanup')}: {status.cleanup.waiting} {pmT('waiting')}, {status.cleanup.failed} {pmT('failed')}</Text>
      ) : null}
      {used ? (
        <Text testID={`${testID}-storage`} style={{ color: c.text, fontSize: 12 }}>
          {pmT('Storage used')}: {formatBytes(used.totalBytes)} ({used.files} {pmT('files')}{used.oldVersionBytes ? `, ${pmT('old versions')} ${formatBytes(used.oldVersionBytes)}` : ''}){used.limitMegabytes ? ` ${pmT('of')} ${used.limitMegabytes} MB` : ''}
        </Text>
      ) : null}
      {canConnect ? (
        <View style={styles.buttons}>
          <Pressable testID={`${testID}-connect`} disabled={busy || notConfigured} onPress={connect} style={[styles.button, { backgroundColor: c.primary, borderColor: c.primary, opacity: busy || notConfigured ? 0.6 : 1 }]}>
            <Text style={{ color: '#fff', fontSize: 13 }}>{state === 'ok' ? pmT('Reconnect with another account') : state === 'needsReconnect' ? pmT('Reconnect {{provider}}', { provider: title }) : pmT('Connect {{provider}}', { provider: title })}</Text>
          </Pressable>
          {state !== 'notConnected' ? (
            <Pressable testID={`${testID}-disconnect`} onPress={() => setAskDisconnect(true)} style={[styles.button, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Disconnect')}</Text>
            </Pressable>
          ) : null}
          {state === 'ok' ? (
            <Pressable testID={`${testID}-health`} disabled={busy} onPress={async () => { setBusy(true); const r = await actions.healthCheck(provider); setBusy(false); if (r.ok) setHealth(r.data); else showErrorModal(r.error, pmT('Health check failed')); }} style={[styles.button, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Check files')}</Text>
            </Pressable>
          ) : null}
          {status && status.cleanup && status.cleanup.waiting + status.cleanup.failed > 0 ? (
            <Pressable testID={`${testID}-cleanup`} onPress={async () => { await actions.cleanup(); }} style={[styles.button, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Run cleanup')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('Only an administrator or a project manager connects {{provider}}.', { provider: title })}</Text>
      )}
      {health ? (
        <View testID={`${testID}-health-result`} style={{ gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 12 }}>{pmT('Folders checked')}: {health.checkedFolders}. {pmT('Missing in the storage')}: {health.missing.length}. {pmT('Not in the app')}: {health.orphans.length}.</Text>
          {health.missing.length + health.orphans.length > 0 ? (
            <Pressable testID={`${testID}-health-repair`} disabled={busy} onPress={async () => { setBusy(true); const r = await actions.healthRepair(health.missing.map((m) => m.post), health.orphans.map((o) => o.fileId), provider); setBusy(false); if (r.ok) setHealth(null); else showErrorModal(r.error, pmT('Repair failed')); }} style={[styles.button, { borderColor: c.border, alignSelf: 'flex-start' }]}>
              <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Repair: remove the rows without a file and the files without a row')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {provider === 'oneDrive' ? (
        <Text testID={`${testID}-permission-note`} style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('One Microsoft account stores the files of the whole organization; the other people never sign in to Microsoft. The application may read and write the files of that account (Microsoft has no narrower permission) but uses only the folder kit8root. Use a dedicated account that keeps its OneDrive licence.')}</Text>
      ) : (
        <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('One Google account stores the files of the whole organization; the other people never sign in to Google. Files belong to that account.')}</Text>
      )}
      <ModalAskComponent
        testID={`${testID}-disconnect-ask`}
        visible={askDisconnect}
        modalTopBar={pmT('Disconnect {{provider}}?', { provider: title })}
        modalBody={pmT('The files stay in {{provider}}, but nobody can open or add files until it is connected again.', { provider: title })}
        cancelLabel={pmT('Cancel')}
        confirmLabel={pmT('Disconnect')}
        onCancel={() => setAskDisconnect(false)}
        onConfirm={async () => { setAskDisconnect(false); const r = await actions.disconnect(provider); if (!r.ok) showErrorModal(r.error, pmT('Cannot disconnect')); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, padding: 12, borderWidth: 1, borderRadius: 10, marginTop: 8 },
  title: { fontSize: 14, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  button: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
});
