// Web twin of VideoPlayerView.tsx: the browser <video> element (mp4, webm, ogg; a browser plays no HLS / DASH by itself)
// with OUR buttons over it (VideoControlsOverlay).
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import VideoControlsOverlay from './VideoControlsOverlay';
import type { MediaPlayerViewProps } from './AudioPlayerView';

export default function VideoPlayerView({ uri, autoPlay = false, onEnd, onError }: MediaPlayerViewProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // a browser may refuse to start with sound before a click: the big Play button stays, the user presses it
  useEffect(() => {
    if (autoPlay && ref.current) ref.current.play().catch(() => undefined);
  }, [uri, autoPlay]);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (ended) {
      el.currentTime = 0;
      el.play().catch(() => undefined);
    } else if (el.paused) {
      el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };
  const seekTo = (seconds: number) => {
    if (!ref.current) return;
    ref.current.currentTime = seconds;
    setCurrentTime(seconds);
  };
  const readDuration = () => {
    const d = ref.current?.duration;
    setDuration(typeof d === 'number' && Number.isFinite(d) ? d : 0);
  };

  return (
    <View style={styles.box} testID="video-player-view">
      <video
        key={uri}
        ref={ref}
        src={uri}
        playsInline
        autoPlay={autoPlay}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setEnded(true);
          setPlaying(false);
          onEnd?.();
        }}
        onTimeUpdate={() => setCurrentTime(ref.current?.currentTime ?? 0)}
        onLoadedMetadata={readDuration}
        onDurationChange={readDuration}
        onError={() => onError?.('The video could not be played (check the address, the format and CORS).')}
        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
      />
      <VideoControlsOverlay playing={playing} ended={ended} currentTime={currentTime} duration={duration} onTogglePlay={togglePlay} onSeekTo={seekTo} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
});
