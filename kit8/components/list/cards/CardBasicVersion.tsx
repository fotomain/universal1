import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import CardApp from "../../../../components/common/CardApp";
import TextInputApp from "../../../../components/common/TextInputApp";
import { useTheme } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CardItem } from "../web/lib/types";
import { CardThreeDotsMenu } from "../web/lib/CardThreeDotsMenu";
import { CardIconsBottomComponent } from "../web/lib/CardIconsBottomComponent";
import { FABForCardComponent } from "../../fab/FABForCardComponent";

export interface CardBasicVersionProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  primaryColor?: string;
  onFieldChange?: (id: string, field: "title" | "description", value: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onEdit?: (id: string) => void;
  onMakeFirst?: (id: string) => void;
  onMakeLast?: (id: string) => void;
  onMenuOpenStateChange?: (isOpen: boolean) => void;
  dragHandleProps?: any;
  testID?: string;
  fabCardNeeded?: boolean;
}

export const CardBasicVersion: React.FC<CardBasicVersionProps> = ({
  card,
  isSelected = false,
  isDragging = false,
  primaryColor = "#6200ee",
  onFieldChange,
  onArchive,
  onDelete,
  onShare,
  onEdit,
  onMakeFirst,
  onMakeLast,
  onMenuOpenStateChange,
  dragHandleProps,
  testID = "cardBasic",
  fabCardNeeded = true,
}) => {
  const theme = useTheme();

  return (
    <CardApp
      testID={testID}
      style={{
        width: "100%",
        backgroundColor: theme.dark ? "#12121e" : "#ffffff",
        borderColor: isSelected ? primaryColor : (theme.dark ? "#3a3a55" : "#e0e0e0"),
        borderWidth: isSelected ? 2 : 1,
        borderRadius: 12,
        padding: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDragging ? 0.3 : 0.05,
        shadowRadius: isDragging ? 10 : 3,
        elevation: isDragging ? 6 : 1,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.dark ? "#ffffff" : theme.colors.onSurface }}>
          {card.title}
        </Text>
        <CardThreeDotsMenu
          onEdit={() => onEdit?.(card.id)}
          onDelete={() => onDelete?.(card.id)}
          onShare={() => onShare?.(card.id)}
          onMenuOpenStateChange={onMenuOpenStateChange}
          primaryColor={primaryColor}
        />
      </View>

      <Text style={{ fontSize: 14, color: theme.dark ? "#8892B0" : theme.colors.onSurfaceVariant, marginBottom: 12 }}>
        {card.description}
      </Text>

      {/* Editing Form fields visible if card is being edited */}
      <View style={{ gap: 8, marginBottom: 12 }}>
        <TextInputApp
          label="Title"
          value={card.title}
          onChangeText={(val: string) => onFieldChange?.(card.id, "title", val)}
        />
        <TextInputApp
          label="Description"
          value={card.description}
          onChangeText={(val: string) => onFieldChange?.(card.id, "description", val)}
        />
      </View>

      {/* FAB positioned at the right bottom corner of the Card */}
      {fabCardNeeded && (
        <View style={cardStyles.fabCornerWrapper}>
          <FABForCardComponent
            cardId={card.id}
            size="small"
            onEdit={() => onEdit?.(card.id)}
            onShare={() => onShare?.(card.id)}
            onDelete={() => onDelete?.(card.id)}
          />
        </View>
      )}

      {/* CardIconsBottomComponent: Space-between flex box with LeftSideIcons & RightSideIcons */}
      <CardIconsBottomComponent
        onArchive={() => onArchive?.(card.id)}
        onDelete={() => onDelete?.(card.id)}
        onMakeFirst={() => onMakeFirst?.(card.id)}
        onMakeLast={() => onMakeLast?.(card.id)}
        dragHandleProps={dragHandleProps}
        primaryColor={primaryColor}
      />
    </CardApp>
  );
};

const cardStyles = StyleSheet.create({
  fabCornerWrapper: {
    position: "absolute",
    bottom: 38,
    right: 10,
    zIndex: 999,
  },
});

export default CardBasicVersion;
