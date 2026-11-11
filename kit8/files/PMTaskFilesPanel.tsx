// PMTaskFilesPanel - the content of the tab "Files" after "Payments" in the Finances view of a task (documentation/FILE_ATTACHMENT_WBS.html, section 9).
// The files of ONE task (a stage = a task): a list with the Drive state on top, Add file / Add link / drop a file (web) for the people who may change files (files_authorize), and for everybody
// who may read: View (the function signs a short-lived link and streams the file), paper place, size. Delete is permanent and says so.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../providers/WithDesignSystem';
import IconApp from '../ui/components/common/IconApp';
import { ModalAskComponent } from '../ui/components/common/ModalAskComponent';
import { showErrorModal } from '../ui/components/common/ErrorModalWindow';
import { pmT } from '../pm/i18n/pmT';
import { PMIconButton } from '../pm/inner/buttons/PMIconButton';
import { driveStateText, FILE_KIND_ICON, fileKindOf, fileTitleOf, formatBytes, isLinkRow, type FileRow } from './fileModel';
import { useCanChangeFiles, useDocumentTypes, useDriveStatus, useFileVersions, useFilesActions, useFilesList } from './useFiles';
import { pickFiles, fromWebFile } from './pickFiles';
import type { PickedFile } from './filesDriveApi';

export interface PMTaskFilesPanelProps {
  projectGUID: string;
  /** the task of the tab; for scope 'project' / 'organization' it is not used */
  taskGUID: string;
  /** default 'task'; 'project' = the files of the whole project, 'organization' = the files of the organization (projectFileManager) */
  scope?: 'task' | 'project' | 'organization';
  testID?: string;
}

interface UploadItem { id: string; name: string; fraction: number; error?: string }

/** the older versions of a replaced file (S4): the list is read when the panel opens */
function VersionsList({ postGUID, testID }: { postGUID: string; testID: string }) {
  const { themeColors: c } = useDesignSystem();
  const versions = useFileVersions(postGUID);
  if (!versions.length) return <Text testID={`${testID}-none`} style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('No older versions.')}</Text>;
  return (
    <View testID={testID} style={{ gap: 2 }}>
      {versions.map((v) => (
        <Text key={v.rowGUID} style={{ color: c.text, opacity: 0.8, fontSize: 12 }}>
          {`v${v.rowJSON.version}  ·  ${formatBytes(v.rowJSON.fileSizeBytes)}  ·  ${(v.rowJSON.replacedAt || '').slice(0, 10)}`}
        </Text>
      ))}
    </View>
  );
}

const typeTitleOf = (types: { rowGUID: string; rowJSON: { title: string } }[], guid?: string): string => (guid ? types.find((t) => t.rowGUID === guid)?.rowJSON.title || '' : '');

const openAddress = async (url: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  else await Linking.openURL(url);
};

