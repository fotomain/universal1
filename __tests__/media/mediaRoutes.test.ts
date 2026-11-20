// app/play and app/record moved into app/media; every media route is one line over a component of kit8/ui/components/media.
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(root, p));

// route file -> [the component it renders, the subfolder of kit8/ui/components/media it lives in]
const ROUTES: Record<string, [string, string]> = {
  'app/media/record/audio/index.tsx': ['RecordAudio', 'audio'],
  'app/media/record/video/index.tsx': ['RecordVideo', 'video'],
  'app/media/record/photo/index.tsx': ['RecordPhoto', 'photo'],
  'app/media/play/audio/index.tsx': ['MediaPlayerScreen', 'play'],
  'app/media/play/video/index.tsx': ['MediaPlayerScreen', 'play'],
  'app/media/scan/index.tsx': ['ScanCodes', 'scan'],
  'app/media/nfc/index.tsx': ['NfcScan', 'nfc'],
  'app/media/nfc/iddocread.tsx': ['IdCardReader', 'nfc/iddocread'],
  'app/media/nfc/identification.tsx': ['IdentificationFlow', 'nfc/identification'],
};

describe('media routes', () => {
  it('app/play and app/record are gone, their content is in app/media', () => {
    expect(exists('app/play')).toBe(false);
    expect(exists('app/record')).toBe(false);
    expect(exists('kit8/ui/components/media/video/RecordVideoNativeComponent.tsx')).toBe(false); // the fake recorders were replaced
    expect(exists('kit8/ui/components/media/video/RecordVideoWebComponent.tsx')).toBe(false);
  });

  it.each(Object.entries(ROUTES))('%s renders %s from kit8/ui/components/media', (file, [component, folder]) => {
    const src = read(file);
    expect(src).toContain(`kit8/ui/components/media/${folder}/${component}'`);
    const imported = /from '(\.\.\/[^']+)'/.exec(src)![1];
    const target = path.resolve(root, path.dirname(file), imported);
    expect(['.tsx', '.ts'].some((ext) => fs.existsSync(target + ext))).toBe(true);
  });

  it('the player routes pass the kind', () => {
    expect(read('app/media/play/audio/index.tsx')).toContain('kind="audio"');
    expect(read('app/media/play/video/index.tsx')).toContain('kind="video"');
  });

  it('every route has a hidden Drawer.Screen in app/_layout.tsx and a title', () => {
    const layout = read('app/_layout.tsx');
    for (const file of Object.keys(ROUTES)) {
      const name = file.replace(/^app\//, '').replace(/\.tsx$/, '');
      expect(layout).toContain(`<Drawer.Screen name="${name}"`);
    }
    for (const key of ['recordAudio', 'recordVideo', 'recordPhoto', 'scanCodes', 'scanNfc', 'playAudio', 'playVideo']) expect(read('kit8/i18n/i18n.ts')).toContain(`${key}: '`);
    expect(layout).not.toMatch(/record\/record(audio|video)(web|native)/);
    expect(layout).not.toMatch(/play\/playvideo(web|native)/);
  });

  it('the platform pairs exist (the bundler picks .web on the web, the plain file on iOS / Android)', () => {
    const pairs: Array<[string, string, string]> = [
      ['play', 'VideoPlayerView', 'tsx'], ['video', 'RecordVideo', 'tsx'], ['common', 'mediaFileStore', 'ts'],
      ['photo', 'RecordPhoto', 'tsx'], ['photo', 'applyPhotoFilter', 'ts'], ['scan', 'ScanCodes', 'tsx'],
      ['nfc', 'nfcReader', 'ts'], ['nfc', 'NfcBackgroundHandler', 'tsx'], ['nfc/iddocread', 'idTransport', 'ts'], ['nfc/identification', 'ocrEngine', 'ts'], ['nfc/identification', 'MrzPhotoStep', 'tsx'],
    ];
    for (const [folder, base, ext] of pairs) {
      expect(exists(`kit8/ui/components/media/${folder}/${base}.${ext}`)).toBe(true);
      expect(exists(`kit8/ui/components/media/${folder}/${base}.web.${ext}`)).toBe(true);
    }
  });

  it('professional libraries: vision-camera, expo-video and expo-audio are dependencies (vision-camera and expo-audio with config plugins)', () => {
    const pkg = JSON.parse(read('package.json'));
    for (const dep of ['react-native-vision-camera', 'expo-video', 'expo-audio', 'expo-document-picker', 'expo-file-system']) expect(pkg.dependencies[dep]).toBeTruthy();
    // expo-camera (CameraX 1.6.0) next to vision-camera 4.x (CameraX 1.5.0-alpha03) crashes Android: NoClassDefFoundError Camera2CameraInfoImpl
    expect(pkg.dependencies['expo-camera']).toBeUndefined();
    // react-native-video 6.19 needs media3 1.8; expo-audio / expo-video bring 1.9.0 -> NoSuchMethodError DefaultLoadControl.<init>, the app closes when a video starts
    expect(pkg.dependencies['react-native-video']).toBeUndefined();
    const config = read('app.config.js');
    expect(config).not.toMatch(/\[\s*'expo-camera'/);
    expect(config).toContain("'react-native-vision-camera'");
    expect(config).toContain("'expo-audio'");
  });

  it('scan + photo: react-native-nfc-manager and expo-image-manipulator are dependencies, the NFC plugin and the Android launch filter are in app.config.js', () => {
    const pkg = JSON.parse(read('package.json'));
    for (const dep of ['react-native-nfc-manager', 'expo-mlkit-ocr', '@noble/curves', '@noble/hashes', '@noble/ciphers', 'node-forge', 'expo-image-manipulator', '@shopify/react-native-skia', 'expo-clipboard', 'expo-haptics']) expect(pkg.dependencies[dep]).toBeTruthy();
    const config = read('app.config.js');
    expect(config).toContain("'react-native-nfc-manager'");
    expect(config).toContain('android.nfc.action.NDEF_DISCOVERED');
    expect(config).toContain('android.nfc.action.TAG_DISCOVERED');
    expect(config).toContain("'android.hardware.nfc'");
    // iOS may select the ICAO travel document application (the ID card / passport reader)
    expect(config).toContain("selectIdentifiers: ['A0000002471001']");
    // the iOS NDEF entitlement is needed by the NDEF read session: the plugin must not drop it
    expect(config).not.toContain('includeNdefEntitlement: false');
    // the text recognition of the Identification photo step (ML Kit needs iOS 16)
    expect(config).toContain("['expo-mlkit-ocr', { iosEngine: 'auto' }]");
    // Google AI of the Identification photo step: the key comes from .env GOOGLE_AI_API_KEY through extra (never typed into a file)
    expect(config).toContain('googleAiApiKey: process.env.GOOGLE_AI_API_KEY');
    // the iOS deployment target must NOT be lowered: Expo SDK 57 refuses anything under 16.4 (the whole config fails to load)
    expect(config).not.toMatch(/deploymentTarget:\s*'1[0-5]/);
    expect(config).not.toContain("deploymentTarget: '16.0'");
  });

  it('the media folder is sorted: only index.ts, README.md and the subfolders stand in its root', () => {
    const entries = fs.readdirSync(path.join(root, 'kit8/ui/components/media')).sort();
    expect(entries).toEqual(['README.md', 'audio', 'common', 'index.ts', 'nfc', 'photo', 'play', 'scan', 'video']);
  });
});
