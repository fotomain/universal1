# Media: record, play, photo, scan (web + iOS + Android)

Menu (hamburger drawer): **Record** → Audio, Video, Photo · **Play** → Audio, Video · **Scan** → QR / Barcode, NFC.
Routes: `app/media/record/{audio,video,photo}`, `app/media/play/{audio,video}`, `app/media/scan`, `app/media/nfc` (one line each, over the components below).

## Folders (2026-11-18: the root holds only `index.ts`, this README and the subfolders)

| Folder | What is in it |
|---|---|
| `common/` | the media post (`mediaPost`, `notePost` = scan / NFC / photo posts, `mediaPostList`, `mediaPostProject`), the file store (`mediaFileStore` + `.web`), `useSaveRecording`, `useWriteMediaPost` (the ONE place that writes a post row), `RecordingResult`, `RecordingSignInGate`, `MediaSourceInput`, `MediaPostsNativeList`, `mediaSource`, `audioMode`; the camera helpers shared by video / photo / scan: `cameraZoom`, `ZoomControl`, `PinchZoomView`, `ResultPostOffer` |
| `play/` | the player: `MediaPlayer*`, `AudioPlayerView`, `VideoPlayerView` (+ `.web`), the video buttons (`VideoControls*`, `TapSurface`, `useAutoHideControls`, `videoControlsLogic`, `usePlayVideoSettings`) |
| `video/` | `RecordVideo` (+ `.web`), its settings panel + hook, `stampedStream`, `dateTimeOver`, `DateTimeOverStamp`, `recordVideoTypes` |
| `audio/` | `RecordAudio` |
| `photo/` | `RecordPhoto` (+ `.web`), `PhotoReview`, `PhotoFilterStrip`, `photoFilters` (the looks), `applyPhotoFilter` (+ `.web`), `useSavePhoto`, `recordPhotoTypes` |
| `scan/` | `ScanCodes` (+ `.web`), `ScanResultCard`, `scanModel` |
| `nfc/` | `identification/` (ID or passport -> photo -> text recognised on the phone -> NFC scan, own README), `iddocread/` (ID card / passport chip reader, own README), `NfcScan` (the screen), `NFCReceivedInfo`, `nfcModel`, `nfcInbox`, `useNfcReader`, `nfcReader` (+ `.web`), `NfcBackgroundHandler` (+ `.web`) |

An import from outside the folder names the subfolder (`kit8/ui/components/media/play/MediaPlayerModal`); `index.ts` re-exports the main pieces.

## Libraries (one per job)

| Job | Library | Platform files |
|---|---|---|
| Record video, take photos, scan QR / barcodes | `react-native-vision-camera` v4 (iOS / Android, hardware H.264 → mp4; `takePhoto`; `useCodeScanner`) | `video/RecordVideo.tsx`, `photo/RecordPhoto.tsx`, `scan/ScanCodes.tsx` |
| Record video / photo / scan on the web | browser `getUserMedia` + `MediaRecorder` + canvas + `BarcodeDetector` | `video/RecordVideo.web.tsx`, `photo/RecordPhoto.web.tsx`, `scan/ScanCodes.web.tsx` |
| Look of a photo | `@shopify/react-native-skia` (colour matrix, off-screen surface) + `expo-image-manipulator` (EXIF orientation → real pixels); web: the same matrix over canvas pixels | `photo/applyPhotoFilter.ts` (+ `.web`) |
| NFC tags | `react-native-nfc-manager` v4 (iOS + Android; config plugin in `app.config.js`); web: Web NFC `NDEFReader` (Chrome on Android) | `nfc/nfcReader.ts` (+ `.web`) |
| Record + play audio | `expo-audio` (all three platforms) | `audio/RecordAudio.tsx`, `play/AudioPlayerView.tsx` |
| Play video | `expo-video` (iOS / Android: files, http(s), HLS, DASH, picture-in-picture) | `play/VideoPlayerView.tsx` |
| Play video | browser `<video>` (web) | `play/VideoPlayerView.web.tsx` |
| Pick a local file | `expo-document-picker` | `common/MediaSourceInput.tsx` |
| Keep a recording / photo | `expo-file-system` (phone: `<document>/media`) · IndexedDB (web) | `common/mediaFileStore.ts`, `common/mediaFileStore.web.ts` |

`X.web.tsx` is used by the web bundler, `X.tsx` by iOS / Android. Config plugins in `app.config.js`: `react-native-vision-camera`, `expo-audio`, `react-native-nfc-manager` + `withNfcLaunch` (Android intent filters).
Vision Camera, expo-video, expo-audio, NFC manager and image manipulator are native code: a **development build** is needed (not Expo Go).

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

