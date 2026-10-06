import React from "react";
import { View, TouchableOpacity } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CardSwipeUnderlayLeftComponentProps } from "./types";

export const CardSwipeUnderlayLeftComponent: React.FC<CardSwipeUnderlayLeftComponentProps> = ({
  currentIListtem,
  onArchive,
  primaryLightColor = "#eaddff",
  primaryColor = "#6200ee",
  dragVertical = true,
  dragHorizontal = false,
}) => {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: primaryLightColor,
        borderRadius: 8,
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
        paddingLeft: 24,
        boxSizing: "border-box",
        touchAction: !dragHorizontal && dragVertical ? "pan-y" : dragHorizontal && !dragVertical ? "pan-x" : "auto",
      } as any}
    >
      <div
        title="Archive Item"
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          touchAction: !dragHorizontal && dragVertical ? "pan-y" : "auto",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onArchive?.(currentIListtem);
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={(e) => {
            e.stopPropagation();
            onArchive?.(currentIListtem);
          }}
          style={{ padding: 8 }}
        >
          <MaterialCommunityIcons name="archive-outline" size={36} color={primaryColor} />
        </TouchableOpacity>
      </div>
    </View>
  );
};
