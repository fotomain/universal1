// A route that plays something: /media/play/audio?url=<address | file | JSON list>&autoPlay=true&title=...
// (app/media/play/audio and app/media/play/video are one line each). Without `url` the user types an address or picks a file.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MediaPlayer from './MediaPlayer';
import { MediaKind, parseAutoPlayParam, parseQueueParam } from './mediaSource';
import { parseDateTimeOverParam } from './dateTimeOver';

export default function MediaPlayerScreen({ kind }: { kind: MediaKind }) {
  const { url, autoPlay, title, stamp } = useLocalSearchParams<{ url?: string; autoPlay?: string; title?: string; stamp?: string }>();
  const source = useMemo(() => parseQueueParam(url), [url]);
  // &stamp=<JSON of rowJSON.mediaDateTimeOver>: the date and time of a recording whose file does not have it
  const dateTimeOver = useMemo(() => parseDateTimeOverParam(stamp), [stamp]);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MediaPlayer kind={kind} source={source} autoPlay={parseAutoPlayParam(autoPlay)} title={Array.isArray(title) ? title[0] : title} dateTimeOver={dateTimeOver} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: 16, alignItems: 'center' } });
