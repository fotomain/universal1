import type { CardItem } from './types';

/**
 * Organizes a flat list of cards into hierarchical depth-first order
 * based on card.parentId or card.rawItem.rowParentGUID.
 * Descendants of collapsed cards are omitted from the visible list.
 */
export function organizeCardsHierarchy(
  cards: CardItem[],
  collapsedIds: Set<string>
): CardItem[] {
  if (!cards || cards.length === 0) return [];

  const cardMap = new Map<string, CardItem>();
  const childrenMap = new Map<string, CardItem[]>();

  for (const card of cards) {
    cardMap.set(card.id, card);
    const parentId =
      card.parentId ||
      (card.rawItem?.rowParentGUID &&
      card.rawItem.rowParentGUID !== 'empty' &&
      card.rawItem.rowParentGUID !== card.rawItem?.rowOwnerGUID
        ? card.rawItem.rowParentGUID
        : null);

    if (parentId) {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId)!.push(card);
    }
  }

  // Sort sibling children by orderInList
  childrenMap.forEach((list) => {
    list.sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));
  });

  // Find root cards (no parent or parent not found in current card set)
  const roots = cards.filter((card) => {
    const parentId =
      card.parentId ||
      (card.rawItem?.rowParentGUID &&
      card.rawItem.rowParentGUID !== 'empty' &&
      card.rawItem.rowParentGUID !== card.rawItem?.rowOwnerGUID
        ? card.rawItem.rowParentGUID
        : null);
    return !parentId || !cardMap.has(parentId);
  });
  roots.sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));

  const result: CardItem[] = [];

  function traverse(card: CardItem, depth: number) {
    const kids = childrenMap.get(card.id) || [];
    const isExpanded = !collapsedIds.has(card.id);
    result.push({
      ...card,
      depth,
      hasChildren: kids.length > 0,
      isExpanded,
    });
    if (isExpanded) {
      for (const kid of kids) {
        traverse(kid, depth + 1);
      }
    }
  }

  for (const root of roots) {
    traverse(root, 0);
  }

  return result;
}
