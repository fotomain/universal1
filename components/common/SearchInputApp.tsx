import React from "react";
import { View, StyleSheet } from "react-native";
import TextInputApp from "./TextInputApp";

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

  return (
    <View style={[styles.container, style]} testID={testID}>
      <TextInputApp
        testID={`${testID}-input`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        leftIcon="search"
        style={[
          styles.textInput,
          {
            borderColor: primaryColor,
            backgroundColor: themeColors.surface || "#ffffff",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  textInput: {
    width: "100%",
    marginBottom: 0,
  },
});

export default SearchInputApp;
