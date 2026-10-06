import { organizeCardsHierarchy } from '../../../kit8/ui/components/list/web/lib/hierarchy';
import type { CardItem } from '../../../kit8/ui/components/list/web/lib/types';

describe('organizeCardsHierarchy', () => {
  const cards: CardItem[] = [
    { id: '1', title: 'Root A', orderInList: 0, rawItem: { rowGUID: '1', rowParentGUID: 'empty' } },
    { id: '2', title: 'Child A1', orderInList: 0, parentId: '1', rawItem: { rowGUID: '2', rowParentGUID: '1' } },
    { id: '3', title: 'Child A2', orderInList: 1, parentId: '1', rawItem: { rowGUID: '3', rowParentGUID: '1' } },
    { id: '4', title: 'Grandchild A1.1', orderInList: 0, parentId: '2', rawItem: { rowGUID: '4', rowParentGUID: '2' } },
    { id: '5', title: 'Root B', orderInList: 1, rawItem: { rowGUID: '5', rowParentGUID: 'empty' } },
  ];

  it('orders cards depth-first and assigns depth and hasChildren correctly', () => {
    const result = organizeCardsHierarchy(cards, new Set());
    expect(result.map((c) => c.id)).toEqual(['1', '2', '4', '3', '5']);

    expect(result[0].depth).toBe(0);
    expect(result[0].hasChildren).toBe(true);

    expect(result[1].depth).toBe(1);
    expect(result[1].hasChildren).toBe(true);

    expect(result[2].depth).toBe(2);
    expect(result[2].hasChildren).toBe(false);

    expect(result[3].depth).toBe(1);
    expect(result[3].hasChildren).toBe(false);

    expect(result[4].depth).toBe(0);
    expect(result[4].hasChildren).toBe(false);
  });

  it('hides children when parent is in collapsedIds', () => {
    const collapsed = new Set(['1']);
    const result = organizeCardsHierarchy(cards, collapsed);
    // Since '1' is collapsed, '2', '3', and '4' are hidden
    expect(result.map((c) => c.id)).toEqual(['1', '5']);
    expect(result[0].isExpanded).toBe(false);
  });

  it('hides grandchildren when intermediate parent is collapsed', () => {
    const collapsed = new Set(['2']);
    const result = organizeCardsHierarchy(cards, collapsed);
    // '2' is collapsed, so '4' is hidden, but '3' (sibling of 2) remains visible
    expect(result.map((c) => c.id)).toEqual(['1', '2', '3', '5']);
    expect(result[1].isExpanded).toBe(false);
    expect(result[1].hasChildren).toBe(true);
  });
});
