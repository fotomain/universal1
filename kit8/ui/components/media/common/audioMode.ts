// One place for the audio session mode of the media components (expo-audio): record or play, also with the phone on silent.
import { setAudioModeAsync } from 'expo-audio';

/** `recording` = the microphone may be used (iOS: the session category is play-and-record) */
export function setMediaAudioMode(recording: boolean): Promise<void> {
  return setAudioModeAsync({
    allowsRecording: recording,
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  }).catch(() => undefined);
}
