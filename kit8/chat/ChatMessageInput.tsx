// ChatMessageInput - the input of a theme: a text field (THE CURSOR IS PLACED IN IT when the theme opens and after every send), Attach (upload a file, or pick one of the files of the theme -
// the same file may be attached many times: a message holds its URL), Add link (a url sent apart from the text), Send (Enter on the web, Shift+Enter = a new line).
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { PMIconButton } from '../pm/inner/buttons/PMIconButton';
import { pmT } from '../pm/i18n/pmT';
import TextInputApp from '../ui/components/common/TextInputApp';
import { pickFiles } from '../files/common/pickFiles';
import { fileTitleOf, formatBytes, type FileRow } from '../files/common/fileModel';
import { attachmentError, fileViewerUrl, isSafeLink, type ChatUrlRef } from './chatModel';
import { uploadChatFile } from './chatApi';

export interface ChatSendPayload { text: string; urls: ChatUrlRef[]; files: { fileGUID: string; url: string }[] }
export interface ChatMessageInputProps {
  themeGUID: string;
  projectGUID?: string | null;
  /** the organization limit of an attachment, in bytes */
  maxBytes: number;
  /** false = Attach is disabled and says why (attachHint), e.g. no storage is connected */
  attachAvailable: boolean;
  attachHint?: string;
  /** the files of this theme (to attach one again) */
  files: FileRow[];
  onFilesChanged: () => void;
  /** true = sent (the input is emptied) */
  onSend: (m: ChatSendPayload) => Promise<boolean>;
  testID?: string;
}

interface Pending { fileGUID: string; name: string; size?: number }
interface UploadItem { id: string; name: string; fraction: number }

