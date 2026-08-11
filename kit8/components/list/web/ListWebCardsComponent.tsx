import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, Text, useTheme } from "react-native-paper";
import * as Crypto from "expo-crypto";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  CardItem,
  ListWebCardsComponentProps,
  CardThreeDotsMenu,
  CardIconsBottomComponent,
  CardSwipeUnderlayLeftComponent,
  CardSwipeUnderlayRightComponent,
  SwipeableCard,
  ListWebTopBarComponent,
} from "./lib";
import { CardBasicVersion } from "./cards";
import { CreateNewCardBasicForm } from "../forms";
import { SystemMetaData } from "../../../redux/SystemMetaData";
import { DATA_ORIGIN_TYPE, DataOriginType } from "../../../types/origin";
import { DATA_MANIPULATION_TYPE, DataManipulationType } from "../../../types/manipulation";
import TexInputMi from "../../../ui/TexInputMi";
import ButtonMi from "../../../ui/ButtonMi";
import H1Mi from "../../../ui/H1Mi";
import IconApp from "../../../../components/common/IconApp";

const _testMode=false

const uuid = Crypto.randomUUID;

const testCardsMode = false

const INITIAL_CARDS: CardItem[] = Array.from({ length: 10 }, (_, i) => ({
  id: `card-${i + 1}`,
  title: `Media Post Title ${i + 1}`,
  description: `Detailed description for post card #${i + 1}`,
}));

const getBusinessMotto = (pct: number): string => {
  if (pct === 0) return "💼 Initializing Q4 Synergy Protocols... Scroll for Profit!";
  if (pct < 25) return "📈 Leveraging Core Competencies! (+15% Productivity)";
  if (pct < 50) return "🚀 Circle Back & Touch Base! Actionable Content Detected!";
  if (pct < 75) return "🔥 Paradigms Shifted! Maximizing Stakeholder Engagement!";
  if (pct < 100) return "🎯 Closing the Loop! Final Deliverables in Sight!";
  return "🎉 100% PROFITABILITY REACHED! Take a Coffee Break! ☕";
};

