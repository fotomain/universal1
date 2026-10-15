// app/play and app/record moved into app/media; every media route is one line over a component of kit8/ui/components/media.
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(root, p));

const ROUTES: Record<string, string> = {
  'app/media/record/audio/index.tsx': 'RecordAudio',
  'app/media/record/video/index.tsx': 'RecordVideo',
  'app/media/play/audio/index.tsx': 'MediaPlayerScreen',
  'app/media/play/video/index.tsx': 'MediaPlayerScreen',
};

describe('media routes', () => {
  it('app/play and app/record are gone, their content is in app/media', () => {
    expect(exists('app/play')).toBe(false);
    expect(exists('app/record')).toBe(false);
    expect(exists('kit8/ui/components/media/RecordVideoNativeComponent.tsx')).toBe(false); // the fake recorders were replaced
    expect(exists('kit8/ui/components/media/RecordVideoWebComponent.tsx')).toBe(false);
  });

  it.each(Object.entries(ROUTES))('%s renders %s from kit8/ui/components/media', (file, component) => {
    const src = read(file);
    expect(src).toContain(`kit8/ui/components/media/${component}'`);
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
    for (const key of ['recordAudio', 'recordVideo', 'playAudio', 'playVideo']) expect(read('kit8/i18n/i18n.ts')).toContain(`${key}: '`);
    expect(layout).not.toMatch(/record\/record(audio|video)(web|native)/);
    expect(layout).not.toMatch(/play\/playvideo(web|native)/);
  });

  it('the platform pairs exist (the bundler picks .web on the web, the plain file on iOS / Android)', () => {
    for (const base of ['VideoPlayerView', 'RecordVideo', 'mediaFileStore']) {
      const ext = base === 'mediaFileStore' ? 'ts' : 'tsx';
      expect(exists(`kit8/ui/components/media/${base}.${ext}`)).toBe(true);
      expect(exists(`kit8/ui/components/media/${base}.web.${ext}`)).toBe(true);
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
});
