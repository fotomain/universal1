// What turns a player into a YouTube-like player (web + iOS + Android): put it over the video.
//   <View><VideoSurface/><VideoControlsOverlay playing ended currentTime duration onTogglePlay onSeekTo /></View>
//
//   buttons appear on a mouse move / one touch, disappear after PlayVideoSettings.hideButtonsAfter seconds (2.5)
//   - N s / + N s buttons, and a double touch / double click at the left / right part of the video: PlayVideoSettings.rewindSecondsValue (5)
//   a double touch in the middle, and the big Play button, play / pause; a click of a mouse in the middle also plays / pauses
//   the settings button opens a panel that changes both values (saved in uxuiState)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TapSurface, { TapPointer } from './TapSurface';
import VideoControls from './VideoControls';
import { useAutoHideControls } from './useAutoHideControls';
import { usePlayVideoSettings } from './usePlayVideoSettings';
import { doubleTapZone, isRepeatedTap, seekTarget, TAP_WINDOW_MS } from './videoControlsLogic';

export interface VideoControlsOverlayProps {
  playing: boolean;
  /** the video played to its end: Play starts again */
  ended?: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeekTo: (seconds: number) => void;
}

/** how long "+5 s" stays on the video after a double touch */
export const SEEK_FLASH_MS = 700;

export default function VideoControlsOverlay({ playing, ended = false, currentTime, duration, onTogglePlay, onSeekTo }: VideoControlsOverlayProps) {
  const { settings, change, reset } = usePlayVideoSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { visible, show } = useAutoHideControls(settings.hideButtonsAfter, settingsOpen);
  const [flash, setFlash] = useState<{ side: 'left' | 'right'; seconds: number } | null>(null);

  const lastTap = useRef<number | null>(null);
  const pendingClick = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the latest values for the timers
  const live = useRef({ currentTime, duration, onTogglePlay, onSeekTo, step: settings.rewindSecondsValue });
  live.current = { currentTime, duration, onTogglePlay, onSeekTo, step: settings.rewindSecondsValue };

  useEffect(
    () => () => {
      if (pendingClick.current) clearTimeout(pendingClick.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const seekBy = useCallback((delta: number) => {
    const l = live.current;
    l.onSeekTo(seekTarget(l.currentTime, delta, l.duration));
  }, []);

  const showFlash = (side: 'left' | 'right') => {
    const step = live.current.step;
    // taps that follow each other add up: -5, -10, -15 ...
    setFlash((f) => ({ side, seconds: f && f.side === side ? f.seconds + step : step }));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), SEEK_FLASH_MS);
  };

  const onTap = (x: number, width: number, pointer: TapPointer) => {
    const now = Date.now();
    const zone = doubleTapZone(x, width);
    const repeated = isRepeatedTap(lastTap.current, now);
    lastTap.current = now;
    if (pendingClick.current) {
      clearTimeout(pendingClick.current);
      pendingClick.current = null;
    }
    if (repeated) {
      if (zone === 'left') {
        seekBy(-live.current.step);
        showFlash('left');
      } else if (zone === 'right') {
        seekBy(live.current.step);
        showFlash('right');
      } else {
        live.current.onTogglePlay();
      }
      show();
      return;
    }
    if (pointer === 'touch') {
      show(); // one touch: the buttons appear
      return;
    }
    // a click of a mouse plays / pauses, unless a second click follows
    pendingClick.current = setTimeout(() => {
      pendingClick.current = null;
      live.current.onTogglePlay();
      show();
    }, TAP_WINDOW_MS);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="video-overlay">
      <TapSurface style={StyleSheet.absoluteFill} onTap={onTap} onHover={show} testID="video-tap-surface" accessibilityLabel="Video" />
      <VideoControls
        playing={playing}
        ended={ended}
        currentTime={currentTime}
        duration={duration}
        settings={settings}
        visible={visible}
        settingsOpen={settingsOpen}
        flash={flash}
        onTogglePlay={onTogglePlay}
        onSeekBy={(delta) => {
          seekBy(delta);
          showFlash(delta < 0 ? 'left' : 'right');
        }}
        onSeekTo={onSeekTo}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
        onChangeSettings={change}
        onResetSettings={reset}
        onActivity={show}
      />
    </View>
  );
}
