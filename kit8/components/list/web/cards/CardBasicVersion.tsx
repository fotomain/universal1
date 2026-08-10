import React from "react";
import { TouchableOpacity } from "react-native";
import { Card, useTheme } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CardItem } from "../lib/types";
import { CardThreeDotsMenu } from "../lib/CardThreeDotsMenu";
import { CardIconsBottomComponent } from "../lib/CardIconsBottomComponent";
import TexInputMi from "../../../../ui/TexInputMi";

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
  onMenuOpenStateChange?: (isOpen: boolean) => void;
  dragHandleProps?: any;
  testID?: string;
  crudCardHeight?: number;
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
  onMenuOpenStateChange,
  dragHandleProps,
  testID = "cardBasic",
  crudCardHeight = 150,
}) => {
  const theme = useTheme();

  return (
    <Card
      testID={testID}
      mode="elevated"
      style={{
        backgroundColor: isSelected
          ? (theme.dark ? "#1e3a5f" : "#e3f2fd")
          : theme.colors.surface,
        borderRadius: 8,
        boxShadow: isDragging
          ? "0px 8px 24px rgba(0, 0, 0, 0.45)"
          : "0px 4px 14px rgba(0, 0, 0, 0.28)",
        elevation: isDragging ? 10 : 6,
        minHeight: crudCardHeight,
      }}
    >
      <Card.Title
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Copy to Clipboard Icon at Left of Card ID */}
            <div title="Copy Card ID" style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(card.id);
                  }
                  console.log(`Copied card ID to clipboard: ${card.id}`);
                }}
              >
                <MaterialCommunityIcons name="content-copy" size={18} color={primaryColor} />
              </TouchableOpacity>
            </div>
            <span style={{ fontSize: "14px", fontFamily: "Roboto, 'Helvetica Neue', sans-serif", color: theme.colors.onSurface, fontWeight: 500 }}>
              ID: {card.id.substring(0, 12)}...
            </span>
          </div>
        }
        right={() => (
          /* CardThreeDotsMenu at top right corner of Card */
          <CardThreeDotsMenu
            onEdit={() => onEdit?.(card.id)}
            onDelete={() => onDelete?.(card.id)}
            onShare={() => onShare?.(card.id)}
            onMenuOpenStateChange={(isOpen) => onMenuOpenStateChange?.(isOpen)}
            primaryColor={primaryColor}
          />
        )}
      />

      {/* Card Content - Show Title and Description */}
      <Card.Content style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
        <TexInputMi
          label="Title"
          value={card.title}
          onChangeText={(val: string) => onFieldChange?.(card.id, "title", val)}
          inputMode="nativePaper"
        />
        <TexInputMi
          label="Description"
          value={card.description}
          onChangeText={(val: string) => onFieldChange?.(card.id, "description", val)}
          inputMode="nativePaper"
        />
      </Card.Content>

      {/* CardIconsBottomComponent: Space-between flex box with LeftSideIcons & RightSideIcons */}
      <CardIconsBottomComponent
        onArchive={() => onArchive?.(card.id)}
        onDelete={() => onDelete?.(card.id)}
        dragHandleProps={dragHandleProps}
        primaryColor={primaryColor}
      />
    </Card>
  );
};

export default CardBasicVersion;
