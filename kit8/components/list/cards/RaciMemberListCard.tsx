import React from "react";
import { View, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Text, useTheme } from "react-native-paper";
import CardApp from '../../common/CardApp';
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CardItem } from "../web/lib/types";
import { CardThreeDotsMenu } from "../web/lib/CardThreeDotsMenu";
import { CardIconsBottomComponent } from "../web/lib/CardIconsBottomComponent";
import { FABForCardComponent } from "../../fab/FABForCardComponent";

export interface RaciMemberListCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  primaryColor?: string;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onEdit?: (id: string) => void;
  onCreateBeforeCurrent?: (id: string) => void;
  onCreateAfterCurrent?: (id: string) => void;
  onCopyPasteBeforeCurrent?: (id: string) => void;
  onCopyPasteAfterCurrent?: (id: string) => void;
  onMakeFirst?: (id: string) => void;
  onMakeLast?: (id: string) => void;
  onMenuOpenStateChange?: (isOpen: boolean) => void;
  dragHandleProps?: any;
  testID?: string;
}

export const RaciMemberListCard: React.FC<RaciMemberListCardProps> = ({
  card,
  isSelected = false,
  isDragging = false,
  primaryColor = "#1D827D",
  onArchive,
  onDelete,
  onShare,
  onEdit,
  onCreateBeforeCurrent,
  onCreateAfterCurrent,
  onCopyPasteBeforeCurrent,
  onCopyPasteAfterCurrent,
  onMakeFirst,
  onMakeLast,
  onMenuOpenStateChange,
  dragHandleProps,
  testID = "raciMemberCard",
}) => {
  const paperTheme = useTheme();
  const themePrimary = primaryColor || paperTheme.colors.primary;

  // Extract JSON data
  const json = card.rawItem?.mediaPostJSON || {};
  const email = json.raciEmail || "No Email";
  const firstName = json.raciFirstName || "No Name";
  const lastName = json.raciLastName || "";
  const pronoun = json.pronoun || "No Pronoun";
  const birthday = json.birthday || "No Birthday";

  const fullName = `${firstName} ${lastName}`.trim();

  const handleEmailPress = () => {
    if (email && email !== "No Email") {
      Linking.openURL(`mailto:${email}`);
    }
  };

  return (
    <CardApp
      testID={testID}
      elevation={isDragging ? 4 : 1}
      style={[
        styles.card,
        {
          backgroundColor: isSelected
            ? (paperTheme.dark ? "#1e3a5f" : "#e3f2fd")
            : paperTheme.colors.surface,
          minHeight: 110,
        },
      ]}
    >
      <View style={styles.cardLayout}>
        
        {/* Left Info Column */}
        <View style={styles.infoColumn}>
          {/* Top Row: Name and Menu */}
          <View style={styles.headerRow}>
            <Text style={[styles.nameText, { color: paperTheme.colors.onSurface }]} numberOfLines={1}>
              {fullName}
            </Text>
            <View style={styles.menuWrapper}>
              <CardThreeDotsMenu
                onEdit={() => onEdit?.(card.id)}
                onDelete={() => onDelete?.(card.id)}
                onShare={() => onShare?.(card.id)}
                onMenuOpenStateChange={onMenuOpenStateChange}
                primaryColor={themePrimary}
              />
            </View>
          </View>

          {/* User Details Grid */}
          <View style={styles.detailsGrid}>
            <TouchableOpacity style={styles.detailItem} onPress={handleEmailPress} activeOpacity={0.7}>
              <MaterialCommunityIcons name="email-outline" size={14} color={paperTheme.colors.primary} />
              <Text style={[styles.detailText, { color: paperTheme.colors.primary, textDecorationLine: 'underline' }]} numberOfLines={1}>
                {email}
              </Text>
            </TouchableOpacity>
            
            {pronoun !== "No Pronoun" && (
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="account-question-outline" size={14} color={paperTheme.colors.onSurfaceVariant} />
                <Text style={[styles.detailText, { color: paperTheme.colors.onSurfaceVariant }]} numberOfLines={1}>
                  {pronoun}
                </Text>
              </View>
            )}

            {birthday !== "No Birthday" && (
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="cake-variant-outline" size={14} color={paperTheme.colors.onSurfaceVariant} />
                <Text style={[styles.detailText, { color: paperTheme.colors.onSurfaceVariant }]} numberOfLines={1}>
                  {birthday}
                </Text>
              </View>
            )}
          </View>
        </View>

      </View>

      {/* FAB positioned at the right bottom corner of the RACI Card */}
      <View style={styles.fabCornerWrapper}>
        <FABForCardComponent
          cardId={card.id}
          size="small"
          onEdit={() => onEdit?.(card.id)}
          onShare={() => onShare?.(card.id)}
          onDelete={() => onDelete?.(card.id)}
          onCreateBeforeCurrent={() => onCreateBeforeCurrent?.(card.id)}
          onCreateAfterCurrent={() => onCreateAfterCurrent?.(card.id)}
          onCopyPasteBeforeCurrent={() => onCopyPasteBeforeCurrent?.(card.id)}
          onCopyPasteAfterCurrent={() => onCopyPasteAfterCurrent?.(card.id)}
        />
      </View>

      <CardIconsBottomComponent
        onArchive={() => onArchive?.(card.id)}
        onDelete={() => onDelete?.(card.id)}
        onMakeFirst={() => onMakeFirst?.(card.id)}
        onMakeLast={() => onMakeLast?.(card.id)}
        dragHandleProps={dragHandleProps}
        primaryColor={themePrimary}
      />
    </CardApp>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 12,
    overflow: "visible",
    justifyContent: "space-between",
  },
  cardLayout: {
    flex: 1,
    flexDirection: "row",
    padding: 12,
    paddingBottom: 0,
  },
  infoColumn: {
    flex: 1,
  },
  fabCornerWrapper: {
    position: "absolute",
    bottom: 38,
    right: 10,
    zIndex: 999,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nameText: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
    marginTop: 4,
  },
  menuWrapper: {
    marginTop: -8,
    marginRight: -8,
  },
  detailsGrid: {
    marginTop: 8,
    gap: 4,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
});

export default RaciMemberListCard;
