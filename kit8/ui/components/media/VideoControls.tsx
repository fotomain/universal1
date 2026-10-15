// The buttons over the video (presentational: no player, no redux). VideoControlsOverlay.tsx gives it the state and the actions.
//   toolbar: seek bar + times, [- N s] [play / pause] [+ N s] ... [settings]   (appears with `visible`)
//   big transparent Play button in the middle while the video is not playing (like YouTube)
//   settings panel: hide the buttons after N seconds, rewind N seconds
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, IconButton, Text } from 'react-native-paper';
import TapSurface from './TapSurface';
import { formatDuration } from './mediaSource';
import { progressOf, timeAtPosition } from './videoControlsLogic';
import { PLAY_VIDEO_LIMITS, PlayVideoSettings } from '../../../redux/playVideoSettings';

export interface VideoControlsProps {
  playing: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  settings: PlayVideoSettings;
  /** the toolbar is shown (the big Play button does not depend on it) */
  visible: boolean;
  settingsOpen: boolean;
  /** "+5 s" shown for a moment on the left / right part after a double touch */
  flash: { side: 'left' | 'right'; seconds: number } | null;
  onTogglePlay: () => void;
  onSeekBy: (delta: number) => void;
  onSeekTo: (seconds: number) => void;
  onToggleSettings: () => void;
  onChangeSettings: (patch: Partial<PlayVideoSettings>) => void;
  onResetSettings: () => void;
  /** any press on a button: keep the buttons shown */
  onActivity: () => void;
}

const WHITE = '#ffffff';

function Stepper({ label, value, unit, onMinus, onPlus, testID }: { label: string; value: number; unit: string; onMinus: () => void; onPlus: () => void; testID: string }) {
  return (
    <View style={styles.stepperRow}>
      <Text variant="bodySmall" style={styles.panelLabel}>{label}</Text>
      <View style={styles.stepper}>
        <IconButton icon="minus" size={18} iconColor={WHITE} onPress={onMinus} testID={`${testID}-minus`} accessibilityLabel={`${label}: less`} />
        <Text variant="labelLarge" style={styles.panelValue} testID={`${testID}-value`}>{`${value} ${unit}`}</Text>
        <IconButton icon="plus" size={18} iconColor={WHITE} style={styles.plusFlush} onPress={onPlus} testID={`${testID}-plus`} accessibilityLabel={`${label}: more`} />
      </View>
    </View>
  );
}

