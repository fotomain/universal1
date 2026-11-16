import { Linking, Platform } from 'react-native';

/**
 * Opens a vendor home page URL in a new browser tab on web, or via Linking on native.
 */
export function openVendorWebsite(url?: string): void {
  if (!url) return;
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.open === 'function'
  ) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url).catch(() => {});
}

