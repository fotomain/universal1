// The font FILES for expo-font (useFonts / Font.loadAsync): key = the family name that fontCatalog.ts gives to React Native. Kept apart from fontCatalog.ts so that the registry stays pure.
// The files live in assets/fonts (licenses next to them); the web build also has them in public/fonts (the Skia loaders fetch /fonts/*.ttf).
export const FONT_ASSETS: Record<string, any> = {
  Roboto_400Regular: require('../../../assets/fonts/Roboto_400Regular.ttf'),
  Roboto_400Regular_Italic: require('../../../assets/fonts/Roboto_400Regular_Italic.ttf'),
  Roboto_500Medium: require('../../../assets/fonts/Roboto_500Medium.ttf'),
  Roboto_700Bold: require('../../../assets/fonts/Roboto_700Bold.ttf'),
  Inter_400Regular: require('../../../assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('../../../assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('../../../assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('../../../assets/fonts/Inter_700Bold.ttf'),
  Selawik_300Light: require('../../../assets/fonts/Selawik_300Light.ttf'),
  Selawik_350Semilight: require('../../../assets/fonts/Selawik_350Semilight.ttf'),
  Selawik_400Regular: require('../../../assets/fonts/Selawik_400Regular.ttf'),
  Selawik_600SemiBold: require('../../../assets/fonts/Selawik_600SemiBold.ttf'),
  Selawik_700Bold: require('../../../assets/fonts/Selawik_700Bold.ttf'),
};
