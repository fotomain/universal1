import { CardItem } from './types';
import { calculateNewOrderInList as defaultCalculateNewOrderInList } from './calculateNewOrderInList';

export interface CreateAfterCurrentParams {
  id: string;
  cards: CardItem[];
  entityName?: string;
  listOwnerGUID: string;
  actions?: any;
  dispatch?: (action: any) => void;
  calculateNewOrderInList?: (cards: CardItem[], index: number, originalCards?: CardItem[]) => number;
  uuidFn?: () => string;
}

export function createAfterCurrent(params: CreateAfterCurrentParams) {
  const { id, cards, entityName, listOwnerGUID, actions, dispatch, calculateNewOrderInList, uuidFn } = params;
  const calcOrderFn = calculateNewOrderInList || defaultCalculateNewOrderInList;
  const generateUuid = uuidFn || (() => String(Date.now()));
  const newGuid = generateUuid();
  const isRaciEntity = String(entityName || '').toLowerCase().includes('raci');
  const defaultTitle = isRaciEntity ? 'New Member' : 'New Card';

  let computedOrder = Date.now();
  const newCard: CardItem = {
    id: newGuid,
    title: defaultTitle,
    description: '',
    orderInList: computedOrder,
    rawItem: {
      mediaPostOwnerGUID: listOwnerGUID,
      mediaPostGUID: newGuid,
      orderInList: computedOrder,
      mediaPostJSON: {
        mediaPostTitle: defaultTitle,
        mediaPostDescription: '',
        ...(isRaciEntity ? { raciFirstName: 'New', raciLastName: 'Member', raciEmail: '' } : {}),
      },
    },
  };

  const idx = cards.findIndex((c) => c.id === id);
  const insertAt = idx === -1 ? cards.length : idx + 1;
  const nextCards = [...cards];
  nextCards.splice(insertAt, 0, newCard);

  computedOrder = calcOrderFn(nextCards, insertAt, cards);
  newCard.orderInList = computedOrder;
  if (newCard.rawItem) {
    newCard.rawItem.orderInList = computedOrder;
    if (newCard.rawItem.mediaPostJSON) {
      newCard.rawItem.mediaPostJSON.orderInList = computedOrder;
    }
  }

  if (actions?.createOne && listOwnerGUID && dispatch) {
    dispatch(actions.createOne({
      mediaPostOwnerGUID: listOwnerGUID,
      mediaPostGUID: newGuid,
      orderInList: computedOrder,
      mediaPostJSON: newCard.rawItem.mediaPostJSON,
    }));
  }

  return { nextCards, newCard, newGuid, computedOrder };
}

export default createAfterCurrent;
