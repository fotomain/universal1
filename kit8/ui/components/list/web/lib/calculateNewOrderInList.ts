import { CardItem } from './types';

export function calculateNewOrderInList(
  currentCards: CardItem[],
  destIndex: number,
  originalCards?: CardItem[]
): number {
  if (!currentCards || currentCards.length === 0) {
    return Date.now();
  }

  // To determine list direction, use originalCards if provided, or currentCards excluding the item at destIndex
  const referenceCards = (originalCards && originalCards.length > 0)
    ? originalCards
    : currentCards.filter((_, idx) => idx !== destIndex);

  const isDesc = referenceCards.length >= 2
    ? (referenceCards[0]?.orderInList || 0) > (referenceCards[referenceCards.length - 1]?.orderInList || 0)
    : false;

  const itemBefore = destIndex > 0 ? currentCards[destIndex - 1] : undefined;
  const itemAfter = destIndex < currentCards.length - 1 ? currentCards[destIndex + 1] : undefined;

  const beforeOrder = itemBefore?.orderInList;
  const afterOrder = itemAfter?.orderInList;

  if (beforeOrder !== undefined && afterOrder !== undefined) {
    return (beforeOrder + afterOrder) / 2;
  }

  const GAP = 100000;

  if (beforeOrder === undefined && afterOrder !== undefined) {
    return isDesc ? afterOrder + GAP : afterOrder - GAP;
  }

  if (afterOrder === undefined && beforeOrder !== undefined) {
    return isDesc ? beforeOrder - GAP : beforeOrder + GAP;
  }

  return Date.now();
}

export default calculateNewOrderInList;
