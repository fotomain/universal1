// The three sizes of a list card (ReusableList + a card component). Pure: no React.
//   cardSmall   the compact card (what the Media Posts list had before the sizes existed)
//   cardMedium  twice the height: a bigger picture and more lines of text
//   cardBig     the large card: a wide picture on top, the whole title, the description, the actions
// A ReusableList item has a FIXED height (FlashList recycles the cells, the drag reorder is index math), so every size is a height in px.
export const CARD_SIZES = ['cardSmall', 'cardMedium', 'cardBig'] as const;
export type CardSize = typeof CARD_SIZES[number];

export const DEFAULT_CARD_SIZE: CardSize = 'cardSmall';

/** height of one list item per size, the gap between two cards included (CARD_GAP) */
export const CARD_ITEM_HEIGHT: Record<CardSize, number> = { cardSmall: 96, cardMedium: 192, cardBig: 400 };
/** space above + below a card inside its item */
export const CARD_GAP = 8;

export const CARD_SIZE_LABEL: Record<CardSize, string> = { cardSmall: 'Small cards', cardMedium: 'Medium cards', cardBig: 'Big cards' };
export const CARD_SIZE_ICON: Record<CardSize, string> = { cardSmall: 'list_alt', cardMedium: 'view_agenda', cardBig: 'crop_landscape' };

export const isCardSize = (value: unknown): value is CardSize => typeof value === 'string' && (CARD_SIZES as readonly string[]).includes(value);

/** a stored / typed value that is no size gives the default */
export const normalizeCardSize = (value: unknown): CardSize => (isCardSize(value) ? value : DEFAULT_CARD_SIZE);

export const cardItemHeight = (size: CardSize): number => CARD_ITEM_HEIGHT[size];
/** the height of the card itself inside its item */
export const cardInnerHeight = (size: CardSize): number => CARD_ITEM_HEIGHT[size] - CARD_GAP;
