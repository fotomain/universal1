import React from "react";

export interface CardItem {
  id: string;
  title: string;
  description: string;
  orderInList?: number;
  rawItem?: any;
}

export interface ListWebCardsComponentProps {
  entityName?: string;
  entityForArchivationName?: string;
  crudListTitle?: string;
  listOwnerGUID?: string;
  crudCardHeight?: number;
  crudListWidth?: number;
  crudGapBetweenCards?: number;
  createNewCardComponent?: React.ComponentType<any> | React.ReactElement;
  CardComponent?: React.ComponentType<any> | React.ReactElement;
  /** server row -> card (default: media post title / description) */
  mapItemToCard?: (item: any, index: number) => CardItem;
  /** "+" in the top bar: e.g. navigate to an edit screen (default: the built-in create form) */
  onCreateNewItem?: () => void;
  /** card "edit": e.g. navigate to an edit screen (default: toggle inline edit) */
  onEditCard?: (id: string, rawItem?: any) => void;
  /** keep the list in sync with Supabase Realtime (other browsers / devices) - redux-saga channel */
  realtime?: boolean;
  /** extra readData payload (merged into the default first page) */
  readParams?: Record<string, any>;
  /** "Post", "Currency", ... in user messages */
  itemLabel?: string;
}

export interface CardThreeDotsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onMenuOpenStateChange?: (isOpen: boolean) => void;
  primaryColor?: string;
}

export interface CardIconsBottomComponentProps {
  onArchive: () => void;
  onDelete: () => void;
  onMakeFirst?: () => void;
  onMakeLast?: () => void;
  dragHandleProps?: any;
  primaryColor?: string;
}

export interface CardSwipeUnderlayLeftComponentProps {
  currentIListtem: any;
  onArchive?: (item: any) => void;
  primaryLightColor?: string;
  primaryColor?: string;
  dragVertical?: boolean;
  dragHorizontal?: boolean;
}

export interface CardSwipeUnderlayRightComponentProps {
  currentIListtem: any;
  onDelete?: (item: any) => void;
  primaryLightColor?: string;
  primaryColor?: string;
  dragVertical?: boolean;
  dragHorizontal?: boolean;
}

export interface SwipeableCardProps {
  children: React.ReactNode;
  swipeLeftToRightPercent?: number;
  swipeRightToLeftPercent?: number;
  forceSwipeToLeftPercent?: number;
  forceSwipeToRightPercent?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onForceSwipeFromRightToLeft?: () => void;
  onForceSwipeFromLeftToRight?: () => void;
  crudCardSwipeUnderlayLeft?: React.ReactNode;
  crudCardSwipeUnderlayRight?: React.ReactNode;
}
