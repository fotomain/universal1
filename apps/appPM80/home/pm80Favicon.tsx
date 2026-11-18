// pm80Favicon - the browser tab icon of appPM80 (web only).
//   dark app theme  -> the normal icon (dark rounded square, from app.config.js `web.favicon`)
//   light app theme -> the same emblem on a TRANSPARENT background (no dark square on a light tab bar)
// The emblem is the SVG of PM80BrandLogo without the background, drawn on a canvas as PNG (works in every browser,
// Safari too, which ignores SVG favicons); when the canvas is not available the SVG data URI is used.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useDesignSystem } from '../../../kit8/providers/WithDesignSystem';

/** the emblem without the background (same shapes as PM80BrandLogo, withBackground = false) */
export const PM80_TRANSPARENT_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 1024 1024">' +
  '<defs>' +
  '<linearGradient id="r" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#EC4899"/><stop offset="45%" stop-color="#8B5CF6"/><stop offset="80%" stop-color="#06B6D4"/><stop offset="100%" stop-color="#10B981"/></linearGradient>' +
  '<linearGradient id="b1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#60A5FA"/><stop offset="100%" stop-color="#2563EB"/></linearGradient>' +
  '<linearGradient id="b2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#C084FC"/><stop offset="100%" stop-color="#7C3AED"/></linearGradient>' +
  '<linearGradient id="b3" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#34D399"/><stop offset="100%" stop-color="#059669"/></linearGradient>' +
  '<linearGradient id="a" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#F472B6"/><stop offset="50%" stop-color="#FBBF24"/><stop offset="100%" stop-color="#34D399"/></linearGradient>' +
  '</defs>' +
  '<circle cx="512" cy="512" r="330" stroke="#CBD5E1" stroke-width="84" fill="none"/>' +
  '<circle cx="512" cy="512" r="330" stroke="url(#r)" stroke-width="84" stroke-dasharray="1650 2073" stroke-linecap="round" fill="none" transform="rotate(135 512 512)"/>' +
  '<rect x="348" y="540" width="84" height="170" rx="22" fill="url(#b1)"/>' +
  '<rect x="470" y="450" width="84" height="260" rx="22" fill="url(#b2)"/>' +
  '<rect x="592" y="340" width="84" height="370" rx="22" fill="url(#b3)"/>' +
  '<path d="M 336 500 Q 470 430 638 286" stroke="url(#a)" stroke-width="44" stroke-linecap="round" fill="none"/>' +
  '<path d="M 578 280 L 652 274 L 646 348" stroke="#34D399" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '</svg>';

export const pm80TransparentIconDataUri = (): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PM80_TRANSPARENT_ICON_SVG)}`;

const ORIGINAL_ATTR = 'data-pm80-original-href';

/** web: the tab icon for the theme. Returns false when there is no document (iOS / Android / tests without a DOM). */
export function applyPM80Favicon(isDark: boolean): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.head) return false;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  // the dev server page has no icon link at all (the browser asks /favicon.ico): the normal icon is then /favicon.ico
  if (!link.hasAttribute(ORIGINAL_ATTR)) link.setAttribute(ORIGINAL_ATTR, link.getAttribute('href') || '/favicon.ico');
  const original = link.getAttribute(ORIGINAL_ATTR) || '/favicon.ico';

  if (isDark) {
    link.setAttribute('href', original);
    link.removeAttribute('type');
    return true;
  }

  const svgUri = pm80TransparentIconDataUri();
  const setSvg = () => {
    link!.setAttribute('type', 'image/svg+xml');
    link!.setAttribute('href', svgUri);
  };
  try {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return setSvg();
        ctx.clearRect(0, 0, 64, 64); // transparent
        ctx.drawImage(img, 0, 0, 64, 64);
        link!.setAttribute('type', 'image/png');
        link!.setAttribute('href', canvas.toDataURL('image/png'));
      } catch {
        setSvg();
      }
    };
    img.onerror = setSvg;
    img.src = svgUri;
  } catch {
    setSvg();
  }
  return true;
}

/** Mounted once in app/_layout.tsx; does nothing for the other apps. */
export default function PM80FaviconByTheme() {
  let isDark = false;
  try {
    isDark = !!useDesignSystem()?.isDark;
  } catch {
    // outside the provider
  }
  const isPM80 = (Constants.expoConfig?.extra?.configurationName as string | undefined) === 'appPM80';
  useEffect(() => {
    if (isPM80) applyPM80Favicon(isDark);
  }, [isPM80, isDark]);
  return null;
}
