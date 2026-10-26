// PMRichNotes (G4) - the notes of a task with a small toolbar: Bold, Italic, Bullet. The text is saved with simple markup (**bold**, _italic_, "- " at the start of a line = a bullet)
// and shown formatted under the field. The toolbar adds the marks at the end of the text (the text field has no selection API on every platform); typing the marks by hand works the same.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import TextAreaApp from '../../ui/components/common/TextAreaApp';
import { PMDialogButton } from '../inner/buttons';
import { pmT } from '../i18n/pmT';

export interface PMRichRun { text: string; bold: boolean; italic: boolean }
export interface PMRichLine { bullet: boolean; runs: PMRichRun[] }

/** the lines and runs of a text with **bold**, _italic_ and "- " bullets (pure) */
export function richLinesOf(text: string): PMRichLine[] {
  return (text || '').split(/\r?\n/).map((raw) => {
    const bullet = /^\s*[-*]\s+/.test(raw);
    const body = bullet ? raw.replace(/^\s*[-*]\s+/, '') : raw;
    const runs: PMRichRun[] = [];
    const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      if (m.index > last) runs.push({ text: body.slice(last, m.index), bold: false, italic: false });
      const tok = m[0];
      runs.push(tok.startsWith('**') ? { text: tok.slice(2, -2), bold: true, italic: false } : { text: tok.slice(1, -1), bold: false, italic: true });
      last = m.index + tok.length;
    }
    if (last < body.length) runs.push({ text: body.slice(last), bold: false, italic: false });
    return { bullet, runs: runs.length ? runs : [{ text: '', bold: false, italic: false }] };
  });
}

/** the text after a toolbar button: appends the marks (a bullet starts a new line) */
export function richAppend(text: string, kind: 'bold' | 'italic' | 'bullet'): string {
  if (kind === 'bold') return `${text}**${pmT('bold')}**`;
  if (kind === 'italic') return `${text}_${pmT('italic')}_`;
  return `${text}${text && !text.endsWith('\n') ? '\n' : ''}- `;
}

export default function PMRichNotes({ value, onChangeText, label }: { value: string; onChangeText: (v: string) => void; label: string }) {
  const { themeColors: c } = useDesignSystem();
  const lines = richLinesOf(value);
  const formatted = lines.some((l) => l.bullet || l.runs.some((r) => r.bold || r.italic));
  return (
    <View testID="pm-rich-notes">
      <View style={styles.bar}>
        <PMDialogButton testID="pm-notes-bold" kind="text" title="B" onPress={() => onChangeText(richAppend(value, 'bold'))} />
        <PMDialogButton testID="pm-notes-italic" kind="text" title="I" onPress={() => onChangeText(richAppend(value, 'italic'))} />
        <PMDialogButton testID="pm-notes-bullet" kind="text" icon="format_list_bulleted" title={pmT('Bullet')} onPress={() => onChangeText(richAppend(value, 'bullet'))} />
      </View>
      <TextAreaApp label={label} value={value} onChangeText={onChangeText} numberOfLines={4} style={{ marginTop: 4 }} />
      {formatted && (
        <View testID="pm-notes-preview" style={[styles.preview, { borderColor: c.border }]}>
          {lines.map((l, i) => (
            <Text key={i} style={{ color: c.text, fontSize: 13 }}>
              {l.bullet ? '•  ' : ''}
              {l.runs.map((r, k) => (
                <Text key={k} style={{ fontWeight: r.bold ? '700' : '400', fontStyle: r.italic ? 'italic' : 'normal' }}>{r.text}</Text>
              ))}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 4, marginTop: 8 },
  preview: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, padding: 8, marginTop: 4, gap: 2 },
});
