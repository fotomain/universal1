import React from 'react';
import { FABForCardComponent, FABForCardComponentProps } from '../kit8/components/fab/FABForCardComponent';
import { createBeforeCurrent } from '../kit8/components/list/web/lib/createBeforeCurrent';
import { createAfterCurrent } from '../kit8/components/list/web/lib/createAfterCurrent';
import { copyPasteBeforeCurrent } from '../kit8/components/list/web/lib/copyPasteBeforeCurrent';
import { copyPasteAfterCurrent } from '../kit8/components/list/web/lib/copyPasteAfterCurrent';
import { calculateNewOrderInList } from '../kit8/components/list/web/lib/calculateNewOrderInList';
import { CardItem } from '../kit8/components/list/web/lib/types';

jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-clipboard', () => ({}), { virtual: true });
jest.mock('expo-symbols', () => ({ SymbolView: () => null }), { virtual: true });
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: jest.fn() }) } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}), { virtual: true });

jest.mock('../context/DesignSystemContext', () => ({
  useDesignSystem: () => ({
    activeSystem: 'google_md3_web',
    themeColors: { primary: '#6750A4', surface: '#ffffff' },
    isDark: false,
  }),
}));

describe('FAB Card Actions (create & copy/paste before/after current)', () => {
  it('accepts FABForCardComponentProps with create and copy/paste callbacks', () => {
    const onCreateBeforeCurrent = jest.fn();
    const onCreateAfterCurrent = jest.fn();
    const onCopyPasteBeforeCurrent = jest.fn();
    const onCopyPasteAfterCurrent = jest.fn();

    const props: FABForCardComponentProps = {
      cardId: 'card-123',
      onCreateBeforeCurrent,
      onCreateAfterCurrent,
      onCopyPasteBeforeCurrent,
      onCopyPasteAfterCurrent,
    };

    expect(props.onCreateBeforeCurrent).toBeDefined();
    expect(props.onCreateAfterCurrent).toBeDefined();
    expect(props.onCopyPasteBeforeCurrent).toBeDefined();
    expect(props.onCopyPasteAfterCurrent).toBeDefined();
  });

  it('standalone createBeforeCurrent function computes orderInList dependently on target card position', () => {
    const cards: CardItem[] = [
      { id: 'card-1', title: 'First', orderInList: 100 },
      { id: 'card-2', title: 'Target', orderInList: 200 },
    ];

    const { nextCards, newCard, computedOrder } = createBeforeCurrent({
      id: 'card-2',
      cards,
      listOwnerGUID: 'user-1',
      uuidFn: () => 'created-before-id',
    });

    expect(nextCards[1].id).toBe('created-before-id');
    expect(computedOrder).toBe(150); // Interpolated between 100 and 200
    expect(newCard.orderInList).toBe(150);
  });

  it('standalone createAfterCurrent function computes orderInList dependently on target card position', () => {
    const cards: CardItem[] = [
      { id: 'card-1', title: 'First', orderInList: 100 },
      { id: 'card-2', title: 'Target', orderInList: 200 },
      { id: 'card-3', title: 'Third', orderInList: 300 },
    ];

    const { nextCards, newCard, computedOrder } = createAfterCurrent({
      id: 'card-2',
      cards,
      listOwnerGUID: 'user-1',
      uuidFn: () => 'created-after-id',
    });

    expect(nextCards[2].id).toBe('created-after-id');
    expect(computedOrder).toBe(250); // Interpolated between 200 and 300
    expect(newCard.orderInList).toBe(250);
  });

  it('standalone copyPasteBeforeCurrent computes orderInList and prefixes "Copy " to old title', () => {
    const cards: CardItem[] = [
      { id: 'card-1', title: 'Marketing Post', orderInList: 100 },
      { id: 'card-2', title: 'Target', orderInList: 300 },
    ];

    const { nextCards, newCard, computedOrder } = copyPasteBeforeCurrent({
      id: 'card-2',
      cards,
      listOwnerGUID: 'user-1',
      uuidFn: () => 'copy-before-id',
    });

    expect(newCard?.title).toBe('Copy Target');
    expect(nextCards[1].id).toBe('copy-before-id');
    expect(computedOrder).toBe(200); // Interpolated between 100 and 300
  });

  it('standalone copyPasteAfterCurrent computes orderInList and prefixes "Copy " to old title', () => {
    const cards: CardItem[] = [
      { id: 'card-1', title: 'Target', orderInList: 100 },
      { id: 'card-2', title: 'Third', orderInList: 300 },
    ];

    const { nextCards, newCard, computedOrder } = copyPasteAfterCurrent({
      id: 'card-1',
      cards,
      listOwnerGUID: 'user-1',
      uuidFn: () => 'copy-after-id',
    });

    expect(newCard?.title).toBe('Copy Target');
    expect(nextCards[1].id).toBe('copy-after-id');
    expect(computedOrder).toBe(200); // Interpolated between 100 and 300
  });

  it('correctly calculates orderInList when creating before a single card with orderInList 10', () => {
    const cards: CardItem[] = [
      { id: 'card-1', title: 'Single Card', orderInList: 10 },
    ];

    const { nextCards, newCard, computedOrder } = createBeforeCurrent({
      id: 'card-1',
      cards,
      listOwnerGUID: 'user-1',
      uuidFn: () => 'new-top-card',
    });

    expect(nextCards[0].id).toBe('new-top-card');
    expect(computedOrder).toBeLessThan(10); // Must be smaller than 10 (e.g. -99990), NOT 100010
    expect(newCard.orderInList).toBeLessThan(10);
  });
});
