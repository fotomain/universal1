import React from "react";
import { View, TouchableOpacity } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CardSwipeUnderlayRightComponentProps } from "./types";

export const CardSwipeUnderlayRightComponent: React.FC<CardSwipeUnderlayRightComponentProps> = ({
  currentIListtem,
  onDelete,
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
        justifyContent: "flex-end",
        alignItems: "center",
        paddingRight: 48,
        boxSizing: "border-box",
        touchAction: !dragHorizontal && dragVertical ? "pan-y" : dragHorizontal && !dragVertical ? "pan-x" : "auto",
      } as any}
    >
      <div
        title="Delete Item"
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          transform: "translateX(18px)",
          touchAction: !dragHorizontal && dragVertical ? "pan-y" : "auto",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(currentIListtem);
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={(e) => {
            e.stopPropagation();
            onDelete?.(currentIListtem);
          }}
          style={{ padding: 8, transform: [{ translateX: 18 }] }}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={36} color={primaryColor} />
        </TouchableOpacity>
      </div>
    </View>
  );
};
