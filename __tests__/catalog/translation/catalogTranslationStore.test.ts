// The translated titles for the interface language: the store, rowTitle, the title of SelectElementFromCatalog. (The host that fills it: catalogTranslationsHost.test.tsx.)
import { catalogTranslationCount, setCatalogTranslations, translatedDescription, translatedTitle } from '../../../kit8/catalog/translation/catalogTranslationStore';
import { rowTitle } from '../../../kit8/catalog/product/crud/productCatalogTools';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: {} }) }));
jest.mock('../../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => ({ __esModule: true, default: () => null }));
jest.mock('react-redux', () => ({ useSelector: () => undefined, useDispatch: () => jest.fn(), shallowEqual: () => true }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
import { defaultTitleExtractor } from '../../../kit8/catalog/inner/select_element/SelectElementFromCatalog';

const tr = (owner: string, lang: string, field: string, text: string) => ({ rowOwnerGUID: owner, rowParentGUID: lang, rowJSON: { translationField: field, translationText: text } });
const product = { rowGUID: 'p1', rowOwnerGUID: 't', rowParentGUID: 'empty', orderInList: 0, rowJSON: { title: 'Tablet' } };

afterEach(() => setCatalogTranslations('en', []));

describe('the store', () => {
  it('keeps the title and the description of the interface language; empty text, other fields and other languages are ignored', () => {
    setCatalogTranslations('lv', [tr('p1', 'lv', 'title', ' Planšete '), tr('p1', 'lv', 'description', 'Viedā'), tr('p2', 'lv', 'title', '  '), tr('p3', 'ru', 'title', 'Другой'), tr('p4', 'lv', 'price', 'x')]);
    expect(translatedTitle('p1')).toBe('Planšete');
    expect(translatedDescription('p1')).toBe('Viedā');
    expect(translatedTitle('p2')).toBeUndefined();
    expect(translatedTitle('p3')).toBeUndefined();
    expect(translatedTitle('p4')).toBeUndefined();
    expect(catalogTranslationCount()).toBe(2);
  });
  it('a new language REPLACES the old one; nothing / null empties it', () => {
    setCatalogTranslations('lv', [tr('p1', 'lv', 'title', 'Planšete')]);
    setCatalogTranslations('ru', [tr('p1', 'ru', 'title', 'Планшет')]);
    expect(translatedTitle('p1')).toBe('Планшет');
    setCatalogTranslations('ru', null);
    expect(translatedTitle('p1')).toBeUndefined();
    expect(translatedTitle(null)).toBeUndefined();
  });
});

describe('the displays', () => {
  it('rowTitle: the translation when there is one, else the item\'s own title', () => {
    expect(rowTitle(product)).toBe('Tablet');
    setCatalogTranslations('lv', [tr('p1', 'lv', 'title', 'Planšete')]);
    expect(rowTitle(product)).toBe('Planšete');
    expect(rowTitle({ ...product, rowGUID: 'p9', rowJSON: { title: 'Phone' } })).toBe('Phone');
    // only the TITLE is shown: a description translation changes nothing
    setCatalogTranslations('lv', [tr('p1', 'lv', 'description', 'Viedā')]);
    expect(rowTitle(product)).toBe('Tablet');
  });
  it('the title of a catalog select follows it too (SelectElementFromCatalog)', () => {
    expect(defaultTitleExtractor(product)).toBe('Tablet');
    setCatalogTranslations('lv', [tr('p1', 'lv', 'title', 'Planšete')]);
    expect(defaultTitleExtractor(product)).toBe('Planšete');
    expect(defaultTitleExtractor(null)).toBe('');
  });
  it('the item itself is never changed (an editable cell and the database keep the own text)', () => {
    setCatalogTranslations('lv', [tr('p1', 'lv', 'title', 'Planšete')]);
    expect(product.rowJSON.title).toBe('Tablet');
  });
});