export default function VideoControls(props: VideoControlsProps) {
  const { playing, ended, currentTime, duration, settings, visible, settingsOpen, flash } = props;
  const N = settings.rewindSecondsValue;
  const L = PLAY_VIDEO_LIMITS;
  const press = (action: () => void) => () => {
    props.onActivity();
    action();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="video-controls">
      {/* the second touch of a double touch: how far it jumped */}
      {flash && (
        <View style={[styles.flash, flash.side === 'left' ? styles.flashLeft : styles.flashRight]} pointerEvents="none" testID="video-seek-flash">
          <Icon source={flash.side === 'left' ? 'rewind' : 'fast-forward'} size={28} color={WHITE} />
          <Text style={styles.flashText}>{`${flash.side === 'left' ? '-' : '+'}${flash.seconds} s`}</Text>
        </View>
      )}

      {/* big transparent Play button while the video is stopped */}
      {!playing && (
        <View style={styles.bigWrap} pointerEvents="box-none">
          <Pressable onPress={press(props.onTogglePlay)} style={styles.bigPlay} accessibilityRole="button" accessibilityLabel={ended ? 'Play again' : 'Play'} testID="video-big-play">
            <Icon source={ended ? 'replay' : 'play'} size={52} color={WHITE} />
          </Pressable>
        </View>
      )}

      {/* toolbar */}
      <View style={[styles.toolbar, !visible && styles.hidden]} pointerEvents={visible ? 'box-none' : 'none'} testID="video-controls-toolbar" aria-hidden={!visible}>
        <View style={styles.seekRow}>
          <Text variant="labelSmall" style={styles.time} testID="video-time-current">{formatDuration(currentTime)}</Text>
          <TapSurface
            style={styles.seekHit}
            testID="video-seek-bar"
            accessibilityLabel="Seek"
            onTap={(x, width) => {
              props.onActivity();
              props.onSeekTo(timeAtPosition(x, width, duration));
            }}
          >
            <View style={styles.seekTrack}>
              <View style={[styles.seekFill, { width: `${progressOf(currentTime, duration) * 100}%` }]} />
            </View>
          </TapSurface>
          <Text variant="labelSmall" style={styles.time} testID="video-time-total">{formatDuration(duration)}</Text>
        </View>

        <View style={styles.buttons}>
          <Pressable onPress={press(() => props.onSeekBy(-N))} style={styles.textButton} accessibilityRole="button" accessibilityLabel={`Back ${N} seconds`} testID="video-rewind-back">
            <Icon source="rewind" size={22} color={WHITE} />
            <Text style={styles.buttonText}>{`-${N} s`}</Text>
          </Pressable>
          <IconButton
            icon={playing ? 'pause' : ended ? 'replay' : 'play'}
            size={30}
            iconColor={WHITE}
            onPress={press(props.onTogglePlay)}
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            testID="video-play-pause"
          />
          <Pressable onPress={press(() => props.onSeekBy(N))} style={styles.textButton} accessibilityRole="button" accessibilityLabel={`Forward ${N} seconds`} testID="video-rewind-forward">
            <Text style={styles.buttonText}>{`+${N} s`}</Text>
            <Icon source="fast-forward" size={22} color={WHITE} />
          </Pressable>
          <View style={styles.spacer} />
          <IconButton icon="cog" size={22} iconColor={WHITE} onPress={press(props.onToggleSettings)} accessibilityLabel="Video settings" testID="video-settings-button" />
        </View>
      </View>

      {/* settings: only while the toolbar is shown */}
      {settingsOpen && (
        <View style={styles.panel} testID="video-settings-panel">
          <Stepper
            label="Hide buttons after"
            unit="s"
            value={settings.hideButtonsAfter}
            testID="video-settings-hide"
            onMinus={press(() => props.onChangeSettings({ hideButtonsAfter: settings.hideButtonsAfter - L.hideButtonsAfter.step }))}
            onPlus={press(() => props.onChangeSettings({ hideButtonsAfter: settings.hideButtonsAfter + L.hideButtonsAfter.step }))}
          />
          <Stepper
            label="Rewind / forward"
            unit="s"
            value={settings.rewindSecondsValue}
            testID="video-settings-rewind"
            onMinus={press(() => props.onChangeSettings({ rewindSecondsValue: settings.rewindSecondsValue - L.rewindSecondsValue.step }))}
            onPlus={press(() => props.onChangeSettings({ rewindSecondsValue: settings.rewindSecondsValue + L.rewindSecondsValue.step }))}
          />
          <View style={styles.panelFooter}>
            <Pressable onPress={press(props.onResetSettings)} style={styles.footerLeft} accessibilityRole="button" testID="video-settings-reset">
              <Text style={styles.buttonText}>Reset to default</Text>
            </Pressable>
            <Pressable onPress={press(props.onToggleSettings)} style={styles.footerRight} accessibilityRole="button" accessibilityLabel="Close settings" testID="video-settings-close">
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const SHADE = 'rgba(0,0,0,0.55)';
const PANEL_SIDE = 14; // left and right space of the settings content (was 10, +4)
const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  toolbar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingBottom: 4, paddingTop: 6, backgroundColor: SHADE },
  seekRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seekHit: { flex: 1, height: 24, justifyContent: 'center' },
  seekTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  seekFill: { height: 4, backgroundColor: '#ff3d3d' },
  time: { color: WHITE, minWidth: 34, textAlign: 'center' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8 },
  buttonText: { color: WHITE, fontWeight: '600' },
  spacer: { flex: 1 },
  bigWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bigPlay: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  flash: { position: 'absolute', top: '35%', alignItems: 'center', justifyContent: 'center', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(0,0,0,0.45)' },
  flashLeft: { left: '8%' },
  flashRight: { right: '8%' },
  flashText: { color: WHITE, fontWeight: '700' },
  panel: { position: 'absolute', top: 8, right: 8, paddingVertical: 10, paddingHorizontal: PANEL_SIDE, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.75)', gap: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  panelLabel: { color: WHITE },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  panelValue: { color: WHITE, minWidth: 52, textAlign: 'center' },
  panelFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // equal side space: the labels, "Reset to default", the "+" glyphs and "Close" all start / end at the panel's padding.
  // IconButton keeps 6 px margin + 8 px padding around its glyph, so "+" gets marginRight -14 (glyph flush with the edge); -13 = 1 px more space, by request
  plusFlush: { marginRight: -13 },
  footerLeft: { paddingLeft: 0, paddingRight: 8, paddingVertical: 6 },
  footerRight: { paddingLeft: 8, paddingRight: 0, paddingVertical: 6 },
});
