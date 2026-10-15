// "What to play": a web address or a file path typed by the user, or a file picked from the device.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { ButtonPrimaryApp, ButtonSecondaryApp, TextInputApp } from '../common';
import { MEDIA_PICKER_TYPES, MediaKind, mediaKindFromUri, parseMediaSource } from './mediaSource';

export interface MediaSourceInputProps {
  kind: MediaKind;
  /** the text shown in the field (e.g. the source that plays now) */
  value?: string;
  /** the user wants this uri played (a valid address / file) */
  onPlay: (uri: string) => void;
}

export default function MediaSourceInput({ kind, value = '', onPlay }: MediaSourceInputProps) {
  const theme = useTheme();
  const [text, setText] = useState(value);
  const [problem, setProblem] = useState('');

  // the field follows the source that plays now
  React.useEffect(() => setText(value), [value]);

  const submit = (raw: string) => {
    const parsed = parseMediaSource(raw);
    if (parsed.type === 'invalid') {
      setProblem('Enter an https:// address, a file path, or choose a file.');
      return;
    }
    const detected = mediaKindFromUri(parsed.uri);
    setProblem(detected && detected !== kind ? `This looks like ${detected}, not ${kind}. Trying anyway.` : '');
    onPlay(parsed.uri);
  };

  const chooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: MEDIA_PICKER_TYPES[kind], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setText(asset.name || asset.uri);
      submit(asset.uri);
    } catch (e: any) {
      setProblem(String(e?.message || e));
    }
  };

  return (
    <View style={styles.box} testID="media-source-input">
      <TextInputApp
        label={`${kind === 'audio' ? 'Audio' : 'Video'} address or file path`}
        value={text}
        onChangeText={(t: string) => {
          setText(t);
          setProblem('');
        }}
        placeholder="https://… or /path/to/file"
        testID="media-source-text"
      />
      {!!problem && (
        <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }} testID="media-source-problem">
          {problem}
        </Text>
      )}
      <View style={styles.buttons}>
        <ButtonPrimaryApp icon="play_arrow" onPress={() => submit(text)} testID="media-source-play">
          Play
        </ButtonPrimaryApp>
        <ButtonSecondaryApp icon="folder_open" onPress={chooseFile} testID="media-source-choose">
          Choose file
        </ButtonSecondaryApp>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', marginBottom: 12 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
});