export function ListWebCardsComponent({
  entityName = "mediaPostReusable",
  entityForArchivationName = "mediaPostArchive",
  crudListTitle = "Tasks",
  listOwnerGUID,
  crudCardHeight = 150,
  crudListWidth = 350,
  crudGapBetweenCards = 12,
  createNewCardComponent: CustomCreateForm,
  CardComponent: CustomCardComponent,
}: ListWebCardsComponentProps) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // MD3 Colors
  const primaryColor = theme.colors.primary || "#6200ee";
  const primaryLightColor = theme.colors.primaryContainer || "#eaddff";

  const entityState = useSelector((state: any) => state[entityName]);
  const entityMetaData = SystemMetaData[entityName];
  const actions = entityMetaData?.actions;

  const archiveMetaData = SystemMetaData[entityForArchivationName];
  const archiveActions = archiveMetaData?.actions;

  const CardItemComponent = CustomCardComponent || CardBasicVersion;
  const CreateCardComponent = CustomCreateForm || CreateNewCardBasicForm;

  const [cards, setCards] = useState<CardItem[]>(testCardsMode?INITIAL_CARDS:[]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);
  const [lastInteractedCardId, setLastInteractedCardId] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

  // Business Funny Scroll state inside component
  const [scrollPercent, setScrollPercent] = useState(0);

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const totalScroll = target.scrollHeight - target.clientHeight;
    if (totalScroll > 0) {
      const current = Math.min(100, Math.max(0, Math.round((target.scrollTop / totalScroll) * 100)));
      setScrollPercent(current);
    }
  };

  // Create Form States
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [originUrl, setOriginUrl] = useState("");
  const [dataOriginName, setDataOriginName] = useState<DataOriginType>(DATA_ORIGIN_TYPE.youtube);
  const [dataManipulationName, setDataManipulationName] = useState<DataManipulationType>(DATA_MANIPULATION_TYPE.YOUTUBE_TO_GOOGLE_DRIVE);

  const renderCardItem = (card: CardItem, isSelected: boolean, isDragging: boolean, dragHandleProps: any) => {
    const handleCardTouch = (id: string) => {
      setLastInteractedCardId(id);
    };

    if (React.isValidElement(CardItemComponent)) {
      return React.cloneElement(CardItemComponent as React.ReactElement<any>, {
        card,
        isSelected,
        isDragging,
        primaryColor,
        onFieldChange: (id: string, field: "title" | "description", val: string) => {
          handleCardTouch(id);
          handleFieldChange(id, field, val);
        },
        onArchive: (id: string) => {
          handleCardTouch(id);
          handleArchive(id);
        },
        onDelete: (id: string) => {
          handleCardTouch(id);
          handleDelete(id);
        },
        onShare: (id: string) => {
          handleCardTouch(id);
          handleShare(id);
        },
        onEdit: (id: string) => {
          handleCardTouch(id);
          setEditingCardId(editingCardId === id ? null : id);
        },
        onMakeFirst: (id: string) => {
          handleCardTouch(id);
          handleMakeFirst(id);
        },
        onMakeLast: (id: string) => {
          handleCardTouch(id);
          handleMakeLast(id);
        },
        onMenuOpenStateChange: (isOpen: boolean) => {
          if (isOpen) handleCardTouch(card.id);
          setOpenMenuCardId(isOpen ? card.id : null);
        },
        dragHandleProps,
        crudCardHeight,
      });
    }

    return React.createElement(CardItemComponent as React.ComponentType<any>, {
      testID: "cardBasic",
      card,
      isSelected,
      isDragging,
      primaryColor,
      onFieldChange: (id: string, field: "title" | "description", val: string) => {
        handleCardTouch(id);
        handleFieldChange(id, field, val);
      },
      onArchive: (id: string) => {
        handleCardTouch(id);
        handleArchive(id);
      },
      onDelete: (id: string) => {
        handleCardTouch(id);
        handleDelete(id);
      },
      onShare: (id: string) => {
        handleCardTouch(id);
        handleShare(id);
      },
      onEdit: (id: string) => {
        handleCardTouch(id);
        setEditingCardId(editingCardId === id ? null : id);
      },
      onMakeFirst: (id: string) => {
        handleCardTouch(id);
        handleMakeFirst(id);
      },
      onMakeLast: (id: string) => {
        handleCardTouch(id);
        handleMakeLast(id);
      },
      onMenuOpenStateChange: (isOpen: boolean) => {
        if (isOpen) handleCardTouch(card.id);
        setOpenMenuCardId(isOpen ? card.id : null);
      },
      dragHandleProps,
      crudCardHeight,
    });
  };

  // Scroll Helpers & 50% Screen Height Visibility Checker
  const scrollListContainerToTopOfTheScreen = () => {
    if (scrollContainerRef.current && typeof window !== "undefined") {
      scrollContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const checkVisibilityAndScrollToTopScreen = () => {
    if (scrollContainerRef.current && typeof window !== "undefined") {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(windowHeight, rect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      // If the list is visible less than 50% of the screen height
      if (visibleHeight < windowHeight * 0.5) {
        scrollListContainerToTopOfTheScreen();
      }
    }
  };

  const handleScrollTop = () => {
    checkVisibilityAndScrollToTopScreen();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handleScrollBottom = () => {
    checkVisibilityAndScrollToTopScreen();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  const handleScrollToCurrent = () => {
    if (lastInteractedCardId && typeof document !== "undefined") {
      const cardElement = document.getElementById(`card-container-${lastInteractedCardId}`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const handleCreateNewItem = () => {
    setIsCreateFormOpen(true);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // Read ONCE on mount using listOwnerGUID as mediaPostOwnerGUID
  useEffect(() => {
    if (actions?.readData && listOwnerGUID) {
      dispatch(actions.readData({
        paginationSize: 50,
        originationCurrentPage: 0,
        readAllFilter: "",
        mediaPostOwnerGUID: listOwnerGUID,
      }));
    }
  }, [actions, entityName, listOwnerGUID, dispatch]);

  // Sync Redux entity data to local cards list when server data loads
  useEffect(() => {
    if (entityState?.entityDataFromServer && entityState.entityDataFromServer.length > 0) {
      const mapped = entityState.entityDataFromServer.map((item: any, idx: number) => {
        const json = item?.mediaPostJSON || {};
        return {
          id: item?.mediaPostGUID || `card-${idx + 1}`,
          title: json.mediaPostTitle || item?.title || `Media Post ${idx + 1}`,
          description: json.mediaPostDescription || item?.description || "",
          orderInList: item?.orderInList,
          rawItem: item,
        };
      });
      setCards(mapped);
    }
  }, [entityState?.entityDataFromServer]);

    // Helper to calculate new order for an item
    const calculateNewOrderInList = (currentCards: CardItem[], destIndex: number): number => {
      // Use the original unmutated 'cards' state to determine the sorting direction,
      // otherwise the recently spliced item throws off the edge detection.
      const isDesc = cards.length >= 2 
        ? (cards[0].orderInList || 0) >= (cards[cards.length - 1].orderInList || 0) 
        : true;
      
      const itemBefore = destIndex > 0 ? currentCards[destIndex - 1] : undefined;
      const itemAfter = destIndex < currentCards.length - 1 ? currentCards[destIndex + 1] : undefined;
      
      const beforeOrder = itemBefore?.orderInList;
      const afterOrder = itemAfter?.orderInList;
      if (_testMode) {
        console.log("calculateNewOrderInList0 beforeOrder", beforeOrder)
        console.log("calculateNewOrderInList0 afterOrder", afterOrder)
      }
      if (beforeOrder !== undefined && afterOrder !== undefined) {
        const result = (beforeOrder + afterOrder) / 2;
        if (_testMode) {
          console.log("calculateNewOrderInList0 ", result);
        }
        return result;
      }
      
      const GAP = 100000;
      
      if (beforeOrder === undefined && afterOrder !== undefined) {
        return isDesc ? afterOrder + GAP : afterOrder - GAP;
      }
      
      if (afterOrder === undefined && beforeOrder !== undefined) {
        return isDesc ? beforeOrder - GAP : beforeOrder + GAP;
      }
      
      return Date.now();
    };

    const dispatchOrderUpdate = (id: string, newOrder: number) => {
      if (actions?.updateOne && listOwnerGUID) {
        dispatch(actions.updateOne({
          mediaPostGUID: id,
          mediaPostOwnerGUID: listOwnerGUID,
          field: "orderInList",
          value: newOrder,
        }));
      }
    };

    // Drag and drop reordering handler
    const onDragEnd = (result: DropResult) => {
      if (!result.destination) return;
      const items = Array.from(cards);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      
      const newOrder = calculateNewOrderInList(items, result.destination.index);
      reorderedItem.orderInList = newOrder;
      
      setCards(items);
      dispatchOrderUpdate(reorderedItem.id, newOrder);
    };

  // Return native draggableStyle directly to ensure exact 1-to-1 mouse cursor alignment
  const getVerticalDraggableStyle = (draggableStyle: any, isDragging: boolean) => {
    if (!isDragging || !draggableStyle) {
      return draggableStyle;
    }
    return draggableStyle;
  };

  // Field change handler (Update Title or Description) with listOwnerGUID
  const handleFieldChange = (id: string, field: "title" | "description", value: string) => {
    setCards((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );

    if (actions?.updateOne && listOwnerGUID) {
      const sagaField = field === "title" ? "mediaPostTitle" : "mediaPostDescription";
      dispatch(actions.updateOne({
        mediaPostGUID: id,
        mediaPostOwnerGUID: listOwnerGUID,
        field: sagaField,
        value: value,
      }));
    }
  };

  // Move Card Up
  const handleMoveUp = (index: number) => {
    if (index <= 0) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      return;
    }
    const newCards = Array.from(cards);
    const [movedItem] = newCards.splice(index, 1);
    newCards.splice(index - 1, 0, movedItem);

    const newOrder = calculateNewOrderInList(newCards, index - 1);
    movedItem.orderInList = newOrder;

    setCards(newCards);
    dispatchOrderUpdate(movedItem.id, newOrder);

    if (index - 1 === 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // Move Card Down
  const handleMoveDown = (index: number) => {
    if (index >= cards.length - 1) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
      return;
    }
    const newCards = Array.from(cards);
    const [movedItem] = newCards.splice(index, 1);
    newCards.splice(index + 1, 0, movedItem);

    const newOrder = calculateNewOrderInList(newCards, index + 1);
    movedItem.orderInList = newOrder;

    setCards(newCards);
    dispatchOrderUpdate(movedItem.id, newOrder);

    if (index + 1 === cards.length - 1 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  // Create post as first item (+ New 1st) with listOwnerGUID
  const handleCreateFirst = (
    originParam?: DataOriginType,
    manipulationParam?: DataManipulationType,
    originUrlParam?: string,
    customJson?: any
  ) => {
    if (!newTitle.trim() && !newDescription.trim() && !customJson) return;

    const originToUse = originParam || dataOriginName;
    const manipulationToUse = manipulationParam || dataManipulationName;
    const urlToUse = originUrlParam !== undefined ? originUrlParam : originUrl;

    const newGuid = uuid();
    const newCard: CardItem = {
      id: newGuid,
      title: newTitle.trim() || "Untitled Post",
      description: newDescription.trim() || "",
      rawItem: {
        mediaPostOwnerGUID: listOwnerGUID,
        mediaPostGUID: newGuid,
        orderInList: Date.now(),
        mediaPostJSON: {
          mediaPostTitle: newTitle.trim() || "Untitled Post",
          mediaPostDescription: newDescription.trim() || "",
          mediaPostOrigin: urlToUse,
          mediaPostMIME: "youtube",
          mediaPostOriginType: "url",
          dataOriginName: originToUse,
          dataManipulationName: manipulationToUse,
          ...(customJson || {}),
        },
      },
    };

    setCards((prev) => [newCard, ...prev]);

    if (actions?.createOne && listOwnerGUID) {
      dispatch(actions.createOne({
        mediaPostOwnerGUID: listOwnerGUID,
        mediaPostGUID: newGuid,
        orderInList: Date.now(),
        mediaPostJSON: {
          mediaPostTitle: newCard.title,
          mediaPostDescription: newCard.description,
          mediaPostOrigin: urlToUse,
          mediaPostMIME: "youtube",
          mediaPostOriginType: "url",
          dataOriginName: originToUse,
          dataManipulationName: manipulationToUse,
          ...(customJson || {}),
        },
      }));
    }

    setNewTitle("");
    setNewDescription("");
    setOriginUrl("");
    setIsCreateFormOpen(false);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }, 100);
  };

  // Create post as last item (+ New last) with listOwnerGUID
  const handleCreateLast = (
    originParam?: DataOriginType,
    manipulationParam?: DataManipulationType,
    originUrlParam?: string,
    customJson?: any
  ) => {
    if (!newTitle.trim() && !newDescription.trim() && !customJson) return;

    const originToUse = originParam || dataOriginName;
    const manipulationToUse = manipulationParam || dataManipulationName;
    const urlToUse = originUrlParam !== undefined ? originUrlParam : originUrl;

    const newGuid = uuid();
    const newCard: CardItem = {
      id: newGuid,
      title: newTitle.trim() || "Untitled Post",
      description: newDescription.trim() || "",
      rawItem: {
        mediaPostOwnerGUID: listOwnerGUID,
        mediaPostGUID: newGuid,
        orderInList: Date.now(),
        mediaPostJSON: {
          mediaPostTitle: newTitle.trim() || "Untitled Post",
          mediaPostDescription: newDescription.trim() || "",
          mediaPostOrigin: urlToUse,
          mediaPostMIME: "youtube",
          mediaPostOriginType: "url",
          dataOriginName: originToUse,
          dataManipulationName: manipulationToUse,
          ...(customJson || {}),
        },
      },
    };

    setCards((prev) => [...prev, newCard]);

    if (actions?.createOne && listOwnerGUID) {
      dispatch(actions.createOne({
        mediaPostOwnerGUID: listOwnerGUID,
        mediaPostGUID: newGuid,
        orderInList: Date.now(),
        mediaPostJSON: {
          mediaPostTitle: newCard.title,
          mediaPostDescription: newCard.description,
          mediaPostOrigin: urlToUse,
          mediaPostMIME: "youtube",
          mediaPostOriginType: "url",
          dataOriginName: originToUse,
          dataManipulationName: manipulationToUse,
          ...(customJson || {}),
        },
      }));
    }

    setNewTitle("");
    setNewDescription("");
    setOriginUrl("");
    setIsCreateFormOpen(false);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // Archive item handler: adds current post into entityForArchivationName & deletes current post from entityName
  const handleArchive = (id: string) => {
    const targetCard = cards.find((item) => item.id === id);

    setCards((prev) => prev.filter((item) => item.id !== id));

    if (targetCard && listOwnerGUID) {
      // 1. Add current post into entityForArchivationName (mediaPostArchive)
      if (archiveActions?.createOne) {
        const itemToArchive = targetCard.rawItem
          ? { ...targetCard.rawItem, mediaPostOwnerGUID: listOwnerGUID }
          : {
              mediaPostGUID: targetCard.id,
              mediaPostOwnerGUID: listOwnerGUID,
              orderInList: Date.now(),
              mediaPostJSON: {
                mediaPostTitle: targetCard.title,
                mediaPostDescription: targetCard.description,
                mediaPostMIME: "youtube",
                mediaPostOriginType: "url",
              },
            };
        dispatch(archiveActions.createOne(itemToArchive));
      }

      // 2. Delete current post from entityName (mediaPostReusable)
      if (actions?.deleteOne) {
        dispatch(
          actions.deleteOne({
            mediaPostGUID: id,
            mediaPostOwnerGUID: listOwnerGUID,
          })
        );
      }
    }
    console.log(`Archived item ${id} to ${entityForArchivationName} and deleted from ${entityName}`);
  };

  // Delete item handler with listOwnerGUID
  const handleDelete = (id: string) => {
    setCards((prev) => prev.filter((item) => item.id !== id));
    if (actions?.deleteOne && listOwnerGUID) {
      dispatch(actions.deleteOne({
        mediaPostGUID: id,
        mediaPostOwnerGUID: listOwnerGUID,
      }));
    }
    console.log(`Deleted item: ${id}`);
  };

  // Archive Selected Cards
  const handleArchiveSelected = () => {
    if (selectedIds.length === 0) return;
    setCards((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    console.log("Archived selected cards:", selectedIds);
    setSelectedIds([]);
  };

  // Delete Selected Cards with listOwnerGUID
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setCards((prev) => prev.filter((item) => !selectedIds.includes(item.id)));

    if (actions?.deleteOne && listOwnerGUID) {
      selectedIds.forEach((id) => {
        dispatch(actions.deleteOne({
          mediaPostGUID: id,
          mediaPostOwnerGUID: listOwnerGUID,
        }));
      });
    }

    setSelectedIds([]);
  };

  // Share Card Handler
  const handleShare = (id: string) => {
    console.log(`Sharing card: ${id}`);
  };

  // Move Card to Top
  const handleMakeFirst = (id: string) => {
    const index = cards.findIndex((item) => item.id === id);
    if (index <= 0) return;
    const items = [...cards];
    const [item] = items.splice(index, 1);
    items.unshift(item);
    
    const newOrder = calculateNewOrderInList(items, 0);
    item.orderInList = newOrder;
    
    setCards(items);
    dispatchOrderUpdate(item.id, newOrder);
  };

  // Move Card to Bottom
  const handleMakeLast = (id: string) => {
    const index = cards.findIndex((item) => item.id === id);
    if (index === -1 || index === cards.length - 1) return;
    const items = [...cards];
    const [item] = items.splice(index, 1);
    items.push(item);
    
    const newOrder = calculateNewOrderInList(items, items.length - 1);
    item.orderInList = newOrder;
    
    setCards(items);
    dispatchOrderUpdate(item.id, newOrder);
  };

  // Select All Toggle
  const isAllSelected = cards.length > 0 && selectedIds.length === cards.length;
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cards.map((c) => c.id));
    }
  };

  // Empty State if no listOwnerGUID is provided
  if (!listOwnerGUID) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
        <Card style={{ width: '100%', maxWidth: 400, padding: 24, alignItems: "center", backgroundColor: theme.dark ? (theme.colors.surfaceVariant || "#252538") : "#ffffff" }}>
          <View style={{ alignItems: "center", width: "100%", justifyContent: "center", paddingBottom: 16 }}>
             <MaterialCommunityIcons name="account-search-outline" size={64} color={primaryColor} style={{ marginBottom: 16 }} />
             <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.dark ? "#8892B0" : theme.colors.onSurface, marginBottom: 8 }}>
               Awaiting active user / listOwnerGUID...
             </Text>
             <Text style={{ fontSize: 14, color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
               Please select a user from the list to view their {crudListTitle?.toLowerCase()}.
             </Text>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.container, { maxWidth: crudListWidth, width: "100%" }]}
      keyboardShouldPersistTaps="handled"
    >
      {/*<View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 8 }}>*/}
      {/*  <Text style={{ fontSize: 12, fontWeight: "normal", color: theme.colors.onSurfaceVariant || "#666666" }}>*/}
      {/*    Reorder & Swipe Cards*/}
      {/*  </Text>*/}
      {/*  <Text style={{ fontSize: 14, fontWeight: "normal", color: theme.colors.onSurface }}>*/}
      {/*    {entityName}*/}
      {/*  </Text>*/}
      {/*</View>*/}

      {/* Create New Card Form (open via createNewItem top bar icon) */}
      {isCreateFormOpen && (
        React.isValidElement(CreateCardComponent)
        ? React.cloneElement(CreateCardComponent as React.ReactElement<any>, {
            newTitle,
            onChangeTitle: setNewTitle,
            newDescription,
            onChangeDescription: setNewDescription,
            originUrl,
            onChangeOriginUrl: setOriginUrl,
            dataOriginName,
            onChangeDataOriginName: setDataOriginName,
            dataManipulationName,
            onChangeDataManipulationName: setDataManipulationName,
            onCreateFirst: handleCreateFirst,
            onCreateLast: handleCreateLast,
            onClose: () => setIsCreateFormOpen(false),
            primaryColor,
            createErrorData: entityState?.createErrorData,
          })
        : React.createElement(CreateCardComponent as React.ComponentType<any>, {
            newTitle,
            onChangeTitle: setNewTitle,
            newDescription,
            onChangeDescription: setNewDescription,
            originUrl,
            onChangeOriginUrl: setOriginUrl,
            dataOriginName,
            onChangeDataOriginName: setDataOriginName,
            dataManipulationName,
            onChangeDataManipulationName: setDataManipulationName,
            onCreateFirst: handleCreateFirst,
            onCreateLast: handleCreateLast,
            onClose: () => setIsCreateFormOpen(false),
            primaryColor,
            createErrorData: entityState?.createErrorData,
          })
      )}

      {/* ListWebTopBarComponent at top of crudListTitle container */}
      <ListWebTopBarComponent
        onCreateNewItem={handleCreateNewItem}
        onScrollToCurrent={handleScrollToCurrent}
        onScrollTop={handleScrollTop}
        onScrollBottom={handleScrollBottom}
        isScrollToCurrentEnabled={Boolean(lastInteractedCardId)}
        currentCardTitle={cards.find((c) => c.id === lastInteractedCardId)?.title || ""}
        primaryColor={primaryColor}
      />

      {/* Header Controls Row: Select All Checkbox aligned with Card Checkboxes */}
      <View style={styles.controlsRow}>
        <View style={styles.selectAllRow}>
          {/* Spacer matching 20% thinner left control column for exact vertical alignment */}
          <View style={{ width: 14.5 }} />

          {/* Round Header Checkbox using IconApp */}
          <div title="Select All Cards">
            <IconApp
              testID="f0a1b2c3-d4e5-6789-0abc-123456789def"
              name={isAllSelected ? "check" : selectedIds.length > 0 ? "minus" : "check"}
              size={16}
              color={
                isAllSelected || selectedIds.length > 0
                  ? theme.colors.onPrimary
                  : "transparent"
              }
              onPress={handleSelectAll}
              style={[
                styles.roundCheckbox,
                isAllSelected || selectedIds.length > 0
                  ? { backgroundColor: primaryColor, borderColor: primaryColor }
                  : { borderColor: primaryColor, backgroundColor: "transparent" },
              ]}
            />
          </div>

          {/* 12px Distance / Gap */}
          <View style={{ width: 12 }} />

          {/* CRUD List Title Label */}
          <Text testID={'crudListTitle'} style={{ fontSize: 24, fontWeight: "normal", color: theme.dark ? "#8892B0" : theme.colors.onSurface }}>
            {crudListTitle}
          </Text>

          {/* Icon Buttons for Archive Selected & Delete Selected with (N) count */}
          {selectedIds.length > 0 && (
            <View style={{ flexDirection: "row", gap: 14, marginLeft: "auto", alignItems: "center" }}>
              {/* Archive Selected Icon with (N) count */}
              <div title={`Archive (${selectedIds.length}) selected cards`} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                <TouchableOpacity activeOpacity={0.7} onPress={handleArchiveSelected} style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 4 }}>
                  <MaterialCommunityIcons name="archive-outline" size={24} color="#f57f17" />
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#f57f17", fontFamily: "Roboto, sans-serif" }}>
                    ({selectedIds.length})
                  </span>
                </TouchableOpacity>
              </div>

              {/* Delete Selected Icon with (N) count */}
              <div title={`Delete (${selectedIds.length}) selected cards`} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                <TouchableOpacity activeOpacity={0.7} onPress={handleDeleteSelected} style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 4 }}>
                  <MaterialCommunityIcons name="delete-outline" size={24} color="#d32f2f" />
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#d32f2f", fontFamily: "Roboto, sans-serif" }}>
                    ({selectedIds.length})
                  </span>
                </TouchableOpacity>
              </div>
            </View>
          )}
        </View>
      </View>

      {/* Vertical Drag Drop List */}
      {/* Business Funny Scroll-O-Meter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          marginBottom: '8px',
          borderRadius: '10px',
          backgroundColor: theme.dark ? '#1e1b4b' : '#eef2ff',
          border: `1.5px dashed ${theme.dark ? '#6366f1' : '#818cf8'}`,
          fontFamily: 'system-ui, sans-serif',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>💼</span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: '700',
              color: theme.dark ? '#c7d2fe' : '#3730a3',
              letterSpacing: '0.3px',
            }}
          >
            {getBusinessMotto(scrollPercent)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '80px',
              height: '8px',
              backgroundColor: theme.dark ? '#312e81' : '#c7d2fe',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${scrollPercent}%`,
                height: '100%',
                backgroundColor: scrollPercent === 100 ? '#10b981' : '#6366f1',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '800',
              color: scrollPercent === 100 ? '#10b981' : primaryColor,
              minWidth: '36px',
              textAlign: 'right',
            }}
          >
            {scrollPercent}%
          </span>
        </div>
      </div>

      <style>{`
        .funny-scrollbar::-webkit-scrollbar {
          width: 22px;
        }
        .funny-scrollbar::-webkit-scrollbar-track {
          background: ${theme.dark ? "#111827" : "#f0f4ff"};
          border-radius: 12px;
          border: 3px solid ${theme.dark ? "#1f2937" : "#ffffff"};
          background-image: repeating-linear-gradient(
            -45deg,
            ${theme.dark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.12)"} 0px,
            ${theme.dark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.12)"} 10px,
            transparent 10px,
            transparent 20px
          );
        }
        .funny-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, 
            #4f46e5 0%, 
            #818cf8 25%, 
            #f59e0b 50%, 
            #10b981 75%, 
            #4f46e5 100%
          );
          border-radius: 12px;
          border: 3px solid ${theme.dark ? "#1f2937" : "#ffffff"};
          box-shadow: inset 0 0 6px rgba(255,255,255,0.4), 0 2px 8px rgba(99,102,241,0.4);
          min-height: 70px;
          cursor: grab;
        }
        .funny-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, 
            #4338ca 0%, 
            #6366f1 25%, 
            #d97706 50%, 
            #059669 75%, 
            #4338ca 100%
          );
          box-shadow: inset 0 0 8px rgba(255,255,255,0.6), 0 0 14px rgba(99,102,241,0.7);
          cursor: grab;
        }
        .funny-scrollbar::-webkit-scrollbar-thumb:active {
          background: linear-gradient(180deg,
            #3730a3 0%,
            #4f46e5 50%,
            #3730a3 100%
          );
          cursor: grabbing;
        }
      `}</style>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable
          droppableId="cardsList"
          renderClone={(provided, snapshot, rubric) => {
            const card = cards[rubric.source.index];
            const isSelected = selectedIds.includes(card.id);

            return (
              <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                style={{
                  ...getVerticalDraggableStyle(provided.draggableProps.style, snapshot.isDragging),
                  marginBottom: `${crudGapBetweenCards}px`,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  userSelect: "none",
                  zIndex: 99999,
                }}
              >
                <View style={styles.leftControlColumn}>
                  <div style={{ cursor: "pointer", padding: "2px" }}>
                    <MaterialCommunityIcons name="chevron-up" size={24} color={primaryColor} />
                  </div>
                  <div style={{ margin: "2px 0" }}>
                    <IconApp
                      testID={`card-check-clone-${card.id}`}
                      name="check"
                      size={16}
                      color={isSelected ? theme.colors.onPrimary : "transparent"}
                      style={[
                        styles.roundCheckbox,
                        isSelected
                          ? { backgroundColor: primaryColor, borderColor: primaryColor }
                          : { borderColor: primaryColor, backgroundColor: "transparent" },
                      ]}
                    />
                  </div>
                  <div style={{ cursor: "pointer", padding: "2px" }}>
                    <MaterialCommunityIcons name="chevron-down" size={24} color={primaryColor} />
                  </div>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  {renderCardItem(card, isSelected, true, provided.dragHandleProps)}
                </View>
              </div>
            );
          }}
        >
          {(provided) => (
            <div
              className="funny-scrollbar"
              onScroll={handleContainerScroll}
              {...provided.droppableProps}
              ref={(el) => {
                provided.innerRef(el);
                scrollContainerRef.current = el;
              }}
              style={{
                height: "600px",
                overflowY: "auto",
                border: theme.dark ? "1px solid #444466" : "1px solid #c5b8e0",
                borderRadius: "8px",
                padding: "12px",
                backgroundColor: theme.dark ? (theme.colors.surfaceVariant || "#252538") : primaryLightColor,
                boxSizing: "border-box",
              }}
            >
              {cards.map((card, index) => {
                const isSelected = selectedIds.includes(card.id);

                return (
                  <Draggable key={card.id} draggableId={card.id} index={index}>
                    {(draggableProvided, snapshot) => (
                      <div
                        id={`card-container-${card.id}`}
                        ref={draggableProvided.innerRef}
                        {...draggableProvided.draggableProps}
                        onClick={() => setLastInteractedCardId(card.id)}
                        style={{
                          marginBottom: `${crudGapBetweenCards}px`,
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          userSelect: "none",
                          position: "relative",
                          ...getVerticalDraggableStyle(draggableProvided.draggableProps.style, snapshot.isDragging),
                        }}
                      >
                        {/* Checkbox Column with MoveCardUp (upper) & MoveCardDown (lower) */}
                        <View style={styles.leftControlColumn}>
                          {/* 1. MoveCardUp button (upper than Card checkbox) - uses primaryColor */}
                          <div title="Move Card Up" style={{ cursor: "pointer", padding: "2px" }}>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => handleMoveUp(index)}>
                              <MaterialCommunityIcons name="chevron-up" size={24} color={primaryColor} />
                            </TouchableOpacity>
                          </div>

                          {/* 2. Round Card Checkbox using IconApp */}
                          <div title="Select Card" style={{ margin: "2px 0" }}>
                            <IconApp
                              testID={`card-check-${card.id}`}
                              name="check"
                              size={16}
                              color={isSelected ? theme.colors.onPrimary : "transparent"}
                              onPress={() =>
                                setSelectedIds((prev) =>
                                  prev.includes(card.id)
                                    ? prev.filter((i) => i !== card.id)
                                    : [...prev, card.id]
                                )
                              }
                              style={[
                                styles.roundCheckbox,
                                isSelected
                                  ? { backgroundColor: primaryColor, borderColor: primaryColor }
                                  : { borderColor: primaryColor, backgroundColor: "transparent" },
                              ]}
                            />
                          </div>

                          {/* 3. MoveCardDown button (lower than Card checkbox) - uses primaryColor */}
                          <div title="Move Card Down" style={{ cursor: "pointer", padding: "2px" }}>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => handleMoveDown(index)}>
                              <MaterialCommunityIcons name="chevron-down" size={24} color={primaryColor} />
                            </TouchableOpacity>
                          </div>
                        </View>

                        {/* 12px Distance / Gap between Checkbox Column and Card (twice thinner) */}
                        <View style={{ width: 12 }} />

                        {/* Card Component */}
                        <View style={{ flex: 1, position: "relative" }}>
                          <SwipeableCard
                            swipeLeftToRightPercent={25}
                            swipeRightToLeftPercent={25}
                            forceSwipeToLeftPercent={50}
                            forceSwipeToRightPercent={50}
                            onForceSwipeFromRightToLeft={() => handleDelete(card.id)}
                            onForceSwipeFromLeftToRight={() => handleArchive(card.id)}
                            crudCardSwipeUnderlayLeft={
                              <CardSwipeUnderlayLeftComponent
                                currentIListtem={card}
                                onArchive={(item) => handleArchive(item.id)}
                                primaryLightColor={primaryLightColor}
                                primaryColor={primaryColor}
                                dragVertical={true}
                                dragHorizontal={false}
                              />
                            }
                            crudCardSwipeUnderlayRight={
                              <CardSwipeUnderlayRightComponent
                                currentIListtem={card}
                                onDelete={(item) => handleDelete(item.id)}
                                primaryLightColor={primaryLightColor}
                                primaryColor={primaryColor}
                                dragVertical={true}
                                dragHorizontal={false}
                              />
                            }
                          >
                            {renderCardItem(card, isSelected, snapshot.isDragging, draggableProvided.dragHandleProps)}
                          </SwipeableCard>
                        </View>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
  },
  createCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    elevation: 2,
  },
  formHeader: {
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  controlsRow: {
    marginVertical: 8,
    minHeight: 48,
    justifyContent: "center",
  },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectAllText: {
    fontWeight: "bold",
    color: "#444",
  },
  leftControlColumn: {
    width: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  roundCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#757575",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ListWebCardsComponent;
