import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

let usePaperTheme: any;
try {
  usePaperTheme = require("react-native-paper").useTheme;
} catch (e) {
  usePaperTheme = null;
}

export interface ListWebTopBarComponentProps {
  onCreateNewItem?: () => void;
  onScrollToCurrent?: () => void;
  onScrollTop?: () => void;
  onScrollBottom?: () => void;
  isScrollToCurrentEnabled?: boolean;
  currentCardTitle?: string;
  primaryColor?: string;
  style?: any;
  testID?: string;
}

export function ListWebTopBarComponent({
  onCreateNewItem,
  onScrollToCurrent,
  onScrollTop,
  onScrollBottom,
  isScrollToCurrentEnabled = false,
  currentCardTitle = "",
  primaryColor = "#2e7d32",
  style,
  testID = "listWebTopBar",
}: ListWebTopBarComponentProps) {
  let surfaceColor = "#ffffff";
  try {
    if (usePaperTheme) {
      const theme = usePaperTheme();
      if (theme?.colors?.surface) {
        surfaceColor = theme.colors.surface;
      }
    }
  } catch (e) {
    surfaceColor = "#ffffff";
  }

  const scrollToCurrentTip = isScrollToCurrentEnabled
    ? currentCardTitle
      ? `scroll to "${currentCardTitle}"`
      : "scroll to current card"
    : "No card selected";

  return (
    <View style={[styles.container, { backgroundColor: surfaceColor }, style]} testID={testID}>
      {/* 1. Left Justified Section: Big Plus Symbol Icon */}
      <View style={styles.leftSection}>
        <div title="Create New Item">
          <TouchableOpacity
            testID="createNewItem"
            activeOpacity={0.7}
            onPress={onCreateNewItem}
            style={styles.iconTouchable}
            accessibilityLabel="Create New Item"
          >
            <MaterialIcons name="add" size={32} color={primaryColor} />
          </TouchableOpacity>
        </div>
      </View>

      {/* 2. Right Justified Section: Scroll Icons */}
      <View style={styles.rightSection}>
        {/* scrollToCurrent Icon (enabled if card pressed or edited) */}
        <div title={scrollToCurrentTip}>
          <TouchableOpacity
            testID="scrollToCurrent"
            activeOpacity={isScrollToCurrentEnabled ? 0.7 : 1}
            disabled={!isScrollToCurrentEnabled}
            onPress={() => isScrollToCurrentEnabled && onScrollToCurrent?.()}
            style={[styles.iconTouchable, !isScrollToCurrentEnabled && styles.disabledTouchable]}
            accessibilityLabel={scrollToCurrentTip}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={24}
              color={isScrollToCurrentEnabled ? primaryColor : "#9e9e9e"}
            />
          </TouchableOpacity>
        </div>

        {/* scrollTop Icon */}
        <div title="Scroll to Top">
          <TouchableOpacity
            testID="scrollTop"
            activeOpacity={0.7}
            onPress={onScrollTop}
            style={styles.iconTouchable}
            accessibilityLabel="Scroll to Top"
          >
            <MaterialCommunityIcons
              name="format-vertical-align-top"
              size={24}
              color={primaryColor}
            />
          </TouchableOpacity>
        </div>

        {/* scrollBottom Icon */}
        <div title="Scroll to Bottom">
          <TouchableOpacity
            testID="scrollBottom"
            activeOpacity={0.7}
            onPress={onScrollBottom}
            style={styles.iconTouchable}
            accessibilityLabel="Scroll to Bottom"
          >
            <MaterialCommunityIcons
              name="format-vertical-align-bottom"
              size={24}
              color={primaryColor}
            />
          </TouchableOpacity>
        </div>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 8,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconTouchable: {
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledTouchable: {
    opacity: 0.4,
  },
});

export default ListWebTopBarComponent;
