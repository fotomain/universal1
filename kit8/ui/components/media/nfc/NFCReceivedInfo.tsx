// The tags that were read: one card each - what the tag says (every NDEF record), its technical data, Open / Copy / Create media post / Remove.
import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { ButtonPrimaryApp, ButtonSecondaryApp, ButtonTextApp, showErrorModal } from '../../common';
import ResultPostOffer from '../common/ResultPostOffer';
import { useWriteMediaPost } from '../common/useWriteMediaPost';
import { buildNfcPost } from '../common/notePost';
import type { NfcReceived } from './nfcModel';

export interface NFCReceivedInfoProps {
  reads: NfcReceived[];
  onRemove: (key: string) => void;
  onClear: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const timeOf = (at: number) => {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function NfcReadCard({ read, onRemove }: { read: NfcReceived; onRemove: (key: string) => void }) {
  const theme = useTheme();
  const write = useWriteMediaPost();
  const [copied, setCopied] = useState(false);
  const { info } = read;

  const open = async () => {
    try {
      await Linking.openURL(info.openUrl);
    } catch (e) {
      showErrorModal(e, 'Open');
    }
  };
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(info.text || info.summary);
      setCopied(true);
    } catch (e) {
      showErrorModal(e, 'Copy');
    }
  };

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID={`nfc-read-${read.key}`}>
      <Card.Content>
        <View style={styles.head}>
          <Text variant="labelLarge" style={{ color: theme.colors.primary }} testID={`nfc-read-summary-${read.key}`}>{info.summary}</Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {timeOf(read.at)}{read.source === 'background' ? ' · background' : ''}
          </Text>
        </View>
        {info.records.map((r, i) => (
          <View key={`${read.key}-${i}`} style={styles.record} testID={`nfc-record-${read.key}-${i}`}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{r.label}{r.lang ? ` (${r.lang})` : ''} · {r.size} B</Text>
            {!!r.text && <Text variant="bodyLarge" selectable>{r.text}</Text>}
          </View>
        ))}
        {!info.hasMessage && <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>The tag has no NDEF message (it may be empty or use another format).</Text>}
        <Text variant="bodySmall" style={[styles.tech, { color: theme.colors.onSurfaceVariant }]} testID={`nfc-tech-${read.key}`}>
          {[info.id && `Id ${info.id}`, info.typeName, info.techTypes.join(', '), info.capacity ? `${info.capacity} B` : '', info.writable === false ? 'read only' : '']
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={styles.buttons}>
          {!!info.openUrl && (
            <ButtonPrimaryApp icon="open_in_new" onPress={open} testID={`nfc-open-${read.key}`}>
              Open
            </ButtonPrimaryApp>
          )}
          <ButtonSecondaryApp icon="content_copy" onPress={copy} testID={`nfc-copy-${read.key}`}>
            {copied ? 'Copied' : 'Copy'}
          </ButtonSecondaryApp>
          <ButtonTextApp onPress={() => onRemove(read.key)} testID={`nfc-remove-${read.key}`}>
            Remove
          </ButtonTextApp>
        </View>
        <ResultPostOffer
          testID={`nfc-post-${read.key}`}
          onCreate={() =>
            write((c) => buildNfcPost({ ...c, tagId: info.id, summary: info.summary, text: info.text, techTypes: info.techTypes }), 'NFC result')
          }
        />
      </Card.Content>
    </Card>
  );
}

export default function NFCReceivedInfo({ reads, onRemove, onClear }: NFCReceivedInfoProps) {
  const theme = useTheme();
  if (!reads.length) {
    return (
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }} testID="nfc-empty">
        No tag was read yet. Hold a tag near the back of the phone.
      </Text>
    );
  }
  return (
    <View style={styles.list} testID="nfc-received">
      <View style={styles.listHead}>
        <Text variant="titleMedium">Received ({reads.length})</Text>
        <ButtonTextApp onPress={onClear} testID="nfc-clear">
          Clear
        </ButtonTextApp>
      </View>
      {reads.map((r) => (
        <NfcReadCard key={r.key} read={r} onRemove={onRemove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { width: '100%', maxWidth: 640, marginTop: 12 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { borderRadius: 16, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  record: { marginTop: 8 },
  tech: { marginTop: 10 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' },
});
