import { CustomLightTheme } from '../../theme/palettes';

/** Light-theme FAB palette — used for all FABs regardless of app light/dark mode. */
export const FAB_DEFAULT_BG = CustomLightTheme.colors.primaryContainer;
export const FAB_DEFAULT_ICON = CustomLightTheme.colors.onPrimaryContainer;

export function getFabMainColors(customFabColor?: string) {
  return {
    backgroundColor: customFabColor || FAB_DEFAULT_BG,
    iconColor: FAB_DEFAULT_ICON,
  };
}

export function getFabMiniColors(customFabColor?: string, actionColor?: string) {
  if (actionColor) {
    return {
      backgroundColor: actionColor,
      iconColor: CustomLightTheme.colors.onError,
    };
  }
  return {
    backgroundColor: customFabColor || FAB_DEFAULT_BG,
    iconColor: FAB_DEFAULT_ICON,
  };
}
