// THE reusable player (audio | video, web + iOS + Android).
//   <MediaPlayer kind="video" source="https://…/a.mp4" />              plays a web address
//   <MediaPlayer kind="audio" source="file:///…/a.m4a" autoPlay />     plays a file of the device
//   <MediaPlayer kind="video" source={[seg1, seg2]} />                 several files, one after the other
//   <MediaPlayer kind="audio" />                                       asks the user: address or file (MediaSourceInput)
// Called by a route (app/media/play/*: ?url=…&autoPlay=true) or from a modal window (MediaPlayerModal). With a source
// it starts to play by itself (autoPlay, default true).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import AudioPlayerView from './AudioPlayerView';
import VideoPlayerView from './VideoPlayerView';
import MediaSourceInput from '../common/MediaSourceInput';
import { mediaFileExists, resolveMediaUri } from '../common/mediaFileStore';
import { fetchDownloadUrl } from '../../../../files/common/filesDriveApi';
import type { DriveFileRef } from '../../../../files/common/recordingUpload';
import { driveFileOfPart, resolvePlaySource, type PlayFrom, type PlaySourceDeps } from './playSource';
import { MediaKind, normalizeQueue } from '../common/mediaSource';
import type { MediaDateTimeOver } from '../video/dateTimeOver';

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
  /** video: the date and time stamp of a recording whose files do not have it (dateTimeOverOfPost(rowJSON)); it belongs to `source` */
  dateTimeOver?: MediaDateTimeOver | null;
  /** the files of the post in the file storage, one per part of `source` (the same order): the web plays from them, a phone plays from the file of the device and falls back to them */
  driveFiles?: DriveFileRef[];
  testID?: string;
}

/** a link to play the file row of a post: the function signs one (10 minutes) and streams the file */
async function driveUrlOf(fileRowGUID: string): Promise<string> {
  const r = await fetchDownloadUrl(fileRowGUID);
  if (!r.ok) throw new Error(`The file could not be opened from the file storage: ${r.error}`);
  return r.data.url;
}

const playSourceDeps = (): PlaySourceDeps => ({ isWeb: Platform.OS === 'web', resolveLocal: resolveMediaUri, localExists: mediaFileExists, driveUrl: driveUrlOf });

export default function MediaPlayer({ kind, source, autoPlay = true, title, showSourceInput = true, onEnded, dateTimeOver = null, driveFiles, testID = 'media-player' }: MediaPlayerProps) {
  const theme = useTheme();
  const sourceKey = JSON.stringify(normalizeQueue(source));
  const [queue, setQueue] = useState<string[]>(() => normalizeQueue(source));
  const [index, setIndex] = useState(0);
  const [startNow, setStartNow] = useState(autoPlay);
  const [playUri, setPlayUri] = useState('');
  const [playFrom, setPlayFrom] = useState<PlayFrom>('local');
  /** the file of the device did not play (damaged, wrong format): the next try is the file in the storage */
  const [forceDrive, setForceDrive] = useState(false);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  /** false after the user typed / picked another source: the stamp belongs to the source of the props */
  const [ownSource, setOwnSource] = useState(true);

  // the source prop changed (route parameter, modal opened with another file)
  useEffect(() => {
    setQueue(normalizeQueue(source));
    setIndex(0);
    setStartNow(autoPlay);
    setError('');
    setOwnSource(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, autoPlay]);

  const current = queue[index] || '';
  // the part the user chose by typing / picking has no file in the storage: the files belong to the source of the props
  const driveFile = ownSource ? driveFileOfPart(driveFiles, index) : undefined;
  const driveGUID = driveFile?.fileRowGUID || '';

  useEffect(() => setForceDrive(false), [current, driveGUID]);

  // the address to play: a stored recording (kit8media://) -> an object url; web = the file in the storage first; a phone = its own file first (playSource.ts)
  useEffect(() => {
    let alive = true;
    setPlayUri('');
    if (!current) return undefined;
    resolvePlaySource(current, driveFile, playSourceDeps(), { forceDrive })
      .then((src) => {
        if (!alive) return;
        setPlayFrom(src.from);
        setPlayUri(src.uri);
      })
      .catch((e) => alive && setError(String(e?.message || e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, driveGUID, forceDrive]);

  const handleEnd = useCallback(() => {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setStartNow(true);
    } else {
      onEnded?.();
    }
  }, [index, queue.length, onEnded]);

  const handleError = useCallback(
    (message: string) => {
      // the file of the device would not play: try the file in the storage once before telling the user
      if (playFrom === 'local' && driveGUID && !forceDrive) {
        setError('');
        setForceDrive(true);
        return;
      }
      setError(message);
    },
    [playFrom, driveGUID, forceDrive],
  );

  const userChose = (uri: string) => {
    setError('');
    setOwnSource(false);
    setQueue([uri]);
    setIndex(0);
    setStartNow(true);
    setNonce((n) => n + 1); // the same address pressed again starts from the beginning
  };

  const PlayerView = kind === 'audio' ? AudioPlayerView : VideoPlayerView;
  const stampPart = kind === 'video' && ownSource && dateTimeOver && !dateTimeOver.burnedIn ? dateTimeOver.parts?.[index] : undefined;
  const stamp = useMemo(() => (stampPart && dateTimeOver ? { position: dateTimeOver.position, part: stampPart } : null), [stampPart, dateTimeOver]);
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
            <PlayerView key={`${playUri}:${nonce}`} uri={playUri} autoPlay={startNow} onEnd={handleEnd} onError={handleError} dateTimeOver={stamp} />
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
