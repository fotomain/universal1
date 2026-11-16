/** @jest-environment jsdom */
import { Platform } from 'react-native';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { configurationName: 'appPM80' } } } }));
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ isDark: false }) }));

const { applyPM80Favicon, PM80_TRANSPARENT_ICON_SVG } = require('../../../apps/appPM80/home/pm80Favicon');

const ORIGINAL = '/assets/favicon.png';

beforeEach(() => {
  document.head.innerHTML = `<link rel="icon" href="${ORIGINAL}">`;
  (Platform as any).OS = 'web';
  // the canvas of jsdom cannot draw: the image fails to load = the SVG data URI path
  (global as any).Image = class {
    onerror: null | (() => void) = null;
    set src(_v: string) {
      setTimeout(() => this.onerror && this.onerror(), 0);
    }
  };
});

const iconHref = () => document.head.querySelector('link[rel~="icon"]')!.getAttribute('href');

describe('PM80 favicon by theme (web)', () => {
  it('the emblem has NO background rectangle (transparent)', () => {
    expect(PM80_TRANSPARENT_ICON_SVG).not.toMatch(/<rect[^>]*width="1024"/);
    expect(PM80_TRANSPARENT_ICON_SVG).not.toContain('pm80BgGrad');
  });

  it('light theme -> the transparent emblem, dark theme -> the original icon again', async () => {
    expect(applyPM80Favicon(false)).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(iconHref()).toMatch(/^data:image\/svg\+xml/);
    expect(document.head.querySelectorAll('link[rel~="icon"]')).toHaveLength(1);

    applyPM80Favicon(true);
    expect(iconHref()).toBe(ORIGINAL);
  });

  it('does nothing on iOS / Android', () => {
    (Platform as any).OS = 'ios';
    expect(applyPM80Favicon(false)).toBe(false);
    expect(iconHref()).toBe(ORIGINAL);
  });
});
