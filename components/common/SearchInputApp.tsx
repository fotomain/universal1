import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import IconApp from "./IconApp";

let useDesignSystem: any;
try {
  useDesignSystem = require("../../context/DesignSystemContext").useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ themeColors: { primary: "#6750A4", surface: "#ffffff" } });
}

export interface SearchInputAppProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  primaryColor?: string;
  style?: any;
  testID?: string;
}

export function SearchInputApp({
  value = "",
  onChangeText,
  placeholder = "Search items...",
  primaryColor: customPrimaryColor,
  style,
  testID = "searchInputApp",
}: SearchInputAppProps) {
  let themeColors: any = { primary: "#6750A4", surface: "#ffffff" };
  try {
    if (useDesignSystem) {
      themeColors = useDesignSystem()?.themeColors || themeColors;
    }
  } catch (e) {
    // fallback
  }

  const primaryColor = customPrimaryColor || themeColors.primary || "#6750A4";

  const handleClear = (e?: any) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    console.log("SearchInputApp handleClear triggered");
    onChangeText?.("");
  };

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          borderColor: primaryColor,
          backgroundColor: themeColors.surface || "#ffffff",
        },
        style,
      ]}
    >
      {/* Search Icon */}
      <View style={styles.iconContainer}>
        <IconApp testID={`${testID}-search-icon`} name="search" size={20} color={primaryColor} />
      </View>

      {/* Text Input */}
      <TextInput
        testID={`${testID}-input`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9e9e9e"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Clear Button */}
      {Boolean(value && value.length > 0) && (
        <div
          onClick={handleClear}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.preventDefault()}
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px",
            zIndex: 10,
            userSelect: "none",
          }}
        >
          <IconApp
            testID={`${testID}-clear-button`}
            name="close"
            size={20}
            color="#757575"
            onPress={handleClear}
          />
        </div>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 42,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    boxSizing: "border-box" as any,
    position: "relative",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: "#212121",
    marginLeft: 8,
    marginRight: 4,
    padding: 0,
    outlineStyle: "none" as any,
  },
});

export default SearchInputApp;
