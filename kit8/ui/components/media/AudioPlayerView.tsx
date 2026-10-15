// The audio player (web + iOS + Android): expo-audio. It plays ONE uri; MediaPlayer.tsx adds the source input and the queue.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { setMediaAudioMode } from './audioMode';
import { formatDuration } from './mediaSource';

export interface MediaPlayerViewProps {
  uri: string;
  autoPlay?: boolean;
  /** the file played to its end */
  onEnd?: () => void;
  onError?: (message: string) => void;
}

/** a source that never reports "loaded" is an error after this time */
export const AUDIO_LOAD_TIMEOUT_MS = 20000;
const SKIP_SECONDS = 10;

export default function AudioPlayerView({ uri, autoPlay = false, onEnd, onError }: MediaPlayerViewProps) {
  const theme = useTheme();
  const source = useMemo(() => ({ uri }), [uri]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const [barWidth, setBarWidth] = useState(0);
  const started = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    void setMediaAudioMode(false);
  }, []);

  useEffect(() => {
    started.current = false;
    ended.current = false;
  }, [uri]);

  // start by itself once the file is loaded
  useEffect(() => {
    if (status.isLoaded && autoPlay && !started.current) {
      started.current = true;
      player.play();
    }
  }, [status.isLoaded, autoPlay, player, uri]);

  useEffect(() => {
    if (status.didJustFinish && !ended.current) {
      ended.current = true;
      onEnd?.();
    }
  }, [status.didJustFinish, onEnd]);

  useEffect(() => {
    if (status.error) onError?.(String(status.error));
  }, [status.error, onError]);

  useEffect(() => {
    if (status.isLoaded) return undefined;
    const timer = setTimeout(() => onError?.('The audio could not be loaded.'), AUDIO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status.isLoaded, uri, onError]);

  const duration = Number.isFinite(status.duration) ? status.duration : 0;
  const current = Math.min(status.currentTime || 0, duration || status.currentTime || 0);
  const progress = duration > 0 ? current / duration : 0;

  const togglePlay = () => {
    if (status.playing) {
      player.pause();
    } else {
      // after the end a press starts again from the beginning
      if (duration > 0 && current >= duration - 0.25) void player.seekTo(0);
      ended.current = false;
      player.play();
    }
  };
  const skip = (delta: number) => {
    const next = Math.max(0, Math.min(duration || Infinity, current + delta));
    void player.seekTo(next);
  };
  const seekByTap = (x: number) => {
    if (barWidth > 0 && duration > 0) void player.seekTo((Math.max(0, Math.min(x, barWidth)) / barWidth) * duration);
  };

  return (
    <View style={[styles.box, { backgroundColor: theme.colors.primaryContainer }]} testID="audio-player-view">
      <IconButton icon="headphones" size={56} iconColor={theme.colors.onPrimaryContainer} />
      <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }} testID="audio-player-state">
        {!status.isLoaded ? 'Loading…' : status.playing ? 'Playing' : 'Paused'}
      </Text>

      <Pressable
        style={styles.barHit}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        onPress={(e) => seekByTap(e.nativeEvent.locationX)}
        testID="audio-player-bar"
      >
        <ProgressBar progress={progress} color={theme.colors.primary} style={styles.bar} />
      </Pressable>
      <View style={styles.times}>
        <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>{formatDuration(current)}</Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>{formatDuration(duration)}</Text>
      </View>

      <View style={styles.buttons}>
        <IconButton icon="rewind-10" size={28} onPress={() => skip(-SKIP_SECONDS)} disabled={!status.isLoaded} accessibilityLabel="Back 10 seconds" />
        <IconButton
          icon={status.playing ? 'pause-circle' : 'play-circle'}
          size={56}
          iconColor={theme.colors.primary}
          onPress={togglePlay}
          disabled={!status.isLoaded}
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          testID="audio-player-toggle"
        />
        <IconButton icon="fast-forward-10" size={28} onPress={() => skip(SKIP_SECONDS)} disabled={!status.isLoaded} accessibilityLabel="Forward 10 seconds" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' },
  barHit: { width: '100%', paddingVertical: 10, marginTop: 8 },
  bar: { height: 6, borderRadius: 3 },
  times: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