export default function PMTaskFilesPanel({ projectGUID, taskGUID, scope = 'task', testID = 'task-files' }: PMTaskFilesPanelProps) {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const target = useMemo(() => (scope === 'task' ? { scope: 'task' as const, guid: taskGUID, projectGUID } : scope === 'project' ? { scope: 'project' as const, guid: projectGUID, projectGUID } : { scope: 'organization' as const }), [scope, taskGUID, projectGUID]);
  const subject = scope === 'task' ? !!taskGUID : scope === 'project' ? !!projectGUID : true;
  const { rows, loading, error } = useFilesList(target, subject);
  const { canChange } = useCanChangeFiles(target, subject);
  const { status } = useDriveStatus(true);
  const actions = useFilesActions(target);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const types = useDocumentTypes(canChange);
  const [editing, setEditing] = useState<{ row: FileRow; title: string; place: string; type: string } | null>(null);
  const [movingRow, setMovingRow] = useState<FileRow | null>(null);
  const [versionsOf, setVersionsOf] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FileRow | null>(null);
  const [linkDraft, setLinkDraft] = useState<{ url: string; title: string } | null>(null);
  const dropRef = useRef<any>(null);
  const [dragOver, setDragOver] = useState(false);

  const driveReady = status?.state === 'ok';
  const addEnabled = canChange && driveReady;

  const send = useCallback(async (files: PickedFile[]) => {
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setUploads((u) => [...u, { id, name: file.name, fraction: 0 }]);
      const r = await actions.uploadFile(file, (fraction) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, fraction } : x))));
      if (r.ok) setUploads((u) => u.filter((x) => x.id !== id));
      else setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: r.error } : x)));
    }
  }, [actions]);

  // web: drop files on the panel
  useEffect(() => {
    if (Platform.OS !== 'web' || !addEnabled) return;
    const el: any = dropRef.current;
    if (!el?.addEventListener) return;
    const over = (e: any) => { e.preventDefault(); setDragOver(true); };
    const leave = () => setDragOver(false);
    const drop = (e: any) => {
      e.preventDefault();
      setDragOver(false);
      const list = Array.from(e.dataTransfer?.files || []) as any[];
      if (list.length) void send(list.map((f) => fromWebFile(f)));
    };
    el.addEventListener('dragover', over);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    return () => { el.removeEventListener('dragover', over); el.removeEventListener('dragleave', leave); el.removeEventListener('drop', drop); };
  }, [addEnabled, send]);

  const onReplace = async (row: FileRow) => {
    const files = await pickFiles();
    const file = files[0];
    if (!file) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setUploads((u) => [...u, { id, name: `${fileTitleOf(row)} (${pmT('new version')})`, fraction: 0 }]);
    const r = await actions.replaceFile(row, file, (fraction) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, fraction } : x))));
    if (r.ok) setUploads((u) => u.filter((x) => x.id !== id));
    else setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: r.error } : x)));
  };

  const onMove = async (to: { scope: 'project' | 'organization' }) => {
    const row = movingRow;
    setMovingRow(null);
    if (!row) return;
    const r = await actions.moveFile(row.rowGUID, to.scope === 'project' ? { scope: 'project', guid: projectGUID, projectGUID } : { scope: 'organization' });
    if (!r.ok) showErrorModal(r.error, pmT('Cannot move the file'));
  };

  const onAdd = async () => { const files = await pickFiles(); if (files.length) await send(files); };

  const onView = async (row: FileRow) => {
    if (isLinkRow(row)) { if (row.rowJSON.mediaPostOrigin) await openAddress(row.rowJSON.mediaPostOrigin); return; }
    // the file is SHOWN by the viewer route (never downloaded): a browser tab of its own on the web, this app on a phone
    if (Platform.OS === 'web' && typeof window !== 'undefined') { window.open(`/files/view?post=${encodeURIComponent(row.rowGUID)}`, '_blank'); return; }
    router.push({ pathname: '/files/view', params: { post: row.rowGUID } } as any);
  };

  const onConnect = async () => {
    const r = await actions.connect();
    if (r.ok) await openAddress(r.data.url);
    else showErrorModal(r.error, pmT('Cannot connect Google Drive'));
  };

  const stateColor = status?.state === 'ok' ? c.primary : c.error;

  return (
    <View ref={dropRef} testID={testID} style={[styles.root, dragOver && { borderColor: c.primary, borderWidth: 2, borderStyle: 'dashed' }]}>
      <View style={styles.bar}>
        <Text testID={`${testID}-state`} style={{ color: stateColor, fontSize: 12, flexShrink: 1 }}>
          {pmT(driveStateText(status?.state, status?.accountEmail))}
          {status && status.cleanup && (status.cleanup.waiting > 0 || status.cleanup.failed > 0) ? `  ·  ${pmT('cleanup')}: ${status.cleanup.waiting} ${pmT('waiting')}${status.cleanup.failed ? `, ${status.cleanup.failed} ${pmT('failed')}` : ''}` : ''}
        </Text>
        <View style={styles.barButtons}>
          {canChange && status && status.state !== 'ok' ? (
            <Pressable testID={`${testID}-connect`} onPress={onConnect} style={[styles.button, { borderColor: c.primary }]}>
              <Text style={{ color: c.primary, fontSize: 13 }}>{pmT(status.state === 'needsReconnect' ? 'Reconnect Google Drive' : 'Connect Google Drive')}</Text>
            </Pressable>
          ) : null}
          {addEnabled ? (
            <>
              <Pressable testID={`${testID}-add`} onPress={onAdd} style={[styles.button, { backgroundColor: c.primary, borderColor: c.primary }]}>
                <IconApp name="upload_file" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13 }}>{pmT('Add file')}</Text>
              </Pressable>
              <Pressable testID={`${testID}-add-link`} onPress={() => setLinkDraft({ url: '', title: '' })} style={[styles.button, { borderColor: c.border }]}>
                <IconApp name="link" size={16} color={c.text} />
                <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Add link')}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {!canChange && status?.state !== 'ok' ? <Text style={[styles.hint, { color: c.text }]}>{pmT('Google Drive is not connected - ask the administrator.')}</Text> : null}
      {canChange && !driveReady ? <Text style={[styles.hint, { color: c.text }]}>{pmT('Connect Google Drive to add files.')}</Text> : null}
      {addEnabled && Platform.OS === 'web' ? <Text style={[styles.hint, { color: c.text }]}>{pmT('Drop files here to add them.')}</Text> : null}

      {uploads.map((u) => (
        <View key={u.id} testID={`${testID}-upload-${u.id}`} style={[styles.row, { borderColor: c.border }]}>
          <IconApp name={u.error ? 'error' : 'cloud_upload'} size={20} color={u.error ? c.error : c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={1}>{u.name}</Text>
            <Text style={{ color: u.error ? c.error : c.text, opacity: 0.7, fontSize: 12 }}>{u.error ? u.error : `${Math.round(u.fraction * 100)} %`}</Text>
          </View>
          {u.error ? <Pressable onPress={() => setUploads((x) => x.filter((i) => i.id !== u.id))}><IconApp name="close" size={18} color={c.text} /></Pressable> : null}
        </View>
      ))}

      {error ? <Text style={{ color: c.error, fontSize: 12 }}>{error}</Text> : null}
      {!loading && rows.length === 0 && uploads.length === 0 ? <Text testID={`${testID}-empty`} style={[styles.hint, { color: c.text }]}>{pmT(scope === 'task' ? 'No files on this task.' : scope === 'project' ? 'No files on this project.' : 'No files in the organization.')}</Text> : null}

      <ScrollView style={{ flexShrink: 1 }}>
        {rows.map((row) => {
          const j = row.rowJSON;
          const kind = j.fileKind || fileKindOf(j.mediaPostMIME, j.fileName);
          return (
            <View key={row.rowGUID} testID={`${testID}-row-${row.rowGUID}`} style={[styles.row, { borderColor: c.border }]}>
              <IconApp name={isLinkRow(row) ? 'link' : FILE_KIND_ICON[kind]} size={22} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{fileTitleOf(row)}</Text>
                <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }} numberOfLines={1}>
                  {[typeTitleOf(types, j.fileDocumentTypeGUID), formatBytes(j.fileSizeBytes), j.paperDocumentPlace ? `${pmT('Paper')}: ${j.paperDocumentPlace}` : '', (j.fileVersionNumber || 1) > 1 ? `v${j.fileVersionNumber}` : ''].filter(Boolean).join('  ·  ')}
                </Text>
                {versionsOf === row.rowGUID ? <VersionsList postGUID={row.rowGUID} testID={`${testID}-versions-${row.rowGUID}`} /> : null}
              </View>
              {(j.fileVersionNumber || 1) > 1 ? (
                <PMIconButton tipScope="app" testID={`${testID}-versions-button-${row.rowGUID}`} icon="history" title={pmT('Show / hide the older versions')} color={c.text} onPress={() => setVersionsOf(versionsOf === row.rowGUID ? null : row.rowGUID)} />
              ) : null}
              <PMIconButton tipScope="app" testID={`${testID}-view-${row.rowGUID}`} icon="open_in_new" title={pmT('View the file (opens it in a new tab)')} color={c.text} onPress={() => onView(row)} />
              {canChange ? (
                <>
                  {!isLinkRow(row) ? <PMIconButton tipScope="app" testID={`${testID}-replace-${row.rowGUID}`} icon="upload_file" title={pmT('Replace with a new version (the old one is kept)')} color={c.text} onPress={() => onReplace(row)} /> : null}
                  <PMIconButton tipScope="app" testID={`${testID}-move-${row.rowGUID}`} icon="drive_file_move" title={pmT('Move to the project or the organization files')} color={c.text} onPress={() => setMovingRow(row)} />
                  <PMIconButton tipScope="app" testID={`${testID}-edit-${row.rowGUID}`} icon="edit" title={pmT('Edit the name, the type and the paper place')} color={c.text} onPress={() => setEditing({ row, title: j.mediaPostTitle || j.fileName || '', place: j.paperDocumentPlace || '', type: j.fileDocumentTypeGUID || '' })} />
                  <PMIconButton tipScope="app" testID={`${testID}-delete-${row.rowGUID}`} icon="delete" title={pmT('Delete the file from Google Drive permanently')} color={c.error} onPress={() => setDeleting(row)} />
                </>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {editing ? (
        <View testID={`${testID}-edit-form`} style={[styles.form, { borderColor: c.border }]}>
          <TextInput value={editing.title} onChangeText={(v) => setEditing({ ...editing, title: v })} placeholder={pmT('Name')} placeholderTextColor={c.text + '88'} style={[styles.input, { color: c.text, borderColor: c.border }]} />
          <TextInput value={editing.place} onChangeText={(v) => setEditing({ ...editing, place: v })} placeholder={pmT('Where the paper original is kept')} placeholderTextColor={c.text + '88'} style={[styles.input, { color: c.text, borderColor: c.border }]} />
          {types.length ? (
            <View testID={`${testID}-edit-types`} style={styles.barButtons}>
              {[{ rowGUID: '', rowJSON: { title: pmT('No type') } }, ...types].map((t) => (
                <Pressable key={t.rowGUID || 'none'} testID={`${testID}-edit-type-${t.rowGUID || 'none'}`} onPress={() => setEditing({ ...editing, type: t.rowGUID })} style={[styles.chip, { borderColor: editing.type === t.rowGUID ? c.primary : c.border, backgroundColor: editing.type === t.rowGUID ? c.primary : 'transparent' }]}>
                  <Text style={{ color: editing.type === t.rowGUID ? '#fff' : c.text, fontSize: 12 }}>{t.rowJSON.title}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.barButtons}>
            <Pressable onPress={() => setEditing(null)} style={[styles.button, { borderColor: c.border }]}><Text style={{ color: c.text }}>{pmT('Cancel')}</Text></Pressable>
            <Pressable
              testID={`${testID}-edit-save`}
              onPress={async () => {
                const r = await actions.updateFile(editing.row.rowGUID, { mediaPostTitle: editing.title.trim() || null, paperDocumentPlace: editing.place.trim() || null, ...(types.length ? { fileDocumentTypeGUID: editing.type || null } : {}) });
                if (!r.ok) showErrorModal(r.error, pmT('Cannot save'));
                setEditing(null);
              }}
              style={[styles.button, { backgroundColor: c.primary, borderColor: c.primary }]}
            ><Text style={{ color: '#fff' }}>{pmT('Save')}</Text></Pressable>
          </View>
        </View>
      ) : null}

      {linkDraft ? (
        <View testID={`${testID}-link-form`} style={[styles.form, { borderColor: c.border }]}>
          <TextInput value={linkDraft.url} onChangeText={(v) => setLinkDraft({ ...linkDraft, url: v })} autoCapitalize="none" placeholder="https://" placeholderTextColor={c.text + '88'} style={[styles.input, { color: c.text, borderColor: c.border }]} />
          <TextInput value={linkDraft.title} onChangeText={(v) => setLinkDraft({ ...linkDraft, title: v })} placeholder={pmT('Name (optional)')} placeholderTextColor={c.text + '88'} style={[styles.input, { color: c.text, borderColor: c.border }]} />
          <View style={styles.barButtons}>
            <Pressable onPress={() => setLinkDraft(null)} style={[styles.button, { borderColor: c.border }]}><Text style={{ color: c.text }}>{pmT('Cancel')}</Text></Pressable>
            <Pressable
              testID={`${testID}-link-save`}
              onPress={async () => {
                const r = await actions.addLink(linkDraft.url.trim(), linkDraft.title.trim() || undefined);
                if (!r.ok) showErrorModal(r.error, pmT('Cannot add the link'));
                else setLinkDraft(null);
              }}
              style={[styles.button, { backgroundColor: c.primary, borderColor: c.primary }]}
            ><Text style={{ color: '#fff' }}>{pmT('Add')}</Text></Pressable>
          </View>
        </View>
      ) : null}

      {movingRow ? (
        <View testID={`${testID}-move-form`} style={[styles.form, { borderColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Move the file to')}</Text>
          <View style={styles.barButtons}>
            {scope !== 'project' && projectGUID ? <Pressable testID={`${testID}-move-project`} onPress={() => onMove({ scope: 'project' })} style={[styles.button, { borderColor: c.border }]}><Text style={{ color: c.text }}>{pmT('Project files')}</Text></Pressable> : null}
            {scope !== 'organization' ? <Pressable testID={`${testID}-move-organization`} onPress={() => onMove({ scope: 'organization' })} style={[styles.button, { borderColor: c.border }]}><Text style={{ color: c.text }}>{pmT('Organization files')}</Text></Pressable> : null}
            <Pressable testID={`${testID}-move-cancel`} onPress={() => setMovingRow(null)} style={[styles.button, { borderColor: c.border }]}><Text style={{ color: c.text }}>{pmT('Cancel')}</Text></Pressable>
          </View>
        </View>
      ) : null}

      <ModalAskComponent
        testID={`${testID}-delete-ask`}
        visible={!!deleting}
        modalTopBar={pmT('Delete the file?')}
        modalBody={pmT('The file will be deleted from Google Drive permanently. This cannot be undone.')}
        cancelLabel={pmT('Cancel')}
        confirmLabel={pmT('Delete')}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const row = deleting;
          setDeleting(null);
          if (!row) return;
          const r = await actions.deleteFile(row.rowGUID);
          if (!r.ok) showErrorModal(r.error, pmT('Cannot delete'));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 12, gap: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  barButtons: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  hint: { fontSize: 12, opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { padding: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1 },
  form: { gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14 },
});
