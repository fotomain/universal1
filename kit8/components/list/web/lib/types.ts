import React from "react";

export interface CardItem {
  id: string;
  title: string;
  description: string;
  orderInList?: number;
  image?: string;
  rawItem?: any;
}

export interface ListWebCardsComponentProps {
  entityName?: string;
  entityForArchivationName?: string;
  crudListTitle?: string;
  crudListOwnerGUID?: string;
  crudCardHeight?: number;
  crudListWidth?: number;
  crudGapBetweenCards?: number;
  createNewCardComponent?: React.ComponentType<any> | React.ReactElement;
  CardComponent?: React.ComponentType<any> | React.ReactElement;
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
