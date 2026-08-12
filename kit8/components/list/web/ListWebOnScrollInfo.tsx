import React from "react";
import { MD3Theme } from "react-native-paper";

export interface ListWebOnScrollInfoProps {
  scrollPercent: number;
  theme: MD3Theme;
  primaryColor?: string;
}

export function ListWebOnScrollInfo({
  scrollPercent,
  theme,
  primaryColor = "#6366f1",
}: ListWebOnScrollInfoProps) {
  const isDark = theme.dark;
  const borderColor = isDark ? "#818cf8" : "#3b82f6";
  const bg = isDark ? "rgba(99, 102, 241, 0.1)" : "#eff6ff";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        marginBottom: "8px",
        borderRadius: "20px",
        backgroundColor: bg,
        border: `1.5px dashed ${borderColor}`,
        fontFamily: "system-ui, -apple-system, Roboto, sans-serif",
        userSelect: "none",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "20px" }}>💼</span>
        <span style={{ fontSize: "16px" }}>📈</span>
        <span style={{ fontSize: "14px", fontWeight: "bold", color: isDark ? "#cbd5e1" : "#1e3a8a", marginRight: "4px" }}>...</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, justifyContent: "flex-end" }}>
        {/* Progress Bar Container */}
        <div
          style={{
            flex: 1,
            maxWidth: "150px",
            height: "10px",
            backgroundColor: isDark ? "#334155" : "#dbeafe",
            borderRadius: "5px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${scrollPercent}%`,
              height: "100%",
              backgroundColor: primaryColor,
              borderRadius: "5px",
              transition: "width 0.2s ease",
            }}
          />
        </div>

        {/* Scroll percentage text */}
        <span
          style={{
            fontSize: "14px",
            fontWeight: "950",
            color: primaryColor,
            minWidth: "36px",
            textAlign: "right",
          }}
        >
          {scrollPercent}%
        </span>
      </div>
    </div>
  );
}

export default ListWebOnScrollInfo;
