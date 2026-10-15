// THE reusable player (audio | video, web + iOS + Android).
//   <MediaPlayer kind="video" source="https://…/a.mp4" />              plays a web address
//   <MediaPlayer kind="audio" source="file:///…/a.m4a" autoPlay />     plays a file of the device
//   <MediaPlayer kind="video" source={[seg1, seg2]} />                 several files, one after the other
//   <MediaPlayer kind="audio" />                                       asks the user: address or file (MediaSourceInput)
// Called by a route (app/media/play/*: ?url=…&autoPlay=true) or from a modal window (MediaPlayerModal). With a source
// it starts to play by itself (autoPlay, default true).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import AudioPlayerView from './AudioPlayerView';
import VideoPlayerView from './VideoPlayerView';
import MediaSourceInput from './MediaSourceInput';
import { resolveMediaUri } from './mediaFileStore';
import { MediaKind, normalizeQueue } from './mediaSource';

export interface MediaPlayerProps {
  kind: MediaKind;
  /** a web address, a file of the device, a stored recording; a list is played one after the other */
  source?: string | string[];
  /** start by itself (default true); a new source typed / picked by the user always starts */
  autoPlay?: boolean;
  title?: string;
  /** the address / file field (default true) */
  showSourceInput?: boolean;
  /** the whole queue was played */
  onEnded?: () => void;
  testID?: string;
}

export default function MediaPlayer({ kind, source, autoPlay = true, title, showSourceInput = true, onEnded, testID = 'media-player' }: MediaPlayerProps) {
  const theme = useTheme();
  const sourceKey = JSON.stringify(normalizeQueue(source));
  const [queue, setQueue] = useState<string[]>(() => normalizeQueue(source));
  const [index, setIndex] = useState(0);
  const [startNow, setStartNow] = useState(autoPlay);
  const [playUri, setPlayUri] = useState('');
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);

  // the source prop changed (route parameter, modal opened with another file)
  useEffect(() => {
    setQueue(normalizeQueue(source));
    setIndex(0);
    setStartNow(autoPlay);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, autoPlay]);

  const current = queue[index] || '';

  // a stored recording (kit8media://) -> an object url the player can open
  useEffect(() => {
    let alive = true;
    setPlayUri('');
    if (!current) return undefined;
    resolveMediaUri(current)
      .then((uri) => alive && setPlayUri(uri))
      .catch((e) => alive && setError(String(e?.message || e)));
    return () => {
      alive = false;
    };
  }, [current]);

  const handleEnd = useCallback(() => {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setStartNow(true);
    } else {
      onEnded?.();
    }
  }, [index, queue.length, onEnded]);

  const handleError = useCallback((message: string) => setError(message), []);

  const userChose = (uri: string) => {
    setError('');
    setQueue([uri]);
    setIndex(0);
    setStartNow(true);
    setNonce((n) => n + 1); // the same address pressed again starts from the beginning
  };

  const PlayerView = kind === 'audio' ? AudioPlayerView : VideoPlayerView;
  const heading = useMemo(() => title || (kind === 'audio' ? 'Play audio' : 'Play video'), [title, kind]);

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID={testID}>
      <Card.Title title={heading} titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }} />
      <Card.Content>
        {showSourceInput && <MediaSourceInput kind={kind} value={current} onPlay={userChose} />}

        {!!error && (
          <Text variant="bodyMedium" style={{ color: theme.colors.error, marginBottom: 8 }} testID="media-player-error">
            {error}
          </Text>
        )}

        {playUri ? (
          <View style={styles.player}>
            <PlayerView key={`${playUri}:${nonce}`} uri={playUri} autoPlay={startNow} onEnd={handleEnd} onError={handleError} />
          </View>
        ) : (
          !error && (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }} testID="media-player-empty">
              {current ? 'Loading…' : `Enter an address or choose a ${kind} file.`}
            </Text>
          )
        )}

        {queue.length > 1 && (
          <Text variant="labelSmall" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }} testID="media-player-queue">
            Part {index + 1} of {queue.length}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  player: { width: '100%', marginTop: 4 },
});
