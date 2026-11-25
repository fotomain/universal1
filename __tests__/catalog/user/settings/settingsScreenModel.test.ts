jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}), { virtual: true });

import { filterSections, hitsPerTab, SETTINGS_SECTIONS, SETTINGS_TABS, sectionMatches, sectionsOfTab, THEME_COLOR_KEYS } from '../../../../kit8/ui/settings/settingsModel';
import fs from 'fs';
import path from 'path';

// the blocks are React components (they need the design system); the test reads the table of SettingsSections.tsx as text
const sectionsSource = fs.readFileSync(path.join(__dirname, '../../../../kit8/ui/settings/SettingsSections.tsx'), 'utf8');
const table = sectionsSource.slice(sectionsSource.indexOf('export const SECTION_COMPONENTS'));
const drawnIds = Array.from(table.matchAll(/^\s*(?:'([a-z-]+)'|([a-z]+)):/gm)).map((m) => m[1] || m[2]);

describe('/settings tabs and search', () => {
  it('every section belongs to a tab and has a block that draws it; every tab has a section', () => {
    const tabs = SETTINGS_TABS.map((t) => t.id);
    for (const s of SETTINGS_SECTIONS) {
      expect(tabs).toContain(s.tab);
      expect(drawnIds).toContain(s.id);
    }
    for (const t of tabs) expect(sectionsOfTab(t).length).toBeGreaterThan(0);
    expect(new Set(SETTINGS_SECTIONS.map((s) => s.id)).size).toBe(SETTINGS_SECTIONS.length);
    expect(drawnIds.sort()).toEqual(SETTINGS_SECTIONS.map((s) => s.id).sort());
  });
  it('an empty search shows everything; words match the start of a word of the title, keywords or tab', () => {
    expect(filterSections('')).toHaveLength(SETTINGS_SECTIONS.length);
    expect(filterSections('selawik').map((s) => s.id)).toEqual(['font-theme']);
    expect(filterSections('dark').map((s) => s.id)).toContain('dark-mode');
    expect(filterSections('estim grid').map((s) => s.id)).toEqual(['dash-estimation']);
    expect(filterSections('copy other device').map((s) => s.id)).toEqual(['device-info']);
    expect(filterSections('zzzz')).toEqual([]);
    expect(filterSections('  FONT  ').map((s) => s.id)).toEqual(expect.arrayContaining(['font-theme', 'font-elements']));
  });
  it('the tab name is searched too; the hits per tab add up', () => {
    expect(filterSections('media').every((s) => s.tab === 'media' || s.keywords.some((k) => k.startsWith('media')))).toBe(true);
    const h = hitsPerTab('font');
    expect(h.fonts).toBeGreaterThanOrEqual(2);
    expect(Object.values(h).reduce((a, b) => a + b, 0)).toBe(filterSections('font').length);
    expect(sectionMatches(SETTINGS_SECTIONS[0], 'design')).toBe(true);
  });
  it('the colors tab changes the main MD3 colors', () => {
    expect(THEME_COLOR_KEYS.map((c) => c.key)).toEqual(expect.arrayContaining(['primary', 'secondary', 'tertiary', 'background', 'surface', 'error']));
  });
});
