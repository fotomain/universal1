// InfoModal - ONE modal for a longer description (a "help for the CFO"): a heading, then titled sections made of a few kinds of block (InfoContent). Follows the design system colours;
// the backdrop, the X, the Close button and Android back close it; the body scrolls. Used by the layout buttons of the Estimation dashboard (right click / double click / long press).
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import type { InfoBlock, InfoContent } from './infoContent';

export type { InfoBlock, InfoContent, InfoSection } from './infoContent';

export interface InfoModalProps {
  /** null = closed */
  content: InfoContent | null;
  onClose: () => void;
  closeLabel?: string;
  testID?: string;
}

export default function InfoModal({ content, onClose, closeLabel = 'Close', testID = 'info-modal' }: InfoModalProps) {
  const { themeColors: c, isDark } = useDesignSystem();
  const muted = `${c.text}99`;
  const cardBg = isDark ? '#2B2930' : '#F7F2FA';

  const block = (b: InfoBlock, key: string) => {
    switch (b.type) {
      case 'p':
        return <Text key={key} style={[styles.body, { color: c.text }, b.bold ? styles.bold : null]}>{b.text}</Text>;
      case 'kv':
        return <Text key={key} style={[styles.body, { color: c.text, marginTop: 4 }]}><Text style={styles.bold}>{b.label}: </Text>{b.text}</Text>;
      case 'formula':
        return <View key={key} style={[styles.box, { backgroundColor: cardBg, borderColor: c.border }]}><Text testID={`${testID}-formula`} style={[styles.formula, { color: c.text }]}>{b.text}</Text></View>;
      case 'bullets':
        return (
          <View key={key}>
            {b.items.map((t, i) => (
              <View key={`${key}-${i}`} style={styles.bulletRow}>
                <Text style={[styles.body, { color: muted }]}>•</Text>
                <Text style={[styles.body, { color: c.text, flex: 1 }]}>{t}</Text>
              </View>
            ))}
          </View>
        );
      case 'numbers':
        return (
          <View key={key} testID={`${testID}-numbers`} style={[styles.box, { backgroundColor: cardBg, borderColor: c.border }]}>
            <Text style={[styles.numCaption, { color: muted }]}>{b.caption}</Text>
            {b.rows.map(([label, value], i) => {
              const last = i === b.rows.length - 1;
              return (
                <View key={`${key}-${label}-${i}`} style={[styles.numRow, last && { borderTopWidth: 1, borderTopColor: c.border, marginTop: 4, paddingTop: 6 }]}>
                  <Text style={[styles.body, { color: c.text, flex: 1 }]}>{label}</Text>
                  <Text testID={last ? `${testID}-result` : undefined} style={[styles.body, styles.bold, { color: c.text }]}>{value}</Text>
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
          <Pressable testID={testID} onPress={() => undefined} style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text testID={`${testID}-heading`} style={[styles.heading, { color: c.text }]}>{content.heading}</Text>
                <Text style={[styles.sub, { color: muted }]}>{content.subheading}</Text>
              </View>
              <TouchableOpacity testID={`${testID}-close-x`} onPress={onClose} accessibilityLabel={closeLabel} hitSlop={10}>
                <Text style={{ color: muted, fontSize: 24 }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
              {content.sections.map((sec) => (
                <View key={sec.title} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: c.primary }]}>{sec.title}</Text>
                  {sec.blocks.map((b, i) => block(b, `${sec.title}-${i}`))}
                </View>
              ))}
              {content.footnote ? <Text style={[styles.note, { color: muted }]}>{content.footnote}</Text> : null}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity testID={`${testID}-close`} onPress={onClose} style={[styles.closeBtn, { backgroundColor: c.primary }]}>
                <Text style={styles.closeText}>{closeLabel}</Text>
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
  sheet: { width: '100%', maxWidth: 680, maxHeight: '92%', borderRadius: 16, borderWidth: 1, padding: 18 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  heading: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 1, letterSpacing: 0.3 },
  scroll: { flexGrow: 0 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '800' },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  box: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: 4 },
  formula: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  numCaption: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  note: { fontSize: 11, marginTop: 14, lineHeight: 15 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  closeBtn: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 18 },
  closeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
