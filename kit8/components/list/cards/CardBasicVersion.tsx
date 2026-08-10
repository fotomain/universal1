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
}) => {
  const theme = useTheme();

  return (
    <CardApp
      testID={testID}
      style={{
        backgroundColor: isSelected
          ? (theme.dark ? "#1e3a5f" : "#e3f2fd")
          : theme.colors.surface,
        borderRadius: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {/* Copy to Clipboard Icon at Left of Card ID */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(card.id);
              }
            }}
          >
            <MaterialCommunityIcons name="content-copy" size={18} color={primaryColor} />
          </TouchableOpacity>
          <Text style={{ fontSize: 14, fontFamily: "Roboto, 'Helvetica Neue', sans-serif", color: theme.colors.onSurface, fontWeight: '500' }}>
            ID: {card.id.substring(0, 12)}...
          </Text>
        </View>

        {/* CardThreeDotsMenu at top right corner of Card */}
        <CardThreeDotsMenu
          onEdit={() => onEdit?.(card.id)}
          onDelete={() => onDelete?.(card.id)}
          onShare={() => onShare?.(card.id)}
          onMenuOpenStateChange={(isOpen) => onMenuOpenStateChange?.(isOpen)}
          primaryColor={primaryColor}
        />
      </View>

      {/* Card Content - Show Title and Description */}
      <View style={{ flexDirection: "column", gap: 8, paddingBottom: 8 }}>
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
      <View style={cardStyles.fabCornerWrapper}>
        <FABForCardComponent
          cardId={card.id}
          size="small"
          onEdit={() => onEdit?.(card.id)}
          onShare={() => onShare?.(card.id)}
          onDelete={() => onDelete?.(card.id)}
        />
      </View>

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
