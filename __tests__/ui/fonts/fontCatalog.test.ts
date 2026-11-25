import fs from 'fs';
import path from 'path';
import {
  allFontFileNames, FONT_FILES, fontStackFor, nativeFamilyFor, nearestWeight, resolveFont, SYSTEM_SANS_STACK, tableRowHeightFor, TYPE_SCALE,
  FONT_NAMES, FONT_SIZE_NAMES,
} from '../../../kit8/ui/fonts/fontCatalog';
import { applyFontsToPaperTheme, sizeFactor, textFamily } from '../../../kit8/ui/fonts/paperFonts';

const root = path.join(__dirname, '..', '..', '..');

describe('font registry', () => {
  it('every file the registry names exists in assets/fonts and public/fonts, and is a real font', () => {
    for (const f of allFontFileNames()) {
      for (const dir of ['assets/fonts', 'public/fonts']) {
        const p = path.join(root, dir, f + '.ttf');
        expect(fs.existsSync(p)).toBe(true);
        const head = fs.readFileSync(p).subarray(0, 4);
        expect([0x00010000, 0x74727565, 0x4f54544f]).toContain(head.readUInt32BE(0));
      }
    }
  });
  it('the license of every bundled family is next to the files', () => {
    const names = fs.readdirSync(path.join(root, 'assets/fonts'));
    for (const fam of ['Roboto', 'Inter', 'Selawik']) expect(names.some((n) => n.startsWith('LICENSE_' + fam))).toBe(true);
  });
  it('no Apple font file is shipped (SF Pro / New York may not be bundled)', () => {
    for (const dir of ['assets/fonts', 'public/fonts']) {
      for (const n of fs.readdirSync(path.join(root, dir))) expect(/^(SF[-_ ]?(Pro|Compact|Mono|NS)|SFNS|NewYork|New[-_ ]York|\.SF)/i.test(n)).toBe(false);
    }
  });
  it('every non-system stack ends with the system stack (a font that has not arrived shows the system font)', () => {
    expect(fontStackFor('system')).toBe(SYSTEM_SANS_STACK);
    for (const n of FONT_NAMES.filter((x) => x !== 'system')) expect(fontStackFor(n).endsWith(SYSTEM_SANS_STACK)).toBe(true);
    expect(SYSTEM_SANS_STACK.startsWith('system-ui')).toBe(true);
  });
  it('a weight a family lacks maps to the nearest one (Selawik has no 500)', () => {
    expect(nearestWeight([300, 350, 400, 600, 700], 500)).toBe(600); // 400 and 600 are equally far: the heavier one wins
    expect(nearestWeight([400, 500, 700], 600)).toBe(700);
    expect(nearestWeight([400, 500, 700], 450)).toBe(500);
  });
  it('native family: undefined for system, the loaded file otherwise', () => {
    expect(nativeFamilyFor('system', 400)).toBeUndefined();
    expect(nativeFamilyFor('roboto', 500)).toBe('Roboto_500Medium');
    expect(nativeFamilyFor('inter', 700)).toBe('Inter_700Bold');
    expect(nativeFamilyFor('selawik', 400)).toBe('Selawik_400Regular');
    expect(Object.keys(FONT_FILES).sort()).toEqual(['inter', 'roboto', 'selawik']);
  });
});

describe('the size table (Angular Material 3 type scale)', () => {
  it('has the three sizes for every role', () => {
    for (const role of ['body', 'header', 'label', 'title'] as const) for (const s of FONT_SIZE_NAMES) expect(TYPE_SCALE[role][s].fontSize).toBeGreaterThan(0);
  });
  it('body small / medium / large = 12 / 14 / 16 px with 16 / 20 / 24 line height', () => {
    expect(FONT_SIZE_NAMES.map((s) => [TYPE_SCALE.body[s].fontSize, TYPE_SCALE.body[s].lineHeight])).toEqual([[12, 16], [14, 20], [16, 24]]);
  });
  it('resolveFont gives the family, the css stack and the numbers; a wrong choice falls back', () => {
    const r = resolveFont({ fontName: 'inter', fontSize: 'large' }, 'header');
    expect(r).toMatchObject({ fontFamily: 'Inter_500Medium', fontSize: 16, lineHeight: 24, fontWeight: 500 });
    expect(r.cssFontFamily.startsWith('Inter,')).toBe(true);
    const bad: any = resolveFont({ fontName: 'comic', fontSize: 'huge' } as any);
    expect(bad.fontFamily).toBeUndefined();
    expect(bad.fontSize).toBe(14);
  });
  it('row height follows the line height', () => {
    expect(tableRowHeightFor('small')).toBe(32);
    expect(tableRowHeightFor('large')).toBe(36);
  });
});

describe('Paper theme fonts', () => {
  const base: any = { fonts: { bodyMedium: { fontFamily: 'System', fontWeight: '400', fontSize: 14, lineHeight: 20 }, titleSmall: { fontFamily: 'System', fontWeight: '500', fontSize: 14, lineHeight: 20 } } };
  it('every variant takes the file of ITS weight, with no synthetic bold, and the scaled size', () => {
    const t = applyFontsToPaperTheme(base, 'roboto', 'large', false);
    expect(t.fonts.bodyMedium.fontFamily).toBe('Roboto_400Regular');
    expect(t.fonts.titleSmall.fontFamily).toBe('Roboto_500Medium');
    expect(t.fonts.titleSmall.fontWeight).toBe('normal');
    expect(t.fonts.bodyMedium.fontSize).toBeCloseTo(16, 1);
    expect(t.fonts.bodyMedium.lineHeight).toBe(23);
  });
  it('system keeps the family of the theme on a phone and gets the system stack on the web; the web adds the stack after a bundled font', () => {
    expect(applyFontsToPaperTheme(base, 'system', 'medium', false).fonts.bodyMedium.fontFamily).toBe('System');
    expect(applyFontsToPaperTheme(base, 'system', 'medium', true).fonts.bodyMedium.fontFamily).toBe(SYSTEM_SANS_STACK);
    expect(textFamily('inter', 400, true)).toBe(`Inter_400Regular, ${SYSTEM_SANS_STACK}`);
    expect(sizeFactor('small')).toBeCloseTo(12 / 14, 5);
  });
});
