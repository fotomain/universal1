import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CardIconsBottomComponentProps } from "./types";

export const CardIconsBottomComponent: React.FC<CardIconsBottomComponentProps> = ({
  onArchive,
  onDelete,
  onMakeFirst,
  onMakeLast,
  dragHandleProps,
  primaryColor = "#6200ee",
}) => {
  return (
    <View style={styles.cardBottomRow}>
      {/* LeftSideIcons: drag_indicator from Google Fonts Icons and Move First/Last */}
      <View style={styles.leftSideIcons}>
        <div {...dragHandleProps} title="Drag Indicator" style={{ cursor: "grab", display: "flex", alignItems: "center", padding: "4px" }}>
          <MaterialIcons name="drag-indicator" size={24} color={primaryColor} />
        </div>
        
        {onMakeFirst && (
          <div title="Make First in List" style={{ cursor: "pointer", padding: "4px", marginLeft: 4 }}>
            <TouchableOpacity activeOpacity={0.7} onPress={onMakeFirst}>
              <MaterialCommunityIcons name="chevron-double-up" size={20} color={primaryColor} />
            </TouchableOpacity>
          </div>
        )}

        {onMakeLast && (
          <div title="Make Last in List" style={{ cursor: "pointer", padding: "4px", marginLeft: 4 }}>
            <TouchableOpacity activeOpacity={0.7} onPress={onMakeLast}>
              <MaterialCommunityIcons name="chevron-double-down" size={20} color={primaryColor} />
            </TouchableOpacity>
          </div>
        )}
      </View>

      {/* RightSideIcons: Outlined icons using primary color */}
      <View style={styles.rightSideIcons}>
        <div title="Archive Card" style={{ cursor: "pointer", padding: "4px", marginRight: 8 }}>
          <TouchableOpacity activeOpacity={0.7} onPress={onArchive}>
            <MaterialCommunityIcons name="archive-outline" size={20} color={primaryColor} />
          </TouchableOpacity>
        </div>

        <div title="Delete Card" style={{ cursor: "pointer", padding: "4px" }}>
          <TouchableOpacity activeOpacity={0.7} onPress={onDelete}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={primaryColor} />
          </TouchableOpacity>
        </div>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  leftSideIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightSideIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
});
