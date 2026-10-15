// A route that plays something: /media/play/audio?url=<address | file | JSON list>&autoPlay=true&title=...
// (app/media/play/audio and app/media/play/video are one line each). Without `url` the user types an address or picks a file.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MediaPlayer from './MediaPlayer';
import { MediaKind, parseAutoPlayParam, parseQueueParam } from './mediaSource';

export default function MediaPlayerScreen({ kind }: { kind: MediaKind }) {
  const { url, autoPlay, title } = useLocalSearchParams<{ url?: string; autoPlay?: string; title?: string }>();
  const source = useMemo(() => parseQueueParam(url), [url]);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MediaPlayer kind={kind} source={source} autoPlay={parseAutoPlayParam(autoPlay)} title={Array.isArray(title) ? title[0] : title} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: 16, alignItems: 'center' } });
