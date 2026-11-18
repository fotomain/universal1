// The result of a QR code / barcode: what it is, what it says, Open / Copy, the offer of a media post, Scan again.
import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { ButtonPrimaryApp, ButtonSecondaryApp, showErrorModal } from '../../common';
import ResultPostOffer from '../common/ResultPostOffer';
import { useWriteMediaPost } from '../common/useWriteMediaPost';
import { buildScanPost } from '../common/notePost';
import { classifyScan, formatLabel, scanText, ScanResult } from './scanModel';

export interface ScanResultCardProps {
  result: ScanResult;
  onScanAgain: () => void;
}

export default function ScanResultCard({ result, onScanAgain }: ScanResultCardProps) {
  const theme = useTheme();
  const write = useWriteMediaPost();
  const info = classifyScan(result.value, result.type);
  const format = formatLabel(result.type);
  const [copied, setCopied] = useState(false);

  const open = async () => {
    try {
      await Linking.openURL(info.openUrl);
    } catch (e) {
      showErrorModal(e, 'Open');
    }
  };
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(scanText(result));
      setCopied(true);
    } catch (e) {
      showErrorModal(e, 'Copy');
    }
  };

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="scan-result">
      <Card.Content>
        <Text variant="labelLarge" style={{ color: theme.colors.primary }} testID="scan-result-kind">{info.label} · {format}</Text>
        {info.lines.map((line, i) => (
          <Text key={`${i}-${line}`} variant="bodyLarge" selectable style={styles.line} testID={`scan-result-line-${i}`}>{line}</Text>
        ))}
        {!info.lines.length && <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>The code is empty.</Text>}
        <View style={styles.buttons}>
          {!!info.openUrl && (
            <ButtonPrimaryApp icon="open_in_new" onPress={open} testID="scan-result-open">
              Open
            </ButtonPrimaryApp>
          )}
          <ButtonSecondaryApp icon="content_copy" onPress={copy} testID="scan-result-copy">
            {copied ? 'Copied' : 'Copy'}
          </ButtonSecondaryApp>
          <ButtonSecondaryApp icon="qr_code_scanner" onPress={onScanAgain} testID="scan-result-again">
            Scan again
          </ButtonSecondaryApp>
        </View>
        <ResultPostOffer
          testID="scan-result-post"
          onCreate={() =>
            write(
              (c) => buildScanPost({ ...c, value: result.value, formatLabel: format, typeLabel: info.label }),
              'scan result',
            )
          }
        />
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 640, borderRadius: 16, marginTop: 12 },
  line: { marginTop: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
});
