import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// PM80InfoModal - ONE modal for the descriptions of the home (the four ROI buttons, the four KPI rings): a heading, then titled sections made of
// a few kinds of block. The content is plain data (see roiInfo/ and kpiInfo/), so the texts can be tested without any screen.
import type { InfoBlock, InfoContent } from './infoContent';
export type { InfoBlock, InfoContent, InfoSection } from './infoContent';

export interface PM80InfoModalProps {
  /** null = closed */
  content: InfoContent | null;
  onClose: () => void;
  isDark: boolean;
  textStrong: string;
  textMuted: string;
  accent: string;
  borderColor: string;
  testID?: string;
}

export default function PM80InfoModal({ content, onClose, isDark, textStrong, textMuted, accent, borderColor, testID = 'pm80-info' }: PM80InfoModalProps) {
  const sheetBg = isDark ? '#1D1B20' : '#FFFFFF';
  const cardBg = isDark ? '#2B2930' : '#F7F2FA';

  const block = (b: InfoBlock, key: string) => {
    switch (b.type) {
      case 'p':
        return <Text key={key} style={[styles.body, { color: textStrong }, b.bold ? styles.bold : null]}>{b.text}</Text>;
      case 'kv':
        return (
          <Text key={key} style={[styles.body, { color: textStrong, marginTop: 4 }]}>
            <Text style={styles.bold}>{b.label}: </Text>{b.text}
          </Text>
        );
      case 'formula':
        return (
          <View key={key} style={[styles.formulaBox, { backgroundColor: cardBg, borderColor }]}>
            <Text testID={`${testID}-formula`} style={[styles.formula, { color: textStrong }]}>{b.text}</Text>
          </View>
        );
      case 'bullets':
        return (
          <View key={key}>
            {b.items.map((t, i) => (
              <View key={`${key}-${i}`} style={styles.bulletRow}>
                <Text style={[styles.body, { color: textMuted }]}>•</Text>
                <Text style={[styles.body, { color: textStrong, flex: 1 }]}>{t}</Text>
              </View>
            ))}
          </View>
        );
      case 'numbers':
        return (
          <View key={key} testID={`${testID}-numbers`} style={[styles.numbers, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.numCaption, { color: textMuted }]}>{b.caption}</Text>
            {b.rows.map(([label, value], i) => {
              const last = i === b.rows.length - 1;
              return (
                <View key={`${key}-${label}`} style={[styles.numRow, last && { borderTopWidth: 1, borderTopColor: borderColor, marginTop: 4, paddingTop: 6 }]}>
                  <Text style={[styles.body, { color: textStrong, flex: 1 }]}>{label}</Text>
                  <Text testID={last ? `${testID}-result` : undefined} style={[styles.body, styles.bold, { color: textStrong }]}>{value}</Text>
                </View>
              );
            })}
          </View>
        );
    }
  };

  return (
    <Modal visible={!!content} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`}>
        {content && (
          <Pressable testID={testID} onPress={() => undefined} style={[styles.sheet, { backgroundColor: sheetBg, borderColor }]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text testID={`${testID}-heading`} style={[styles.heading, { color: textStrong }]}>{content.heading}</Text>
                <Text style={[styles.sub, { color: textMuted }]}>{content.subheading}</Text>
              </View>
              <TouchableOpacity testID={`${testID}-close-x`} onPress={onClose} accessibilityLabel="Close" hitSlop={10}>
                <Text style={{ color: textMuted, fontSize: 22 }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
              {content.sections.map((sec) => (
                <View key={sec.title} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: accent }]}>{sec.title}</Text>
                  {sec.blocks.map((b, i) => block(b, `${sec.title}-${i}`))}
                </View>
              ))}
              {content.footnote ? <Text style={[styles.note, { color: textMuted }]}>{content.footnote}</Text> : null}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity testID={`${testID}-close`} onPress={onClose} style={[styles.closeBtn, { backgroundColor: accent }]}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderRadius: 20, borderWidth: 1, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  heading: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 1, letterSpacing: 0.4 },
  scroll: { flexGrow: 0 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '800' },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  formulaBox: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  formula: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  numbers: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  numCaption: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  note: { fontSize: 11, marginTop: 14, lineHeight: 15 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  closeBtn: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 18 },
  closeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
