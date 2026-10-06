import { CardItem } from './types';
import { calculateNewOrderInList as defaultCalculateNewOrderInList } from './calculateNewOrderInList';

export interface CreateBeforeCurrentParams {
  id: string;
  cards: CardItem[];
  entityName?: string;
  listOwnerGUID: string | undefined;
  actions?: any;
  dispatch?: (action: any) => void;
  calculateNewOrderInList?: (cards: CardItem[], index: number, originalCards?: CardItem[]) => number;
  uuidFn?: () => string;
}

export function createBeforeCurrent(params: CreateBeforeCurrentParams) {
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
      rowOwnerGUID: listOwnerGUID,
        rowParentGUID: 'empty',
      rowGUID: newGuid,
      orderInList: computedOrder,
      rowJSON: {
        mediaPostTitle: defaultTitle,
        mediaPostDescription: '',
        ...(isRaciEntity ? { raciFirstName: 'New', raciLastName: 'Member', raciEmail: '' } : {}),
      },
    },
  };

  const idx = cards.findIndex((c) => c.id === id);
  const insertAt = idx === -1 ? 0 : idx;
  const nextCards = [...cards];
  nextCards.splice(insertAt, 0, newCard);

  computedOrder = calcOrderFn(nextCards, insertAt, cards);
  newCard.orderInList = computedOrder;
  if (newCard.rawItem) {
    newCard.rawItem.orderInList = computedOrder;
    if (newCard.rawItem.rowJSON) {
      newCard.rawItem.rowJSON.orderInList = computedOrder;
    }
  }

  if (actions?.createOne && listOwnerGUID && dispatch) {
    dispatch(actions.createOne({
      rowOwnerGUID: listOwnerGUID,
      rowParentGUID: 'empty',
      rowGUID: newGuid,
      orderInList: computedOrder,
      rowJSON: newCard.rawItem.rowJSON,
    }));
  }

  return { nextCards, newCard, newGuid, computedOrder };
}

export default createBeforeCurrent;
