// The props of a card of a ReusableList: the row, the size, what the list gives (the grip, the commands of the row, what the user may do).
import type { ReusableTableRow } from '../../table/reusable/reusableTableTypes';
import type { ReusableListItemState } from '../reusable/reusableListTypes';
import type { CardSize } from './cardSize';

export interface ReusableCardProps {
  row: ReusableTableRow;
  /** the card draws itself in `cardInnerHeight(cardSize)`; its list item is `cardItemHeight(cardSize)` high */
  cardSize: CardSize;
  /** index, grip, dragging, the commands of the row ... from the list */
  state: ReusableListItemState;
  testID?: string;
}
