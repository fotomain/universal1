// environment - the name of the environment the app runs in: .env ENVIRONMENT_NAME (app.config.js puts it into `extra.environmentName`; EXPO_PUBLIC_ENVIRONMENT_NAME also works).
// DEV_ENVIRONMENT switches on the developer helpers (e.g. the table name in the three dots menu of ReusableTable).
export const DEV_ENVIRONMENT = 'DEV_ENVIRONMENT';

export function environmentName(): string {
  try {
    // loaded on first use (not at import): a screen without the developer helpers never touches the native module
    const Constants = require('expo-constants').default;
    const fromConfig = Constants?.expoConfig?.extra?.environmentName;
    if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim();
  } catch {
    // no constants (a test): the public variable
  }
  return String(process.env.EXPO_PUBLIC_ENVIRONMENT_NAME ?? '').trim();
}

export const isDevEnvironment = (): boolean => environmentName() === DEV_ENVIRONMENT;
