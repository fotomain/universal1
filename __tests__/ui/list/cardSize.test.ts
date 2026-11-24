// The three card sizes: fixed heights (a ReusableList item has a fixed height), medium = twice the small one.
import { CARD_GAP, CARD_SIZES, cardInnerHeight, cardItemHeight, DEFAULT_CARD_SIZE, isCardSize, normalizeCardSize } from '../../../kit8/ui/components/list/cards/cardSize';

it('has cardSmall, cardMedium, cardBig; medium is twice the height of small, big is bigger still', () => {
  expect([...CARD_SIZES]).toEqual(['cardSmall', 'cardMedium', 'cardBig']);
  expect(cardItemHeight('cardMedium')).toBe(2 * cardItemHeight('cardSmall'));
  expect(cardItemHeight('cardBig')).toBeGreaterThan(cardItemHeight('cardMedium'));
});

it('the card is its item without the gap', () => {
  CARD_SIZES.forEach((s) => expect(cardInnerHeight(s)).toBe(cardItemHeight(s) - CARD_GAP));
});

it('a stored value that is no size gives the default (cardSmall)', () => {
  expect(DEFAULT_CARD_SIZE).toBe('cardSmall');
  expect(normalizeCardSize('cardBig')).toBe('cardBig');
  expect(normalizeCardSize('huge')).toBe('cardSmall');
  expect(normalizeCardSize(undefined)).toBe('cardSmall');
  expect(isCardSize('cardMedium')).toBe(true);
  expect(isCardSize(3)).toBe(false);
});

it('the small cards use the list_alt icon (the icon of the toolbar button and of its menu item)', () => {
  const { CARD_SIZE_ICON } = require('../../../kit8/ui/components/list/cards/cardSize');
  expect(CARD_SIZE_ICON.cardSmall).toBe('list_alt');
});
