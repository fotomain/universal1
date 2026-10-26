// G4 rich notes: the markup of the notes (pure part of PMRichNotes).
jest.mock('../../../kit8/pm/i18n/pmT', () => ({ pmT: (s: string) => s }));
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: {} }) }));
jest.mock('../../../kit8/ui/components/common/TextAreaApp', () => 'TextAreaApp');
jest.mock('../../../kit8/pm/inner/buttons', () => ({ PMDialogButton: 'PMDialogButton' }));
import { richAppend, richLinesOf } from '../../../kit8/pm/extended/PMRichNotes';

describe('rich notes', () => {
  it('reads bold, italic and bullets', () => {
    const lines = richLinesOf('plain **bold** and _italic_\n- item');
    expect(lines[0].bullet).toBe(false);
    expect(lines[0].runs.map((r) => [r.text, r.bold, r.italic])).toEqual([['plain ', false, false], ['bold', true, false], [' and ', false, false], ['italic', false, true]]);
    expect(lines[1].bullet).toBe(true);
    expect(lines[1].runs[0].text).toBe('item');
  });
  it('an empty text is one empty line', () => {
    expect(richLinesOf('')).toEqual([{ bullet: false, runs: [{ text: '', bold: false, italic: false }] }]);
  });
  it('the toolbar appends the marks; a bullet starts a new line', () => {
    expect(richAppend('a', 'bold')).toBe('a**bold**');
    expect(richAppend('a', 'italic')).toBe('a_italic_');
    expect(richAppend('a', 'bullet')).toBe('a\n- ');
    expect(richAppend('', 'bullet')).toBe('- ');
  });
});
