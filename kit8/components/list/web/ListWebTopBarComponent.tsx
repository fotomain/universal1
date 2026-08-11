import React from "react";
import {StyleSheet, View} from "react-native";
import IconApp from "../../../../components/common/IconApp";
import OnOffButtonApp from "../../../../components/common/OnOffButtonApp";

let usePaperTheme: any;
try {
  usePaperTheme = require("react-native-paper").useTheme;
} catch (e) {
  usePaperTheme = null;
}
#
export interface ListWebTopBarComponentProps {
  onCreateNewItem?: () => void;
  onScrollToCurrent?: () => void;
  onScrollTop?: () => void;
  onScrollBottom?: () => void;
  isScrollToCurrentEnabled?: boolean;
  currentCardTitle?: string;
  isSelectionVisible?: boolean;
  onSelectionVisibleChange?: (isOn: boolean) => void;
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
  isSelectionVisible = false,
  onSelectionVisibleChange,
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
      ? `scroll to card "${currentCardTitle}"`
      : "scroll to current card"
    : "No card selected";

  return (
    <View style={[styles.container, { backgroundColor: surfaceColor }, style]} testID={testID}>
      {/* 1. Left Justified Section: Big Plus Symbol Icon & OnOffButtonApp */}
      <View style={styles.leftSection}>
        <div title="Create New Item">
          <IconApp
            testID="createNewItem"
            name="add"
            size={32}
            color={primaryColor}
            onPress={onCreateNewItem}
            style={styles.iconTouchable}
          />
        </div>

        {/* OnOffButtonApp right after createNewItem */}
        <div title={isSelectionVisible ? "Hide Card Selection" : "Show Card Selection"} style={{ marginLeft: 8 }}>
          <OnOffButtonApp
            testID="onOffSelectionButton"
            isOn={isSelectionVisible}
            onOffCallback={onSelectionVisibleChange}
            primaryColor={primaryColor}
          />
        </div>
      </View>

      {/* 2. Right Justified Section: Scroll Icons */}
      <View style={styles.rightSection}>
        {/* scrollToCurrent Icon (enabled if card pressed or edited) */}
        <div title={scrollToCurrentTip}>
          <IconApp
            testID="scrollToCurrent"
            name="filter_tilt_shift"
            size={24}
            color={isScrollToCurrentEnabled ? primaryColor : "#9e9e9e"}
            onPress={isScrollToCurrentEnabled ? onScrollToCurrent : undefined}
            style={[styles.iconTouchable, !isScrollToCurrentEnabled && styles.disabledTouchable]}
          />
        </div>

        {/* scrollTop Icon */}
        <div title="Scroll to Top">
          <IconApp
            testID="scrollTop"
            name="vertical_align_top"
            size={24}
            color={primaryColor}
            onPress={onScrollTop}
            style={styles.iconTouchable}
          />
        </div>

        {/* scrollBottom Icon */}
        <div title="Scroll to Bottom">
          <IconApp
            testID="scrollBottom"
            name="vertical_align_bottom"
            size={24}
            color={primaryColor}
            onPress={onScrollBottom}
            style={styles.iconTouchable}
          />
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
