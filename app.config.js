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
};

const defaultVariant = 'appPosts';
const appName = process.env.APP_NAME || defaultVariant;
const variant = variantConfigs[appName] || variantConfigs[defaultVariant];

module.exports = {
  expo: {
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],
    web: { favicon: './assets/favicon.png' },
    plugins: ['expo-router'],
    extra: { appName }, // available in code via Constants.expoConfig.extra.appName

    // Variant-specific fields (merged)
    name: variant.name,
    slug: variant.slug,
    ios: variant.ios,
    android: variant.android,
    icon: variant.icon,
    splash: variant.splash,
    scheme: variant.scheme,
  },
};