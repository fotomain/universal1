// The video player of iOS and Android: expo-video (ExoPlayer / AVPlayer: files, http(s), HLS, DASH) with OUR buttons over it
// (VideoControlsOverlay: auto-hide, - N s / + N s, double touch, big Play button, settings). The web twin is VideoPlayerView.web.tsx.
// It plays ONE uri; MediaPlayer.tsx adds the source input and the queue.
//
// Why not react-native-video: expo-audio and expo-video use media3 1.9.0 on Android, react-native-video 6.19 calls a constructor
// that media3 1.9.0 removed -> "NoSuchMethodError DefaultLoadControl.<init>" and the app closes as soon as a video starts.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import VideoControlsOverlay from './VideoControlsOverlay';
import type { MediaPlayerViewProps } from './AudioPlayerView';

export default function VideoPlayerView({ uri, autoPlay = false, onEnd, onError }: MediaPlayerViewProps) {
  // a new file is a new player: MediaPlayer gives the view a key
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    if (autoPlay) p.play();
  });
  const [playing, setPlaying] = useState(autoPlay);
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setDuration(player.duration || 0);
    const subs = [
      player.addListener('playingChange', ({ isPlaying }) => {
        setPlaying(isPlaying);
        if (isPlaying) setEnded(false);
      }),
      player.addListener('timeUpdate', ({ currentTime: t }) => setCurrentTime(t)),
      player.addListener('sourceLoad', ({ duration: d }) => setDuration(d || 0)),
      player.addListener('playToEnd', () => {
        setEnded(true);
        setPlaying(false);
        onEnd?.();
      }),
      player.addListener('statusChange', ({ status, error }) => {
        if (status === 'error') onError?.(String(error?.message || 'The video could not be played.'));
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player, onEnd, onError]);

  const togglePlay = () => {
    if (ended) {
      player.replay();
      setEnded(false);
    } else if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };
  const seekTo = (seconds: number) => {
    player.currentTime = seconds;
    setCurrentTime(seconds);
  };

  return (
    <View style={styles.box} testID="video-player-view">
      {/* tsc resolves the .web typings first (moduleSuffixes): the player type differs there */}
      <VideoView player={player as never} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" allowsPictureInPicture />
      <VideoControlsOverlay playing={playing} ended={ended} currentTime={currentTime} duration={duration} onTogglePlay={togglePlay} onSeekTo={seekTo} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
});
