// ChatMessageBubble - one message: author, time, text with links, link cards, file chips (each is a URL: the viewer of kit8/files), "edited" / "deleted".
// The author edits (inline) or deletes his own message.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import IconApp from '../ui/components/common/IconApp';
import { PMIconButton } from '../pm/inner/buttons/PMIconButton';
import { pmT } from '../pm/i18n/pmT';
import { formatBytes } from '../files/common/fileModel';
import { FILE_KIND_ICON } from '../files/common/fileModel';
import { isDeleted, splitTextWithLinks, type ChatMessageRow } from './chatModel';

export interface ChatMessageBubbleProps {
  message: ChatMessageRow;
  mine: boolean;
  authorName: string;
  /** the file guids that still exist in the theme; null = not known yet (nothing is marked deleted) */
  existingFiles: ReadonlySet<string> | null;
  onOpenLink: (url: string) => void;
  onEdit: (messageGUID: string, text: string) => Promise<void> | void;
  onDelete: (messageGUID: string) => void;
  /** the chat of a task of a read-only project: no Edit / Delete on the own messages */
  readOnly?: boolean;
  testID?: string;
}

const timeOf = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function ChatMessageBubble({ message, mine, authorName, existingFiles, onOpenLink, onEdit, onDelete, readOnly = false, testID = 'chat-message' }: ChatMessageBubbleProps) {
  const { themeColors: c } = useDesignSystem();
  const j = message.rowJSON || {};
  const id = message.rowGUID;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(j.text || '');
  const bg = mine ? c.primary : c.card;
  const fg = mine ? '#ffffff' : c.text;
  const link = mine ? '#e0e7ff' : c.primary;

  if (isDeleted(message)) {
    return (
      <View testID={`${testID}-${id}`} style={[styles.row, mine && styles.rowMine]}>
        <Text testID={`${testID}-${id}-deleted`} style={{ color: c.text, opacity: 0.55, fontStyle: 'italic', fontSize: 13 }}>{pmT('This message was deleted.')}</Text>
      </View>
    );
  }
  const save = async () => {
    await onEdit(id, draft);
    setEditing(false);
  };
  return (
    <View testID={`${testID}-${id}`} style={[styles.row, mine && styles.rowMine]}>
      <View style={[styles.bubble, { backgroundColor: bg, borderColor: c.border }]}>
        <View style={styles.meta}>
          <Text style={{ color: fg, opacity: 0.85, fontSize: 12, fontWeight: '700' }}>{mine ? pmT('You') : authorName}</Text>
          <Text style={{ color: fg, opacity: 0.6, fontSize: 11 }}>{timeOf(message.created_at)}{j.editedAt ? `  ·  ${pmT('edited')}` : ''}</Text>
        </View>
        {editing ? (
          <View style={{ gap: 6 }}>
            <TextInput testID={`${testID}-${id}-edit-input`} multiline value={draft} onChangeText={setDraft} style={[styles.editInput, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable testID={`${testID}-${id}-edit-save`} onPress={save}><Text style={{ color: link, fontWeight: '700' }}>{pmT('Save')}</Text></Pressable>
              <Pressable testID={`${testID}-${id}-edit-cancel`} onPress={() => { setDraft(j.text || ''); setEditing(false); }}><Text style={{ color: fg }}>{pmT('Cancel')}</Text></Pressable>
            </View>
          </View>
        ) : null}
        {!editing && j.text ? (
          <Text testID={`${testID}-${id}-text`} style={{ color: fg, fontSize: 15 }} selectable>
            {splitTextWithLinks(j.text).map((p, i) =>
              p.type === 'link' ? (
                <Text key={i} testID={`${testID}-${id}-textlink-${i}`} accessibilityRole="link" onPress={() => onOpenLink(p.value)} style={{ color: link, textDecorationLine: 'underline' }}>{p.value}</Text>
              ) : (
                <Text key={i}>{p.value}</Text>
              ),
            )}
          </Text>
        ) : null}
        {(j.urls || []).map((u, i) => (
          <Pressable key={`u${i}`} testID={`${testID}-${id}-url-${i}`} accessibilityRole="link" onPress={() => onOpenLink(u.url)} style={[styles.card, { borderColor: link }]}>
            <IconApp testID={`${testID}-${id}-url-icon-${i}`} name="link" size={16} color={link} />
            <Text style={{ color: link, textDecorationLine: 'underline', flexShrink: 1 }} numberOfLines={1}>{u.title || u.url}</Text>
          </Pressable>
        ))}
        {(j.files || []).map((f, i) => {
          const gone = !!existingFiles && !existingFiles.has(f.fileGUID);
          return gone ? (
            <View key={`f${i}`} testID={`${testID}-${id}-file-gone-${i}`} style={[styles.card, { borderColor: fg, opacity: 0.6 }]}>
              <IconApp testID={`${testID}-${id}-file-gone-icon-${i}`} name="description" size={16} color={fg} />
              <Text style={{ color: fg, fontStyle: 'italic' }} numberOfLines={1}>{`${f.name || pmT('File')} - ${pmT('file deleted')}`}</Text>
            </View>
          ) : (
            <Pressable key={`f${i}`} testID={`${testID}-${id}-file-${i}`} accessibilityRole="link" onPress={() => onOpenLink(f.url)} style={[styles.card, { borderColor: link }]}>
              <IconApp testID={`${testID}-${id}-file-icon-${i}`} name={(FILE_KIND_ICON as any)[f.kind || 'other'] || 'description'} size={16} color={link} />
              <Text style={{ color: link, textDecorationLine: 'underline', flexShrink: 1 }} numberOfLines={1}>{`${f.name || pmT('File')}${f.size != null ? `  (${formatBytes(f.size)})` : ''}`}</Text>
            </Pressable>
          );
        })}
        {mine && !editing && !readOnly ? (
          <View style={styles.actions}>
            {j.text ? <PMIconButton tipScope="app" testID={`${testID}-${id}-edit`} icon="edit" title={pmT('Edit the message')} color={fg} size={14} onPress={() => { setDraft(j.text || ''); setEditing(true); }} /> : null}
            <PMIconButton tipScope="app" testID={`${testID}-${id}-delete`} icon="delete" title={pmT('Delete the message')} color={fg} size={14} onPress={() => onDelete(id)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 4, alignItems: 'flex-start' },
  rowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '88%', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  editInput: { minWidth: 220, borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 15 },
});