## Video: date and time over the picture (`RecordVideoSettings`)

Design + spikes: `documentation/CAMERA_DATE_TIME.html`. The gear button of the recorder card opens `RecordVideoSettingsPanel`:

| Key (`uxuiState.RecordVideoSettings`, persisted) | Control | Default |
|---|---|---|
| `recordDateTimeOverEnabled` | switch "Date and time over the video" | `false` |
| `recordDateTimeOverPosition` | radio, two lines of two equal items: Top Left, Top Right / Bottom Left, Bottom Right (`RadioSetApp columns={2}`); disabled while the switch is off | `bottomRight` |

Both are locked while a recording runs. Model `kit8/redux/recordVideoSettings.ts` (normalize, selector), hook `useRecordVideoSettings`.

- The text is `YYYY-MM-DD HH:mm:ss`, local time. ONE pure file gives the text, the place (4 % of the short side; 3 % / 4 % margins) and the clock
  time of a second of a file: `dateTimeOver.ts`. `DateTimeOverStamp` draws it over a box (`LiveDateTimeOverStamp` = the clock of now, the preview).
- **Web**: the stamp is IN the file. `stampedStream.ts`: camera -> `<video>` -> hidden canvas (frame + text) -> `captureStream` + the SAME
  microphone track -> `MediaRecorder`. A browser without `canvas.captureStream` records as before and says so. Post: `mediaDateTimeOver { position, burnedIn: true }`.
- **iOS / Android**: the file has NO stamp (the camera writes it in hardware). The recorder notes when each part started and its pauses
  (`PartClock`); post: `mediaDateTimeOver { position, burnedIn: false, parts: [{ startedAt, pauses: [{ atSec, lengthSec }] }] }` (one part per file).
  The player draws the stamp: `<MediaPlayer dateTimeOver={dateTimeOverOfPost(rowJSON)} />` (the result card does), or the route parameter
  `&stamp=<JSON>` (`buildPlayRoute({ dateTimeOver })`). A file taken out of the app has no stamp - writing it into the mp4 is phase 2 (not built).
- Limits: in the player the place is counted from the player box, not from the picture inside it; the start of a part is the moment
  `startRecording` was called (the first frame is a little later).
- The card of the recorder has no title: the application bar says "Record Video".
- The row under the picture is ONE line: **Record** · switch **Sound on / Sound off** · camera flip · gear (at the right edge). While a recording
  runs, Pause / Stop & save stand in a line under it. The floating "+" button of the application is hidden on `/media/record/video`
  (`kit8/ui/components/fab/fabRoutes.ts`, test `__tests__/ui/fabRoutes.test.ts`). Reset of the panel is a plain text button.

## Media Posts list on a phone

The web list (`app/posts/mediapostcrud/index.tsx` -> `ListWebCardsComponent`) is built from browser tags (div, span) and crashed on iOS / Android
("View config getter for component `div`") when the user pressed **Media posts** after a recording. Expo Router takes
`app/posts/mediapostcrud/index.native.tsx` on a phone: `MediaPostsNativeList` (the user's posts, newest first, Play in `MediaPlayerModal`
with the date and time stamp, Delete after a question). Rows: `mediaPostList.ts` (pure). The web list is unchanged; editing titles, archive and
drag and drop exist on the web only.

## Tests (`__tests__/media`)

