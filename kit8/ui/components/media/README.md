# Media: record and play audio / video (web + iOS + Android)

Menu (hamburger drawer): **Record** → Audio, Video · **Play** → Audio, Video.
Routes: `app/media/record/{audio,video}`, `app/media/play/{audio,video}` (one line each, over the components below).

## Libraries (one per job)

| Job | Library | Platform files |
|---|---|---|
| Record video | `react-native-vision-camera` v4 (iOS / Android, hardware H.264 → mp4) | `RecordVideo.tsx` |
| Record video | browser `getUserMedia` + `MediaRecorder` (web) | `RecordVideo.web.tsx` |
| Record + play audio | `expo-audio` (all three platforms) | `RecordAudio.tsx`, `AudioPlayerView.tsx` |
| Play video | `expo-video` (iOS / Android: files, http(s), HLS, DASH, picture-in-picture) | `VideoPlayerView.tsx` |
| Play video | browser `<video>` (web) | `VideoPlayerView.web.tsx` |
| Pick a local file | `expo-document-picker` | `MediaSourceInput.tsx` |
| Keep a recording | `expo-file-system` (phone: `<document>/media`) · IndexedDB (web) | `mediaFileStore.ts`, `mediaFileStore.web.ts` |

`X.web.tsx` is used by the web bundler, `X.tsx` by iOS / Android. Config plugins in `app.config.js`: `react-native-vision-camera`, `expo-audio`.
Vision Camera, expo-video and expo-audio are native code: a **development build** is needed (not Expo Go).

## The reusable player

```tsx
<MediaPlayer kind="video" source="https://example.com/a.mp4" />            // plays a web address, starts by itself
<MediaPlayer kind="audio" source="file:///…/a.m4a" autoPlay={false} />     // a file of the device, waits for the user
<MediaPlayer kind="video" source={[part1, part2]} />                       // one after the other
<MediaPlayer kind="audio" />                                               // asks: address field + "Choose file"

<MediaPlayerModal visible={open} onDismiss={close} kind="video" source={uri} />   // from a modal window; autoplay
router.push(buildPlayRoute('audio', { source: uri }))                              // by route
```

Route: `/media/play/audio?url=<address | file | JSON list>&autoPlay=true&title=…`. With `url` it plays at once; without it the user types an
address / path or picks a file (`parseMediaSource` in `mediaSource.ts`: https, http, file://, content://, an absolute path, blob:, `kit8media://`).

## Recording → media post

A finished recording is kept (`persistRecording`) and becomes a row of `mediaPostReusable` / `mediaPostTable` (`useSaveRecording` →
`SystemMetaData.mediaPostReusable.actions.createOne`). `buildRecordingPost` (pure, `mediaPost.ts`) makes the row: `mediaPostOrigin` (the file),
`mediaPostMIME`, `mediaKind`, `mediaDurationSec`, `mediaWithAudio`, and `mediaSegments` when the video has several parts.
The file stays on the device (phone: document folder, web: IndexedDB as `kit8media://<id>`); nothing is uploaded.

## Video: the sound switch while recording

- **Web**: the microphone track stays in the recording; the switch enables / disables it (disabled = silence). ONE file, no gap.
- **iOS / Android**: Vision Camera fixes the sound when a recording starts, so the switch ends the current part and starts the next part with the
  new setting (about `SEGMENT_GAP_MS` = 0.7 s between the parts is NOT recorded). The parts are ONE post (`mediaSegments`) that the player plays one
  after the other. The same switch before Record only sets the first part.

## Tests (`__tests__/media`)

`mediaSource`, `mediaPost` (pure) · `mediaPlayer` (MediaPlayer, modal, route) · `audioPlayerView` · `videoPlayerView` (+ `Web`) · `videoControlsOverlay` · `videoControlsLogic` · `playVideoSettings` · `recordAudio` · `recordVideoNative` (fake camera:
parts, switch, pause, limit) · `recordVideoWeb` (fake MediaRecorder / getUserMedia) · `saveRecording` · `mediaFileStore` · `mediaRoutes`.
`mediaUiTestKit.tsx` mocks Paper / common / expo-router. What a test cannot do: record with a real camera or microphone — try it on a device.

## Video buttons (like YouTube) and `PlayVideoSettings`

`VideoControlsOverlay` goes over the video of both players (`VideoPlayerView.tsx` iOS / Android, `VideoPlayerView.web.tsx` web); the native / browser controls are off.

| What | How |
|---|---|
| Buttons appear | mouse move (web) · one touch (phone) |
| Buttons disappear | after `PlayVideoSettings.hideButtonsAfter` = **2.5 s** (kept while the settings panel is open) |
| `-N s` / `+N s` buttons | `PlayVideoSettings.rewindSecondsValue` = **5**; the toolbar buttons and a double touch / double click at the left 40 % / right 40 % of the video (touches in a row add up: +5, +10 ...; a flash shows it) |
| Middle 20 % | double touch = play / pause; a single click of a mouse = play / pause |
| Stopped | big transparent Play button in the middle (a replay icon after the end) - always shown, also when the other buttons are hidden |
| Settings button (gear) | panel: hide-after and rewind seconds (steppers, limits 1-10 s step 0.5 / 1-60 s step 1) + Reset |

`PlayVideoSettings` lives in `uxuiState` (`kit8/redux/playVideoSettings.ts`, reducers `setPlayVideoSettings` / `resetPlayVideoSettings`),
so it is persisted. A state saved by an older app version has none: every reader uses `selectPlayVideoSettings` (defaults + clamping).
Files: `VideoControls.tsx` (look), `VideoControlsOverlay.tsx` (gestures, state), `TapSurface.tsx` (where was it touched; web DOM click / native Pressable),
`useAutoHideControls.ts`, `videoControlsLogic.ts` (pure: zones, jump, progress).

## Do not install

`react-native-video` (6.19 needs media3 1.8, `expo-audio` / `expo-video` bring 1.9.0: `NoSuchMethodError DefaultLoadControl.<init>`, the app closes when a video starts) and `expo-camera` (CameraX 1.6.0 vs Vision Camera 1.5.0-alpha03). A test in `mediaRoutes.test.ts` guards both.
