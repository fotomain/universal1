import { getWebFallbackGlyph } from '../kit8/components/list/web/lib/CardThreeDotsMenu';

describe('CardThreeDotsMenu web fallback', () => {
  it('uses a visible glyph instead of the font-based more-vert icon on web', () => {
    expect(getWebFallbackGlyph('more-vert')).toBe('⋮');
    expect(getWebFallbackGlyph('edit')).toBe('✎');
    expect(getWebFallbackGlyph('delete')).toBe('🗑');
    expect(getWebFallbackGlyph('share')).toBe('↗');
  });
});