export default function ChatMessageInput({ themeGUID, projectGUID, maxBytes, attachAvailable, attachHint, files, onFilesChanged, onSend, testID = 'chat-input' }: ChatMessageInputProps) {
  const { themeColors: c } = useDesignSystem();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [urls, setUrls] = useState<ChatUrlRef[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [busy, setBusy] = useState(false);

  // the cursor goes to the input when the theme opens (the web needs the second try after the first layout)
  const focus = () => { try { inputRef.current?.focus(); } catch { /* not mounted */ } };
  useEffect(() => {
    focus();
    const id = setTimeout(focus, 120);
    return () => clearTimeout(id);
  }, [themeGUID]);

  const canSend = !busy && uploads.length === 0 && (text.trim() !== '' || urls.length > 0 || pending.length > 0);
  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    const ok = await onSend({ text: text.trim(), urls, files: pending.map((p) => ({ fileGUID: p.fileGUID, url: fileViewerUrl(p.fileGUID) })) });
    setBusy(false);
    if (ok) { setText(''); setUrls([]); setPending([]); setError(''); }
    focus();
  };
  const onKeyPress = (e: any) => {
    if (Platform.OS !== 'web') return;
    const ne = e?.nativeEvent || {};
    if (ne.key === 'Enter' && !ne.shiftKey) { e?.preventDefault?.(); void send(); }
  };

  const addPending = (p: Pending) => setPending((l) => (l.some((x) => x.fileGUID === p.fileGUID) ? l : [...l, p]));
  const upload = async () => {
    setError('');
    const picked = await pickFiles();
    for (const f of picked) {
      const tooBig = attachmentError(f.size, maxBytes);
      if (tooBig) { setError(tooBig); continue; }
      const id = `${Date.now()}-${f.name}`;
      setUploads((l) => [...l, { id, name: f.name, fraction: 0 }]);
      const r = await uploadChatFile(themeGUID, projectGUID, f, { onProgress: (fraction) => setUploads((l) => l.map((u) => (u.id === id ? { ...u, fraction } : u))) });
      setUploads((l) => l.filter((u) => u.id !== id));
      if (r.ok) { addPending({ fileGUID: r.file.rowGUID, name: fileTitleOf(r.file), size: r.file.rowJSON.fileSizeBytes }); onFilesChanged(); } else setError(r.error);
    }
    setAttachOpen(false);
    focus();
  };
  const addLink = () => {
    const url = linkUrl.trim();
    if (!isSafeLink(url)) { setError(pmT('A link is an http(s) address.')); return; }
    setUrls((l) => [...l, { url, ...(linkTitle.trim() ? { title: linkTitle.trim() } : {}) }]);
    setLinkUrl(''); setLinkTitle(''); setLinkOpen(false); setError('');
    focus();
  };

  return (
    <View testID={testID} style={[styles.wrap, { borderColor: c.border, backgroundColor: c.surface }]}>
      {error ? <Text testID={`${testID}-error`} style={{ color: c.error, fontSize: 12, paddingBottom: 4 }}>{error}</Text> : null}
      {(pending.length > 0 || urls.length > 0 || uploads.length > 0) ? (
        <View style={styles.chips}>
          {pending.map((p) => (
            <Pressable key={p.fileGUID} testID={`${testID}-pending-${p.fileGUID}`} onPress={() => setPending((l) => l.filter((x) => x.fileGUID !== p.fileGUID))} style={[styles.chip, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 12 }}>{`${p.name}${p.size != null ? ` (${formatBytes(p.size)})` : ''}  ×`}</Text>
            </Pressable>
          ))}
          {urls.map((u, i) => (
            <Pressable key={`${u.url}-${i}`} testID={`${testID}-pending-url-${i}`} onPress={() => setUrls((l) => l.filter((_, k) => k !== i))} style={[styles.chip, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 12 }} numberOfLines={1}>{`${u.title || u.url}  ×`}</Text>
            </Pressable>
          ))}
          {uploads.map((u) => (
            <View key={u.id} testID={`${testID}-uploading-${u.name}`} style={[styles.chip, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 12 }}>{`${u.name}  ${Math.round(u.fraction * 100)}%`}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.line}>
        <PMIconButton tipScope="app" testID={`${testID}-attach`} icon="attach_file" title={attachAvailable ? pmT('Attach a file') : (attachHint || pmT('Files are not available'))} color={c.text} disabled={!attachAvailable} onPress={() => setAttachOpen(true)} />
        <PMIconButton tipScope="app" testID={`${testID}-link`} icon="link" title={pmT('Add a link')} color={c.text} onPress={() => setLinkOpen(true)} />
        <TextInput
          ref={inputRef}
          testID={`${testID}-text`}
          autoFocus
          multiline
          value={text}
          onChangeText={setText}
          onKeyPress={onKeyPress}
          placeholder={pmT('Write a message')}
          placeholderTextColor={c.border}
          style={[styles.text, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
        />
        <PMIconButton tipScope="app" testID={`${testID}-send`} icon="send" title={pmT('Send')} color={canSend ? c.primary : c.border} disabled={!canSend} onPress={() => void send()} />
      </View>

      <Modal visible={attachOpen} transparent animationType="fade" onRequestClose={() => setAttachOpen(false)}>
        <View style={styles.backdrop}>
          <View testID={`${testID}-attach-window`} style={[styles.window, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{pmT('Attach a file')}</Text>
            <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('Up to {{mb}} MB each (the setting of the organization).', { mb: Math.floor(maxBytes / 1048576) })}</Text>
            <Pressable testID={`${testID}-upload`} onPress={() => void upload()} style={[styles.primaryBtn, { backgroundColor: c.primary }]}><Text style={{ color: '#fff', fontWeight: '700' }}>{pmT('Upload a file')}</Text></Pressable>
            <Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>{pmT('Files of this theme')}</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {files.length === 0 ? <Text testID={`${testID}-no-files`} style={{ color: c.text, opacity: 0.6 }}>{pmT('No files yet.')}</Text> : null}
              {files.map((f) => (
                <Pressable key={f.rowGUID} testID={`${testID}-reuse-${f.rowGUID}`} onPress={() => { addPending({ fileGUID: f.rowGUID, name: fileTitleOf(f), size: f.rowJSON.fileSizeBytes }); setAttachOpen(false); focus(); }} style={styles.fileRow}>
                  <Text style={{ color: c.text }} numberOfLines={1}>{`${fileTitleOf(f)}  (${formatBytes(f.rowJSON.fileSizeBytes)})`}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable testID={`${testID}-attach-close`} onPress={() => setAttachOpen(false)}><Text style={{ color: c.primary, fontWeight: '700', textAlign: 'right' }}>{pmT('Close')}</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={linkOpen} transparent animationType="fade" onRequestClose={() => setLinkOpen(false)}>
        <View style={styles.backdrop}>
          <View testID={`${testID}-link-window`} style={[styles.window, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{pmT('Add a link')}</Text>
            <TextInputApp testID={`${testID}-link-url`} label={pmT('Address (https://...)')} value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" />
            <TextInputApp testID={`${testID}-link-title`} label={pmT('Title (optional)')} value={linkTitle} onChangeText={setLinkTitle} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
              <Pressable testID={`${testID}-link-cancel`} onPress={() => setLinkOpen(false)}><Text style={{ color: c.text }}>{pmT('Cancel')}</Text></Pressable>
              <Pressable testID={`${testID}-link-add`} onPress={addLink}><Text style={{ color: c.primary, fontWeight: '700' }}>{pmT('Add')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, padding: 8 },
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  text: { flex: 1, minHeight: 40, maxHeight: 140, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3, maxWidth: 260 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  window: { width: '100%', maxWidth: 460, borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  primaryBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  fileRow: { paddingVertical: 8 },
});
