// FileViewer - the special route /files/view?post=<guid> (documentation/FILE_ATTACHMENT_WBS.html, viewers): the attached file is SHOWN, never downloaded.
// The function gives a short-lived signed link (download_url) + the name and the MIME type; the kind decides the view:
//   image -> <img> · audio / video -> <audio> / <video> (the function streams with Range) · pdf -> the bytes are read into a Blob and shown in an <iframe> (the browser's own viewer;
//   a blob page is not under the sandbox rule the function's own answers have) · text / markdown -> read as text and shown in a <pre> · anything else (zip, docx ...) -> the file is named and a
//   Download button is the ONLY way to get it. iOS / Android: an image is shown by Image, the rest is opened by the system (Linking).
import React, { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { fetchDownloadUrl } from './filesDriveApi';
import { fileKindOf, formatBytes, type FileKind } from './fileModel';

interface Loaded { url: string; name: string; mime: string; size: number; kind: FileKind }
const MAX_INLINE_BYTES = 100 * 1024 * 1024;
const h = (tag: string, props: Record<string, any>, ...children: React.ReactNode[]) => React.createElement(tag, props, ...children);

export default function FileViewer({ testID = 'file-viewer' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const web = Platform.OS === 'web';
  const params = useLocalSearchParams<{ post?: string }>();
  const post = typeof params.post === 'string' ? params.post : '';
  const [file, setFile] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!post) { setError('No file was chosen.'); return; }
    let alive = true;
    fetchDownloadUrl(post).then((r) => {
      if (!alive) return;
      if (!r.ok) { setError(r.error); return; }
      const d = r.data;
      const name = d.name || 'file';
      const mime = d.mimeType || '';
      setFile({ url: d.url, name, mime, size: Number(d.size || 0), kind: fileKindOf(mime, name) });
    });
    return () => { alive = false; };
  }, [post]);

  // pdf and text are read once (CORS is open on the function); the page title is the file name
  useEffect(() => {
    if (!file || !web) return;
    if (typeof document !== 'undefined') document.title = file.name;
    if (file.kind !== 'pdf' && file.kind !== 'image' && file.kind !== 'text' && file.kind !== 'markdown') return;
    if (file.size > MAX_INLINE_BYTES) return;
    let alive = true;
    let made: string | null = null;
    fetch(file.url).then(async (res) => {
      if (!res.ok) {
        // say WHAT the function (or Google behind it) answered, not an empty picture
        const body = (await res.text().catch(() => '')).slice(0, 200);
        throw new Error(`HTTP ${res.status}${body ? ` ${body}` : ''}`);
      }
      if (file.kind === 'pdf' || file.kind === 'image') {
        // a Blob page: the type is the one of the file, whatever header the function's answer carried
        const type = file.kind === 'pdf' ? 'application/pdf' : (file.mime.startsWith('image/') ? file.mime : (res.headers?.get?.('content-type') || 'image/jpeg'));
        made = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
        if (alive) setBlobUrl(made);
      } else {
        const t = await res.text();
        if (alive) setText(t);
      }
    }).catch((e) => { if (alive) setError(`The file could not be read (${e?.message || e}).`); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [file, web]);

  const message = (t: string, color = c.text) => <Text testID={`${testID}-message`} style={{ color, padding: 16 }}>{t}</Text>;
  if (error) return <View testID={testID} style={styles.root}>{message(error, c.error)}</View>;
  if (!file) return <View testID={testID} style={styles.root}>{message('Opening the file ...')}</View>;

  const download = (
    <Pressable testID={`${testID}-download`} onPress={() => (web ? window.open(file.url, '_blank', 'noopener') : Linking.openURL(file.url))} style={[styles.button, { borderColor: c.primary }]}>
      <Text style={{ color: c.primary }}>Download</Text>
    </Pressable>
  );

  let body: React.ReactNode;
  if (!web) {
    body = file.kind === 'image'
      ? <Image testID={`${testID}-image`} source={{ uri: file.url }} resizeMode="contain" style={styles.fill} />
      : <View style={{ padding: 16, gap: 12 }}><Text style={{ color: c.text }}>{file.name}</Text><Pressable testID={`${testID}-open`} onPress={() => Linking.openURL(file.url)} style={[styles.button, { borderColor: c.primary }]}><Text style={{ color: c.primary }}>Open</Text></Pressable></View>;
  } else if (file.kind === 'image') {
    body = !blobUrl ? message('Opening the file ...') : h('img', { 'data-testid': `${testID}-image`, src: blobUrl, alt: file.name, style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto' } });
  } else if (file.kind === 'video') {
    body = h('video', { 'data-testid': `${testID}-video`, src: file.url, controls: true, autoPlay: false, style: { maxWidth: '100%', maxHeight: '100%', margin: 'auto' } });
  } else if (file.kind === 'audio') {
    body = h('audio', { 'data-testid': `${testID}-audio`, src: file.url, controls: true, style: { margin: 'auto', width: '80%' } });
  } else if (file.kind === 'pdf') {
    body = blobUrl ? h('iframe', { 'data-testid': `${testID}-pdf`, src: blobUrl, title: file.name, style: { border: 0, width: '100%', height: '100%' } }) : message('Opening the file ...');
  } else if (file.kind === 'text' || file.kind === 'markdown') {
    body = text == null ? message('Opening the file ...') : <ScrollView testID={`${testID}-text`} style={styles.fill}>{h('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, padding: 16, fontFamily: 'monospace', fontSize: 14, color: c.text } }, text)}</ScrollView>;
  } else {
    body = <View testID={`${testID}-other`} style={{ padding: 16, gap: 12 }}><Text style={{ color: c.text }}>{`This kind of file cannot be shown in the browser: ${file.name}`}</Text>{download}</View>;
  }

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.bar, { borderColor: c.border }]}>
        <Text style={{ color: c.text, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{file.name}</Text>
        <Text style={{ color: c.text, opacity: 0.7 }}>{formatBytes(file.size)}</Text>
        {file.kind !== 'other' ? download : null}
      </View>
      <View style={styles.fill}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  button: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
});
