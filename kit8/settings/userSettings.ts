import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

export interface UserSettings {
  userGUID: string;
  userLanguage: string;
}

export const DEFAULT_LANGUAGE = 'en';

export const getStorageKey = (userGUID: string) => `userSettings${userGUID || 'guest'}`;

export async function getUserSettings(userGUID: string): Promise<UserSettings> {
  try {
    const key = getStorageKey(userGUID);
    const data = await AsyncStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading userSettings:', e);
  }

  // First run default: check expo-localization or fallback to 'en'
  const locales = getLocales();
  const deviceLang = locales?.[0]?.languageCode || DEFAULT_LANGUAGE;
  return {
    userGUID: userGUID || 'guest',
    userLanguage: deviceLang || DEFAULT_LANGUAGE,
  };
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  try {
    const key = getStorageKey(settings.userGUID);
    await AsyncStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving userSettings:', e);
  }
}
