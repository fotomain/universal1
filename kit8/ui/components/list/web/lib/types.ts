import React from "react";

export interface CardItem {
  id: string;
  title: string;
  description: string;
  orderInList?: number;
  rawItem?: any;
  /** Hierarchy: parent card id (or rowParentGUID) */
  parentId?: string | null;
  /** Hierarchy: nest level (0 = root, 1 = child, 2 = grandchild, etc.) */
  depth?: number;
  /** Hierarchy: whether this card has children in the current tree */
  hasChildren?: boolean;
  /** Hierarchy: whether children of this card are currently expanded */
  isExpanded?: boolean;
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
  mapItemToCard?: (item: any, index: number, rows?: any[]) => CardItem;
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
  /** false: fixed order (e.g. rates by date) - no drag & drop, move up / down, make first / last */
  reorderEnabled?: boolean;
  /** Enable hierarchical tree display of cards based on parentId / rowParentGUID */
  hierarchyEnabled?: boolean;
  /** Callback to add a child under a specific card */
  onCreateChildItem?: (parentCardId: string, parentRawItem?: any) => void;
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
