import { CardItem } from './types';
import { calculateNewOrderInList as defaultCalculateNewOrderInList } from './calculateNewOrderInList';

export interface CopyPasteBeforeCurrentParams {
  id: string;
  cards: CardItem[];
  listOwnerGUID: string;
  actions?: any;
  dispatch?: (action: any) => void;
  calculateNewOrderInList?: (cards: CardItem[], index: number, originalCards?: CardItem[]) => number;
  uuidFn?: () => string;
}

export function copyPasteBeforeCurrent(params: CopyPasteBeforeCurrentParams) {
  const { id, cards, listOwnerGUID, actions, dispatch, calculateNewOrderInList, uuidFn } = params;
  const calcOrderFn = calculateNewOrderInList || defaultCalculateNewOrderInList;
  const targetCard = cards.find((c) => c.id === id);
  if (!targetCard) {
    return { nextCards: cards, newCard: null, newGuid: null, computedOrder: 0 };
  }

  const generateUuid = uuidFn || (() => String(Date.now()));
  const newGuid = generateUuid();
  let computedOrder = Date.now();

  const oldJson = targetCard.rawItem?.mediaPostJSON || targetCard.rawItem || {};
  const oldTitle = targetCard.title || oldJson.mediaPostTitle || oldJson.raciFirstName || 'Untitled Card';
  const newTitle = `Copy ${oldTitle}`;

  const newMediaPostJSON = {
    ...oldJson,
    mediaPostTitle: newTitle,
    ...(oldJson.raciFirstName ? { raciFirstName: `Copy ${oldJson.raciFirstName}` } : {}),
  };

  const newCard: CardItem = {
    ...targetCard,
    id: newGuid,
    title: newTitle,
    orderInList: computedOrder,
    rawItem: {
      ...targetCard.rawItem,
      mediaPostOwnerGUID: listOwnerGUID,
      mediaPostGUID: newGuid,
      orderInList: computedOrder,
      mediaPostJSON: newMediaPostJSON,
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
    if (newCard.rawItem.mediaPostJSON) {
      newCard.rawItem.mediaPostJSON.orderInList = computedOrder;
    }
  }

  if (actions?.createOne && listOwnerGUID && dispatch) {
    dispatch(actions.createOne({
      mediaPostOwnerGUID: listOwnerGUID,
      mediaPostGUID: newGuid,
      orderInList: computedOrder,
      mediaPostJSON: newMediaPostJSON,
    }));
  }

  return { nextCards, newCard, newGuid, computedOrder };
}

export default copyPasteBeforeCurrent;
