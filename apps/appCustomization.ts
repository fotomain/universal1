// The registry: which customization an app (APP_NAME) has. ONE place that maps an app name to what the app changes; the shared code
// asks through providers/AppCustomizationProvider (the root layout puts getAppCustomization() there). An unknown name = no customization.
// Rules: documentation/APP_CUSTOMIZATION_RULES.html. The client reads the name from expoConfig.extra.configurationName, never from process.env.
import Constants from 'expo-constants';
import type { AppCustomization } from '../kit8/providers/AppCustomizationProvider';
import { EMPTY_APP_CUSTOMIZATION } from '../kit8/providers/AppCustomizationProvider';
import HomeAppPostsPage from './appPosts/HomeAppPostsPage';
import HomeAppCC1 from './appCC1/HomeAppCC1';
import HomeAppOnTrend from './appOnTrend/HomeAppOnTrend';
import HomeAppClothes1 from './appClothes1/HomeAppClothes1';
import { appPM80Customization } from './appPM80/customization';

export const APP_CUSTOMIZATIONS: Record<string, AppCustomization> = {
  appPosts: { homeComponent: HomeAppPostsPage },
  appCC1: { homeComponent: HomeAppCC1 },
  appOnTrend: { homeComponent: HomeAppOnTrend },
  appClothes1: { homeComponent: HomeAppClothes1 },
  appPM80: appPM80Customization,
};

export const DEFAULT_APP_NAME = 'appClothes1';

/** the app this bundle was made for (app.config.js: extra.configurationName) */
export function getAppName(): string {
  return (Constants.expoConfig?.extra?.configurationName as string | undefined) || DEFAULT_APP_NAME;
}

/** the customization of an app; the empty one for a name nobody knows */
export function getAppCustomization(name: string = getAppName()): AppCustomization {
  return APP_CUSTOMIZATIONS[name] ?? EMPTY_APP_CUSTOMIZATION;
}