New 2026-11-18: `cameraZoom`, `scanModel`, `nfcModel` (+ the inbox), `photoFilters` (+ the result posts) (pure) · `zoomUi` (ZoomControl, pinch, zoom of the phone recorder BEFORE and WHILE recording) · `scanCodes` · `nfcScreen` · `recordPhoto` (fake Vision Camera / reader) · `webCameraTools` (digital zoom of the canvas, browser pixels, Web NFC records) · `mediaRoutes` (folder layout, routes, dependencies, NFC config).
Older: `mediaSource`, `mediaPost`, `dateTimeOver`, `recordVideoSettings`, `mediaPostList` (pure) · `mediaPostsNativeList` · `mediaPlayer` (MediaPlayer, modal, route) · `audioPlayerView` · `videoPlayerView` (+ `Web`) · `videoControlsOverlay` · `videoControlsLogic` · `playVideoSettings` · `recordAudio` · `recordVideoNative` (fake camera:
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

## Zoom (video, photo, scan; 2026-11-18)

`common/cameraZoom.ts` (pure) + `ZoomControl` (buttons `− 0.5× 1× 2× 5× +` and the factor between two buttons) + `PinchZoomView` (two finger pinch on the picture, plain touch events).
The user sees a FACTOR (1× = the main lens); Vision Camera speaks of a device zoom, so 1× = `device.neutralZoom` (it is 2 on a multi lens phone) and the factor is `zoom / neutral`.
Never more than 20× the main lens (`MAX_USEFUL_FACTOR`). A camera that cannot zoom shows nothing.
- **Video: the zoom works BEFORE and WHILE recording** (the `zoom` prop of the live `<Camera>`; no new part is started).
- **Web:** a camera whose track reports `zoom` zooms by hardware (`applyConstraints`, also while recording); the others are zoomed DIGITALLY 1-4×: the preview is scaled by CSS and the recording goes through the canvas of `stampedStream.ts` (`getZoom()` is read for every frame, so it also works while recording; `position = null` = no date text, only the zoom). A browser with no `canvas.captureStream` has no digital zoom for video (the control is hidden).

## Flashlight (torch; video + photo; 2026-11-19)

A PERMANENT light, not the flash of the shutter: it stays on while the camera screen is open and while a video is recorded. A flashlight button (`flashlight` / `flashlight-off`, testIDs `record-video-torch`, `record-photo-torch`) stands in the icon row of the video recorder (left of the camera flip) and of the photo screen (next to Flash, which still fires once at the shot).
- **One remembered choice** for both screens: `uxuiState.RecordVideoSettings.recordTorchEnabled` (persisted, false by default; `kit8/redux/recordVideoSettings.ts`, read through `useRecordVideoSettings`). A screen opens with the light as it was left. It goes out when the screen loses focus / closes (the camera stops) and comes back with the screen.
- **Phone:** the `torch` prop of the live `<Camera>` (`nativeTorchProp`, `common/cameraTorch.ts`) - no new part is started when it is switched while recording (unlike the sound switch). No button when `device.hasTorch` is false (the front camera).
- **Web:** `track.applyConstraints({ advanced: [{ torch }] })` (`useWebTorch.ts`, applied again to the NEW track after a camera flip). Only Chrome on Android reports a torch; a laptop camera has none, so there is no button. A browser that refuses the constraint shows the button as off.
- Not built: a torch button in the settings panel, an "auto off after N minutes", torch for Scan / Identification beyond what they already had (their own local switch, not remembered).
- Tests: `__tests__/media/cameraTorch.test.ts`, `recordVideoNative / recordVideoWeb / recordPhoto / recordPhotoWeb` (flashlight cases), `recordVideoSettings.test.ts`. Not tried on a real phone.

## Photo (`photo/`, route `/media/record/photo`, signed-in users only like the recordings)

Vision Camera `takePhoto` (flash off / auto / on, front / back camera, zoom) → `PhotoReview`: the picture, the **looks** (`PhotoFilterStrip`), **Save** (a media post with the file kept in the document folder / IndexedDB, `photoFilter`, `photoZoomFactor`) or Retake.
Looks (`photoFilters.ts`; ONE 4×5 colour matrix per look, `applyPhotoFilter` for the phone (Skia) and the browser (canvas pixels) use the same numbers): **black and white** Mono · Noir (strong contrast) · Silver (soft) · High key · Film B&W; **colour** Vivid · Warm · Cool · Fade · Vintage · Drama · Teal & orange.
The look is chosen before the shot and changed after it - always applied to the ORIGINAL file (never a look on a look). Phone: the live picture is NOT filtered (that needs a frame processor); the photo is. Web: the live preview shows the look (CSS filter, an approximation of the matrix).
The post has no `mediaKind` (nothing to play); the phone list draws `mediaImageUri` as a thumbnail (`MediaPostRow.imageUri`). The web list (`ListWebCardsComponent`) was not changed for photos.

## Scan: QR code / barcode (`scan/`, route `/media/scan`, signed-in users only: `RecordingSignInGate kind="scan"`)

Vision Camera `useCodeScanner` (no frame processor, no extra package: AVFoundation / ML Kit read the codes): QR, Aztec, Data Matrix, PDF417, EAN-13 / 8, UPC-A / E, Code 128 / 39 / 93, Codabar, ITF / ITF-14. Web: `BarcodeDetector` (Chrome, Edge, Safari 17+; Firefox says so).
`scanModel.ts` (pure) tells what a code is: link, e-mail, phone, SMS, Wi-Fi (`WIFI:T:WPA;S:..;P:..;;`), geo, contact card (vCard / MECARD), calendar event, product code (EAN / UPC), text. `ScanResultCard`: the facts, **Open** (link / mail / tel / sms / geo), **Copy**, **Scan again**, and the offer **Create media post** (`ResultPostOffer`: a guest is told to sign in; `buildScanPost` in `notePost.ts`, `dataOriginName = 'scanner'`). The same code in the next frames is one scan (`SCAN_REPEAT_MS`); a frame that arrives while a result is shown is ignored. Torch + zoom + front / back camera.

## NFC (`nfc/`, route `/media/nfc`, signed-in users only: `RecordingSignInGate kind="nfc"`; the same gate wraps `/media/nfc/identification` and `/media/nfc/iddocread`)

`react-native-nfc-manager` (the best maintained NFC package for Expo; no Expo module reads tags). The screen runs the reader while it is shown; **every tag that touches the phone is added to the list `NFCReceivedInfo`** (newest first, the same tag held on the phone is one read for 2 s). A card shows every NDEF record (text with its language, link, phone, mail, Smart Poster, MIME, external), the tag id / technologies / size / read only, **Open**, **Copy**, **Remove**, **Create media post** (`buildNfcPost`, `dataOriginName = 'nfc'`). `nfcModel.ts` (pure) decodes the records itself (text status byte, URI prefix table, UTF-8 / UTF-16, embedded Smart Poster message).
- **Android:** reader mode: tags are read one after the other with no button. **Background:** the config plugin `withNfcLaunch` (`app.config.js`) puts the intent filters `NDEF_DISCOVERED` (text/plain) and `TAG_DISCOVERED` on the main activity, so a tag started against the closed app opens it; `NfcBackgroundHandler` (mounted once in `app/_layout.tsx`) takes that tag (`getBackgroundTag`), also the background tags of a running app (`DiscoverBackgroundTag`) and when the app comes to the front, puts it into the inbox (`nfcInbox.ts`) and opens `/media/nfc`. Nothing is saved without the user.
- **iOS:** a read session (the system sheet) started by the **Scan** button; it ends after the system time limit - press Scan again. The system reads tags with a URL in the background by itself and opens the app only through a universal link (associated domain: not set up). Needs the NFC capability on the App ID (the plugin adds the entitlement + `NFCReaderUsageDescription`).
- **Web:** Web NFC (`NDEFReader`, Chrome on Android over https); other browsers say so. No background.
- **Identification (Scan -> Identification, `nfc/identification`)**: ID or passport -> photo of the machine readable zone -> text recognised ON the phone (expo-mlkit-ocr) -> confirm the three values -> the chip scan below; see `nfc/identification/README.md`.
- **ID card / passport chip reader (ICAO 9303)**: the button **ID card / passport** (and Drawer Scan -> ID card / passport, route `/media/nfc/iddocread`) reads the chip of passports and ID cards: see `nfc/iddocread/README.md` (PACE / BAC, face image, MRZ, hash check; every state's passport, ID cards with the same application; the step list for testing with a real card).
- Not built: writing tags, MIFARE commands, iOS background universal links.

## Do not install

`react-native-video` (6.19 needs media3 1.8, `expo-audio` / `expo-video` bring 1.9.0: `NoSuchMethodError DefaultLoadControl.<init>`, the app closes when a video starts) and `expo-camera` (CameraX 1.6.0 vs Vision Camera 1.5.0-alpha03). A test in `mediaRoutes.test.ts` guards both.


## Signed-in users only, projects on cards (2026-11-13)
- `RecordingSignInGate` wraps `app/media/record/{audio,video,photo}` AND the scan screens (`app/media/scan`, `app/media/nfc/{index,identification,iddocread}`, kinds scan / nfc / identification / idcard; no file storage button for them; changed 2026-11-23, they were open to guests before): a guest sees Sign in / Sign in and connect the file storage (back to `/catalog/organization`, Organization edit -> Files, where the administrator sets `organizationFilesStorageProvider`). `useSaveRecording` refuses a guest as a second lock.
- `mediaPostProject.ts`: the project of a post (a file row of the Files tab, or a post whose parent is a project) and the words of a delete stopped by a read-only project. A post with no project is changed by its owner only. Cards show `Project: <name>`; the delete of a project file goes through the files-drive function (`deleteFileRow`), never a plain DELETE.

## ID card post: all the data + the photo (2026-11-23)

**Create media post** (`IdCardPostOffer`) now keeps the whole reading in the post, not only the name and the number: `idCardFields(doc)` (`iddocread/idCardFields.ts`, pure) lists every readable datum of the zone, DG11 (personal details) and DG12 (document details) as label + value - the description of the post is one line per datum and `rowJSON.idCardFields` keeps the list. The owner photo of the chip is in the post as `mediaImageUri` (a data address) when it is a JPEG up to `ID_POST_PHOTO_MAX_CHARS`; a JPEG 2000 photo (Android cannot draw it) is only in the file storage and the post says so in a `Photo` line. The phone list (`MediaPostsNativeList`, `MediaPostRow.isIdCard`) and the web list (`MediaPostCRUDComponent`) draw it as a portrait above the text. Tests `__tests__/media/idCardFields.test.ts`, `idCardPost.test.ts`.
