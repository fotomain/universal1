// Dynamic app.config.js – reads APP_NAME from environment
const variantConfigs = {
  appPosts: {
    name: 'My Posts App',
    slug: 'my-posts-app',
    ios: { bundleIdentifier: 'com.myapp.posts' },
    android: { package: 'com.myapp.posts' },
    icon: './assets/appPosts/icon.png',
    splash: { image: './assets/appPosts/splash.png' },
    scheme: 'myapp-posts',
  },
  appCC1: {
    name: 'My CC1 App',
    slug: 'my-cc1-app',
    ios: { bundleIdentifier: 'com.myapp.cc1' },
    android: { package: 'com.myapp.cc1' },
    icon: './assets/appCC1/icon.png',
    splash: { image: './assets/appCC1/splash.png' },
    scheme: 'myapp-cc1',
  },
  appOnTrend: {
    name: 'My OnTrend App',
    slug: 'my-ontrend-app',
    ios: { bundleIdentifier: 'com.myapp.ontrend' },
    android: { package: 'com.myapp.ontrend' },
    icon: './assets/appOnTrend/icon.png',
    splash: { image: './assets/appOnTrend/splash.png' },
    scheme: 'myapp-ontrend',
  },
  appClothes1: {
    name: 'My Clothes1 App',
    slug: 'my-clothes1-app',
    ios: { bundleIdentifier: 'com.myapp.clothes1' },
    android: { package: 'com.myapp.clothes1' },
    icon: './assets/appClothes1/icon.png',
    splash: { image: './assets/appClothes1/splash.png' },
    scheme: 'myapp-clothes1',
  },
};

// Texts of the permission questions (iOS shows them; Android uses its own wording).
const PERMISSION_TEXT = {
  camera: 'The app uses the camera to record video and take pictures for your posts.',
  microphone: 'The app uses the microphone to record audio and video for your posts.',
  photos: 'The app reads your photo library so you can attach pictures and videos.',
  savePhotos: 'The app saves recorded pictures and videos to your photo library.',
};

const defaultVariant = 'appClothes1';
const appName = process.env.APP_NAME || defaultVariant;
const variant = variantConfigs[appName] || variantConfigs[defaultVariant];

module.exports = {
  expo: {
    version: '1.0.0',
    // 'default' = the app follows the device: portrait <-> landscape auto rotate (phones and tablets)
    orientation: 'default',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-router',
      'expo-build-properties',
      'expo-font',
      'expo-image',
      'expo-localization',
      'expo-secure-store',
      'expo-splash-screen',
      'expo-sqlite',
      'expo-status-bar',
      'expo-web-browser',
      // Share into the app from other apps (kit8/providers/WithIntent.tsx): links, text, pictures, video, files
      [
        'expo-share-intent',
        {
          androidIntentFilters: ['text/*', 'image/*', 'video/*', '*/*'],
          androidMultiIntentFilters: ['image/*', 'video/*', '*/*'],
          iosActivationRules: {
            NSExtensionActivationSupportsWebURLWithMaxCount: 1,
            NSExtensionActivationSupportsWebPageWithMaxCount: 1,
            NSExtensionActivationSupportsText: true,
            NSExtensionActivationSupportsImageWithMaxCount: 10,
            NSExtensionActivationSupportsMovieWithMaxCount: 5,
            NSExtensionActivationSupportsFileWithMaxCount: 10,
          },
        },
      ],
      ['expo-camera', { cameraPermission: PERMISSION_TEXT.camera, microphonePermission: PERMISSION_TEXT.microphone, recordAudioAndroid: true }],
      ['expo-media-library', { photosPermission: PERMISSION_TEXT.photos, savePhotosPermission: PERMISSION_TEXT.savePhotos, isAccessMediaLocationEnabled: true }],
    ],
    owner: 'foto888999',
    extra: {
      appName,
      eas: {
        projectId: 'bcc76802-860a-4f85-9d51-723119055d94',
      },
    }, // available in code via Constants.expoConfig.extra

    // Variant-specific fields (merged)
    name: variant.name,
    slug: variant.slug,
    ios: {
      ...variant.ios,
      supportsTablet: true,
      // iPad multitasking needs every orientation; phones rotate too (orientation: 'default')
      requireFullScreen: false,
      infoPlist: {
        NSCameraUsageDescription: PERMISSION_TEXT.camera,
        NSMicrophoneUsageDescription: PERMISSION_TEXT.microphone,
        NSPhotoLibraryUsageDescription: PERMISSION_TEXT.photos,
        NSPhotoLibraryAddUsageDescription: PERMISSION_TEXT.savePhotos,
        UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'],
        'UISupportedInterfaceOrientations~ipad': [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationPortraitUpsideDown',
          'UIInterfaceOrientationLandscapeLeft',
          'UIInterfaceOrientationLandscapeRight',
        ],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...variant.android,
      permissions: [
        'android.permission.INTERNET',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
      ],
    },
    icon: variant.icon,
    splash: variant.splash,
    // 'myapp' is the scheme Google sign-in redirects to on native (myapp://auth)
    scheme: [variant.scheme, 'myapp'],
  },
};
